const { Client } = require('pg');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

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
        
        // Supabaseクライアント
        this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        
        // 除外パターン（環境変数で完全に制御）
        this.excludePatterns = this.getExcludePatterns();
    }

    // 除外パターンの取得（環境変数で完全制御）
    getExcludePatterns() {
        // デフォルトの除外パターン
        const defaultExcludes = '.obsidian,.trash,Templates';
        
        // 環境変数から除外パターンを取得（デフォルトを含む）
        const envExcludes = process.env.OBSIDIAN_EXCLUDE_PATTERNS || defaultExcludes;
        
        return envExcludes.split(',').map(p => p.trim()).filter(p => p.length > 0);
    }

    // ファイルパスが除外対象かどうかチェック
    shouldExcludeFile(filePath) {
        return this.excludePatterns.some(pattern => {
            // パターンマッチング
            if (pattern.endsWith('/')) {
                // フォルダ配下すべて除外
                return filePath.startsWith(pattern) || filePath.startsWith(pattern.slice(0, -1) + '/');
            } else {
                // 完全一致または先頭一致
                return filePath === pattern || filePath.startsWith(pattern + '/');
            }
        });
    }

    async connectDB() {
        const client = new Client(this.dbConfig);
        await client.connect();
        return client;
    }

    // 改善版: 複数の方法でObsidianからすべてのメモを取得（除外機能付き）
    async getAllNotesFromObsidian() {
        try {
            console.log('Fetching all notes from Obsidian (including subdirectories)...');
            console.log('Exclude patterns:', this.excludePatterns);
            
            // 方法1: 検索を使ってすべてのMarkdownファイルを探す
            let allFiles = await this.searchAllMarkdownFiles();
            
            // 方法2: 失敗した場合は直接探索
            if (allFiles.length === 0) {
                console.log('Fallback: Using direct vault exploration...');
                allFiles = await this.exploreVaultDirectly();
            }
            
            // 除外フィルタリング
            const filteredFiles = allFiles.filter(filePath => {
                const excluded = this.shouldExcludeFile(filePath);
                if (excluded) {
                    console.log(`🚫 Excluded: ${filePath}`);
                }
                return !excluded;
            });
            
            console.log(`Found ${allFiles.length} total files, ${filteredFiles.length} after filtering`);
            
            const notes = [];
            const processedFiles = new Set();
            
            for (const filePath of filteredFiles) {
                if (filePath.endsWith('.md') && !processedFiles.has(filePath)) {
                    try {
                        const noteContent = await this.getNoteContent(filePath);
                        if (noteContent && noteContent.trim().length > 0) {
                            notes.push({
                                filename: filePath,
                                content: noteContent,
                                lastModified: new Date()
                            });
                            processedFiles.add(filePath);
                            console.log(`✓ Loaded: ${filePath}`);
                        }
                    } catch (noteError) {
                        console.error(`✗ Error fetching note ${filePath}:`, noteError.message);
                    }
                }
            }
            
            console.log(`Successfully loaded ${notes.length} notes`);
            return notes;
        } catch (error) {
            console.error('Error fetching notes from Obsidian:', error.message);
            return [];
        }
    }

    // 方法1: 検索を使ってすべてのMarkdownファイルを探す
    async searchAllMarkdownFiles() {
        const allFiles = [];
        
        try {
            console.log('Searching for all markdown files...');
            
            // よく使われる文字や記号で検索して、できるだけ多くのファイルを見つける
            const searchTerms = [
                '', // 空の検索（全ファイル）
                'the', 'and', 'a', 'to', 'of', 'in', 'for', 'on', 'with', 'as',
                '。', '、', '.', ',', ':', ';', '!', '?', '-', '_', '#',
                // 日本語の一般的な文字
                'の', 'が', 'を', 'に', 'は', 'で', 'と', 'も', 'から',
                // 英語の一般的な単語
                'it', 'be', 'have', 'do', 'say', 'get', 'make', 'go', 'know'
            ];
            
            const foundFiles = new Set();
            
            for (const term of searchTerms) {
                try {
                    const searchResults = await this.searchFiles(term);
                    let termCount = 0;
                    
                    for (const file of searchResults) {
                        if (file.filename && file.filename.endsWith('.md')) {
                            foundFiles.add(file.filename);
                            termCount++;
                        }
                    }
                    
                    console.log(`Search term "${term}": found ${termCount} files`);
                    
                    // 少し待機（APIレート制限対策）
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (searchError) {
                    console.error(`Search error for term "${term}":`, searchError.message);
                }
            }
            
            console.log(`Total unique files found via search: ${foundFiles.size}`);
            return Array.from(foundFiles);
        } catch (error) {
            console.error('Error in search method:', error.message);
            return [];
        }
    }

    // 方法2: 直接Vaultを探索
    async exploreVaultDirectly() {
        try {
            console.log('Exploring vault directly...');
            
            const response = await axios.get(`${this.obsidianConfig.baseURL}/vault/`, {
                headers: this.obsidianConfig.headers,
                timeout: 10000
            });
            
            const foundFiles = [];
            
            if (response.data && response.data.files) {
                console.log(`Root directory contains ${response.data.files.length} items`);
                
                for (const file of response.data.files) {
                    if (file.endsWith('.md')) {
                        foundFiles.push(file);
                        console.log(`Found markdown file: ${file}`);
                    }
                }
            }
            
            return foundFiles;
        } catch (error) {
            console.error('Error in direct vault exploration:', error.message);
            return [];
        }
    }

    // DBから除外対象のファイルを削除
    async cleanupExcludedFiles() {
        const client = await this.connectDB();
        
        try {
            console.log('Cleaning up excluded files from database...');
            
            // 現在DBにあるファイル一覧を取得
            const existingQuery = `
                SELECT id, file_name FROM obsidian_notes ORDER BY file_name
            `;
            const existingFiles = await client.query(existingQuery);
            
            let deletedCount = 0;
            const deletedFiles = [];
            
            for (const file of existingFiles.rows) {
                if (this.shouldExcludeFile(file.file_name)) {
                    try {
                        // PostgreSQLから削除
                        await client.query('DELETE FROM obsidian_notes WHERE id = $1', [file.id]);
                        
                        // Supabaseからも削除
                        try {
                            const { error } = await this.supabase
                                .from('obsidian_notes')
                                .delete()
                                .eq('file_name', file.file_name);
                            if (error) console.error('Supabase delete error:', error.message);
                        } catch (supabaseError) {
                            console.error('Supabase delete error:', supabaseError.message);
                        }
                        
                        deletedFiles.push(file.file_name);
                        deletedCount++;
                        console.log(`🗑️ Deleted: ${file.file_name}`);
                    } catch (deleteError) {
                        console.error(`Error deleting ${file.file_name}:`, deleteError.message);
                    }
                }
            }
            
            console.log(`Cleanup completed: ${deletedCount} files deleted`);
            
            if (deletedFiles.length > 0) {
                // プロファイルも再構築（除外されたファイルの情報を除去）
                await this.rebuildProfileAfterCleanup(client, deletedFiles);
            }
            
        } catch (error) {
            console.error('Error during cleanup:', error);
        } finally {
            await client.end();
        }
    }

    // 除外ファイル削除後のプロファイル再構築
    async rebuildProfileAfterCleanup(client, deletedFiles) {
        try {
            console.log('Rebuilding profile after cleanup...');
            
            const categories = ['values', 'interests', 'personality', 'thinking_patterns'];
            
            for (const category of categories) {
                const profileQuery = `
                    SELECT id, source_notes FROM user_profile WHERE category = $1
                `;
                const profileResult = await client.query(profileQuery, [category]);
                
                if (profileResult.rows.length > 0) {
                    const profile = profileResult.rows[0];
                    const currentSourceNotes = profile.source_notes || [];
                    
                    // 削除されたファイルをsource_notesから除去
                    const updatedSourceNotes = currentSourceNotes.filter(
                        note => !deletedFiles.includes(note)
                    );
                    
                    if (updatedSourceNotes.length !== currentSourceNotes.length) {
                        // PostgreSQL更新
                        await client.query(`
                            UPDATE user_profile 
                            SET source_notes = $1, updated_at = CURRENT_TIMESTAMP
                            WHERE id = $2
                        `, [updatedSourceNotes, profile.id]);
                        
                        // Supabase更新
                        try {
                            const { error } = await this.supabase
                                .from('user_profile')
                                .update({
                                    source_notes: updatedSourceNotes,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('category', category);
                            if (error) console.error('Supabase profile cleanup error:', error.message);
                        } catch (supabaseError) {
                            console.error('Supabase profile cleanup error:', supabaseError.message);
                        }
                        
                        console.log(`Updated ${category} profile: removed ${currentSourceNotes.length - updatedSourceNotes.length} source references`);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error rebuilding profile after cleanup:', error);
        }
    }

    // 検索APIを使用
    async searchFiles(query) {
        try {
            const response = await axios.post(`${this.obsidianConfig.baseURL}/search/simple/`, null, {
                headers: this.obsidianConfig.headers,
                params: { query },
                timeout: 8000
            });
            return response.data || [];
        } catch (error) {
            if (error.code !== 'ECONNABORTED') {
                console.error(`Search error for "${query}":`, error.message);
            }
            return [];
        }
    }

    // 個別ファイルの内容を取得
    async getNoteContent(filePath) {
        try {
            const response = await axios.get(
                `${this.obsidianConfig.baseURL}/vault/${encodeURIComponent(filePath)}`,
                { 
                    headers: this.obsidianConfig.headers, 
                    timeout: 8000 
                }
            );
            return response.data;
        } catch (error) {
            console.error(`Error getting content for ${filePath}:`, error.message);
            return null;
        }
    }

    // デバッグ用: Obsidian API の動作確認
    async debugObsidianAPI() {
        console.log('=== Obsidian API Debug ===');
        console.log('Exclude patterns:', this.excludePatterns);
        
        try {
            // APIの基本動作確認
            console.log('1. Testing basic API connection...');
            const testResponse = await axios.get(`${this.obsidianConfig.baseURL}/vault/`, {
                headers: this.obsidianConfig.headers,
                timeout: 5000
            });
            
            console.log('✓ API connection successful');
            console.log('Response structure:', Object.keys(testResponse.data));
            
            if (testResponse.data.files) {
                console.log(`Files in root: ${testResponse.data.files.length}`);
                
                // 除外フィルタのテスト
                const filteredFiles = testResponse.data.files.filter(file => !this.shouldExcludeFile(file));
                console.log(`Files after filtering: ${filteredFiles.length}`);
                console.log('First 10 filtered files:', filteredFiles.slice(0, 10));
                
                // 除外されたファイル
                const excludedFiles = testResponse.data.files.filter(file => this.shouldExcludeFile(file));
                if (excludedFiles.length > 0) {
                    console.log('Excluded files:', excludedFiles);
                }
            }
            
            // 検索機能の確認
            console.log('\n2. Testing search functionality...');
            const searchTest = await this.searchFiles('');
            console.log(`Search results count: ${searchTest.length}`);
            
            if (searchTest.length > 0) {
                console.log('Sample search results:');
                searchTest.slice(0, 5).forEach((result, index) => {
                    const excluded = this.shouldExcludeFile(result.filename || '');
                    console.log(`  ${index + 1}. ${result.filename || 'No filename'} ${excluded ? '(EXCLUDED)' : ''}`);
                });
            }
            
        } catch (error) {
            console.error('❌ Debug error:', error.message);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
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

    // プロファイルテーブルの初期化（PostgreSQL + Supabase）
    async initializeProfileTables() {
        // PostgreSQL初期化
        const client = await this.connectDB();
        
        try {
            // メモファイル管理テーブル（file_nameを500文字に拡張）
            await client.query(`
                CREATE TABLE IF NOT EXISTS obsidian_notes (
                    id SERIAL PRIMARY KEY,
                    file_name VARCHAR(500) NOT NULL UNIQUE,
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
            
            console.log('PostgreSQL profile tables initialized successfully');
        } catch (error) {
            console.error('Error initializing PostgreSQL profile tables:', error);
        } finally {
            await client.end();
        }

        // Supabaseテーブル存在確認（テーブルが存在しない場合は警告を出すのみ）
        try {
            const { data, error } = await this.supabase
                .from('obsidian_notes')
                .select('id')
                .limit(1);
            
            if (error && error.code === '42P01') {
                console.warn('⚠️ Supabase tables not found. Please create them manually using the provided SQL.');
            } else {
                console.log('✅ Supabase profile tables are available');
            }
        } catch (error) {
            console.warn('⚠️ Could not verify Supabase tables:', error.message);
        }
    }

    // メモを保存/更新（PostgreSQL + Supabase）
    async saveNotesToDB(notes) {
        if (notes.length === 0) return;
        
        const client = await this.connectDB();
        
        try {
            for (const note of notes) {
                // PostgreSQL処理
                const existingQuery = `
                    SELECT id, last_modified FROM obsidian_notes 
                    WHERE file_name = $1
                `;
                const existing = await client.query(existingQuery, [note.filename]);
                
                if (existing.rows.length === 0) {
                    // PostgreSQL新規作成
                    await client.query(`
                        INSERT INTO obsidian_notes (file_name, content, last_modified)
                        VALUES ($1, $2, $3)
                    `, [note.filename, note.content, note.lastModified]);
                    
                    // Supabase新規作成
                    try {
                        const { error } = await this.supabase
                            .from('obsidian_notes')
                            .insert({
                                file_name: note.filename,
                                content: note.content,
                                last_modified: note.lastModified.toISOString()
                            });
                        if (error) console.error('Supabase insert error:', error.message);
                    } catch (supabaseError) {
                        console.error('Supabase insert error:', supabaseError.message);
                    }
                    
                    console.log(`New note saved: ${note.filename}`);
                } else {
                    // PostgreSQL更新
                    await client.query(`
                        UPDATE obsidian_notes 
                        SET content = $1, last_modified = $2, processed_at = NULL, updated_at = CURRENT_TIMESTAMP
                        WHERE file_name = $3
                    `, [note.content, note.lastModified, note.filename]);
                    
                    // Supabase更新
                    try {
                        const { error } = await this.supabase
                            .from('obsidian_notes')
                            .update({
                                content: note.content,
                                last_modified: note.lastModified.toISOString(),
                                processed_at: null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('file_name', note.filename);
                        if (error) console.error('Supabase update error:', error.message);
                    } catch (supabaseError) {
                        console.error('Supabase update error:', supabaseError.message);
                    }
                    
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
                    
                    // PostgreSQL処理済みマーク
                    await client.query(`
                        UPDATE obsidian_notes 
                        SET processed_at = CURRENT_TIMESTAMP 
                        WHERE id = $1
                    `, [note.id]);
                    
                    // Supabase処理済みマーク
                    try {
                        const { error } = await this.supabase
                            .from('obsidian_notes')
                            .update({ processed_at: new Date().toISOString() })
                            .eq('file_name', note.file_name);
                        if (error) console.error('Supabase processed_at update error:', error.message);
                    } catch (supabaseError) {
                        console.error('Supabase processed_at update error:', supabaseError.message);
                    }
                    
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

    // 抽出した特性をDBに保存（PostgreSQL + Supabase）
    async updateProfileWithInsights(client, insights, sourceFileName) {
        const categories = ['values', 'interests', 'personality', 'thinking_patterns'];
        
        for (const category of categories) {
            if (insights[category] && insights[category].length > 0) {
                // PostgreSQL処理
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
                    // PostgreSQL更新
                    await client.query(`
                        UPDATE user_profile 
                        SET content = $1, 
                            confidence_score = $2,
                            source_notes = $3,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE category = $4
                    `, [JSON.stringify(merged), insights.confidence, updatedSourceNotes, category]);
                    
                    // Supabase更新
                    try {
                        const { error } = await this.supabase
                            .from('user_profile')
                            .update({
                                content: merged,
                                confidence_score: insights.confidence,
                                source_notes: updatedSourceNotes,
                                updated_at: new Date().toISOString()
                            })
                            .eq('category', category);
                        if (error) console.error('Supabase profile update error:', error.message);
                    } catch (supabaseError) {
                        console.error('Supabase profile update error:', supabaseError.message);
                    }
                } else {
                    // PostgreSQL新規作成
                    await client.query(`
                        INSERT INTO user_profile (category, content, confidence_score, source_notes)
                        VALUES ($1, $2, $3, $4)
                    `, [category, JSON.stringify(merged), insights.confidence, [sourceFileName]]);
                    
                    // Supabase新規作成
                    try {
                        const { error } = await this.supabase
                            .from('user_profile')
                            .insert({
                                category: category,
                                content: merged,
                                confidence_score: insights.confidence,
                                source_notes: [sourceFileName]
                            });
                        if (error) console.error('Supabase profile insert error:', error.message);
                    } catch (supabaseError) {
                        console.error('Supabase profile insert error:', supabaseError.message);
                    }
                }
            }
        }
    }

    // プロファイルの統合・整理（PostgreSQL + Supabase）
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
            
            // PostgreSQL履歴記録
            await client.query(`
                INSERT INTO profile_update_history (update_type, processed_notes_count, new_insights)
                VALUES ('consolidation', $1, $2)
            `, [profiles.rows.length, JSON.stringify(profileData)]);
            
            // Supabase履歴記録
            try {
                const { error } = await this.supabase
                    .from('profile_update_history')
                    .insert({
                        update_type: 'consolidation',
                        processed_notes_count: profiles.rows.length,
                        new_insights: JSON.stringify(profileData)
                    });
                if (error) console.error('Supabase history insert error:', error.message);
            } catch (supabaseError) {
                console.error('Supabase history insert error:', supabaseError.message);
            }
            
            console.log('Profile consolidation completed');
        } catch (error) {
            console.error('Error consolidating profile:', error);
        }
    }

    // 現在のプロファイルを取得（PostgreSQL優先、Supabaseフォールバック）
    async getCurrentProfile() {
        const client = await this.connectDB();
        
        try {
            const query = `
                SELECT category, content, confidence_score, updated_at 
                FROM user_profile 
                ORDER BY category
            `;
            
            const result = await client.query(query);
            
            if (result.rows.length > 0) {
                return result.rows.reduce((profile, row) => {
                    profile[row.category] = {
                        content: row.content,
                        confidence: row.confidence_score,
                        updated_at: row.updated_at
                    };
                    return profile;
                }, {});
            }
        } catch (error) {
            console.error('Error getting profile from PostgreSQL:', error);
        } finally {
            await client.end();
        }
        
        // PostgreSQLで失敗した場合、Supabaseから取得
        try {
            const { data, error } = await this.supabase
                .from('user_profile')
                .select('category, content, confidence_score, updated_at')
                .order('category');
            
            if (error) {
                console.error('Error getting profile from Supabase:', error.message);
                return {};
            }
            
            return data.reduce((profile, row) => {
                profile[row.category] = {
                    content: row.content,
                    confidence: row.confidence_score,
                    updated_at: row.updated_at
                };
                return profile;
            }, {});
        } catch (error) {
            console.error('Error getting profile from Supabase:', error);
            return {};
        }
    }

    // 完全な処理実行
    async runFullProcess(genAI) {
        try {
            console.log('Starting profile processing...');
            
            // 1. テーブル初期化
            await this.initializeProfileTables();
            
            // 2. デバッグ情報（必要に応じて）
            if (process.env.NODE_ENV === 'development' || process.env.OBSIDIAN_DEBUG === 'true') {
                await this.debugObsidianAPI();
            }
            
            // 3. 除外ファイルのクリーンアップ
            await this.cleanupExcludedFiles();
            
            // 4. Obsidianからメモを取得
            const notes = await this.getAllNotesFromObsidian();
            console.log(`Found ${notes.length} notes from Obsidian`);
            
            // 5. メモをDBに保存
            await this.saveNotesToDB(notes);
            
            // 6. 未処理メモを分析
            await this.processUnprocessedNotes(genAI);
            
            console.log('Profile processing completed!');
        } catch (error) {
            console.error('Error in full process:', error);
        }
    }
}

module.exports = ProfileProcessor;