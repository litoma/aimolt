const { Client } = require('pg');
const axios = require('axios');

class ProfileProcessor {
    constructor() {
        this.obsidianConfig = {
            baseURL: process.env.OBSIDIAN_URL,
            apiKey: process.env.OBSIDIAN_API,
            headers: {
                'Authorization': `Bearer ${process.env.OBSIDIAN_API}`,
                'Content-Type': 'application/json'
            }
        };
        
        this.dbConfig = {
            host: process.env.POSTGRES_HOST || 'postgres',
            port: process.env.POSTGRES_PORT || 5432,
            database: process.env.POSTGRES_DB,
            user: process.env.POSTGRES_USER,
            password: process.env.POSTGRES_PASSWORD
        };
    }

    async connectDB() {
        const client = new Client(this.dbConfig);
        await client.connect();
        return client;
    }

    // Obsidianからすべてのメモを取得
    async getAllNotesFromObsidian() {
        try {
            const response = await axios.get(`${this.obsidianConfig.baseURL}/vault/`, {
                headers: this.obsidianConfig.headers,
                timeout: 10000
            });
            
            const notes = [];
            if (response.data && response.data.files) {
                for (const file of response.data.files) {
                    if (file.endsWith('.md')) {
                        try {
                            const noteResponse = await axios.get(
                                `${this.obsidianConfig.baseURL}/vault/${encodeURIComponent(file)}`,
                                { headers: this.obsidianConfig.headers, timeout: 5000 }
                            );
                            
                            notes.push({
                                filename: file,
                                content: noteResponse.data,
                                lastModified: new Date()
                            });
                        } catch (noteError) {
                            console.error(`Error fetching note ${file}:`, noteError.message);
                        }
                    }
                }
            }
            
            return notes;
        } catch (error) {
            console.error('Error fetching notes from Obsidian:', error.message);
            return [];
        }
    }

    // Geminiを使ってメモから人物特性を抽出
    async analyzeNoteForProfile(content, genAI) {
        const prompt = `
以下のメモから、書いた人の人物特性を抽出してください。

メモ内容:
${content}

以下のJSONフォーマットで回答してください：
{
    "values": ["価値観や信念のリスト"],
    "interests": ["興味・関心のリスト"],
    "personality": ["性格特性のリスト"],
    "thinking_patterns": ["思考パターンのリスト"],
    "confidence": 0.8
}

メモから明確に読み取れる情報のみを抽出し、推測はconfidenceを下げてください。
該当する情報がない場合は空配列を返してください。
有効なJSONのみを返し、余計な説明は含めないでください。
`;

        try {
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
            });
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            // JSONの抽出を試行
            let jsonText = text.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\s*/, '').replace(/```\s*$/, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\s*/, '').replace(/```\s*$/, '');
            }
            
            return JSON.parse(jsonText);
        } catch (error) {
            console.error('Failed to analyze note for profile:', error.message);
            return {
                values: [],
                interests: [],
                personality: [],
                thinking_patterns: [],
                confidence: 0.1
            };
        }
    }

    // プロファイルテーブルの初期化
    async initializeProfileTables() {
        const client = await this.connectDB();
        
        try {
            // メモファイル管理テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS obsidian_notes (
                    id SERIAL PRIMARY KEY,
                    file_name VARCHAR(255) NOT NULL UNIQUE,
                    content TEXT NOT NULL,
                    last_modified TIMESTAMP NOT NULL,
                    processed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // 基本プロファイル保存テーブル
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_profile (
                    id SERIAL PRIMARY KEY,
                    category VARCHAR(100) NOT NULL,
                    content JSONB NOT NULL,
                    confidence_score FLOAT DEFAULT 1.0,
                    source_notes TEXT[],
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // プロファイル更新履歴
            await client.query(`
                CREATE TABLE IF NOT EXISTS profile_update_history (
                    id SERIAL PRIMARY KEY,
                    update_type VARCHAR(50) NOT NULL,
                    processed_notes_count INTEGER,
                    new_insights TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // インデックス作成
            await client.query('CREATE INDEX IF NOT EXISTS idx_obsidian_notes_modified ON obsidian_notes(last_modified)');
            await client.query('CREATE INDEX IF NOT EXISTS idx_user_profile_category ON user_profile(category)');
            
            console.log('Profile tables initialized successfully');
        } catch (error) {
            console.error('Error initializing profile tables:', error);
        } finally {
            await client.end();
        }
    }

    // メモを保存/更新
    async saveNotesToDB(notes) {
        if (notes.length === 0) return;
        
        const client = await this.connectDB();
        
        try {
            for (const note of notes) {
                const existingQuery = `
                    SELECT id, last_modified FROM obsidian_notes 
                    WHERE file_name = $1
                `;
                const existing = await client.query(existingQuery, [note.filename]);
                
                if (existing.rows.length === 0) {
                    // 新規作成
                    await client.query(`
                        INSERT INTO obsidian_notes (file_name, content, last_modified)
                        VALUES ($1, $2, $3)
                    `, [note.filename, note.content, note.lastModified]);
                    console.log(`New note saved: ${note.filename}`);
                } else {
                    // 内容更新（常に新しい内容で更新）
                    await client.query(`
                        UPDATE obsidian_notes 
                        SET content = $1, last_modified = $2, processed_at = NULL, updated_at = CURRENT_TIMESTAMP
                        WHERE file_name = $3
                    `, [note.content, note.lastModified, note.filename]);
                    console.log(`Note updated: ${note.filename}`);
                }
            }
        } catch (error) {
            console.error('Error saving notes to DB:', error);
        } finally {
            await client.end();
        }
    }

    // 未処理のメモを分析
    async processUnprocessedNotes(genAI) {
        const client = await this.connectDB();
        
        try {
            const unprocessedQuery = `
                SELECT id, file_name, content 
                FROM obsidian_notes 
                WHERE processed_at IS NULL 
                ORDER BY last_modified DESC
                LIMIT 10
            `;
            const unprocessed = await client.query(unprocessedQuery);
            
            if (unprocessed.rows.length === 0) {
                console.log('No unprocessed notes found');
                return;
            }

            console.log(`Processing ${unprocessed.rows.length} notes...`);
            
            for (const note of unprocessed.rows) {
                try {
                    const insights = await this.analyzeNoteForProfile(note.content, genAI);
                    await this.updateProfileWithInsights(client, insights, note.file_name);
                    
                    // 処理済みマーク
                    await client.query(`
                        UPDATE obsidian_notes 
                        SET processed_at = CURRENT_TIMESTAMP 
                        WHERE id = $1
                    `, [note.id]);
                    
                    console.log(`Processed: ${note.file_name}`);
                } catch (error) {
                    console.error(`Error analyzing ${note.file_name}:`, error);
                }
            }
            
            await this.consolidateProfile(client, genAI);
        } catch (error) {
            console.error('Error processing unprocessed notes:', error);
        } finally {
            await client.end();
        }
    }

    // 抽出した特性をDBに保存
    async updateProfileWithInsights(client, insights, sourceFileName) {
        const categories = ['values', 'interests', 'personality', 'thinking_patterns'];
        
        for (const category of categories) {
            if (insights[category] && insights[category].length > 0) {
                // 既存データの取得
                const existingQuery = `
                    SELECT content, source_notes FROM user_profile WHERE category = $1
                `;
                const existing = await client.query(existingQuery, [category]);
                
                let existingContent = [];
                let sourceNotes = [];
                
                if (existing.rows.length > 0) {
                    existingContent = existing.rows[0].content || [];
                    sourceNotes = existing.rows[0].source_notes || [];
                }
                
                // 新しいデータとマージ
                const merged = [...new Set([...existingContent, ...insights[category]])];
                const updatedSourceNotes = [...new Set([...sourceNotes, sourceFileName])];
                
                if (existing.rows.length > 0) {
                    await client.query(`
                        UPDATE user_profile 
                        SET content = $1, 
                            confidence_score = $2,
                            source_notes = $3,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE category = $4
                    `, [JSON.stringify(merged), insights.confidence, updatedSourceNotes, category]);
                } else {
                    await client.query(`
                        INSERT INTO user_profile (category, content, confidence_score, source_notes)
                        VALUES ($1, $2, $3, $4)
                    `, [category, JSON.stringify(merged), insights.confidence, [sourceFileName]]);
                }
            }
        }
    }

    // プロファイルの統合・整理
    async consolidateProfile(client, genAI) {
        try {
            const allProfilesQuery = `
                SELECT category, content FROM user_profile ORDER BY category
            `;
            const profiles = await client.query(allProfilesQuery);
            
            if (profiles.rows.length === 0) return;
            
            // 統合プロファイル生成
            const profileData = profiles.rows.reduce((acc, row) => {
                acc[row.category] = row.content;
                return acc;
            }, {});
            
            // 履歴記録
            await client.query(`
                INSERT INTO profile_update_history (update_type, processed_notes_count, new_insights)
                VALUES ('consolidation', $1, $2)
            `, [profiles.rows.length, JSON.stringify(profileData)]);
            
            console.log('Profile consolidation completed');
        } catch (error) {
            console.error('Error consolidating profile:', error);
        }
    }

    // 現在のプロファイルを取得
    async getCurrentProfile() {
        const client = await this.connectDB();
        
        try {
            const query = `
                SELECT category, content, confidence_score, updated_at 
                FROM user_profile 
                ORDER BY category
            `;
            
            const result = await client.query(query);
            
            return result.rows.reduce((profile, row) => {
                profile[row.category] = {
                    content: row.content,
                    confidence: row.confidence_score,
                    updated_at: row.updated_at
                };
                return profile;
            }, {});
        } catch (error) {
            console.error('Error getting current profile:', error);
            return {};
        } finally {
            await client.end();
        }
    }

    // 完全な処理実行
    async runFullProcess(genAI) {
        try {
            console.log('Starting profile processing...');
            
            // 1. テーブル初期化
            await this.initializeProfileTables();
            
            // 2. Obsidianからメモを取得
            const notes = await this.getAllNotesFromObsidian();
            console.log(`Found ${notes.length} notes from Obsidian`);
            
            // 3. メモをDBに保存
            await this.saveNotesToDB(notes);
            
            // 4. 未処理メモを分析
            await this.processUnprocessedNotes(genAI);
            
            console.log('Profile processing completed!');
        } catch (error) {
            console.error('Error in full process:', error);
        }
    }
}

module.exports = ProfileProcessor;
