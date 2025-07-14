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