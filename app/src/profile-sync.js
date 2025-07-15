// profile-sync.js - プロファイル同期モジュール (aimolt専用)
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

class AimoltProfileSync {
    constructor() {
        this.config = {
            githubToken: process.env.GITHUB_TOKEN,
            owner: 'litoma',
            repo: 'obsidian',
            filePath: 'Profile/personal-profile.json',
            localPath: './profile/personal-profile.json',
            cacheTimeMinutes: 720, // 12時間キャッシュ
            maxRetries: 3,
            timeout: 10000
        };
        
        this.cachedProfile = null;
        this.lastFetch = null;
        this.isEnabled = !!this.config.githubToken; // トークンがある場合のみ有効
    }

    // プロファイルが有効かチェック
    isProfileEnabled() {
        return this.isEnabled && !!this.config.githubToken;
    }

    // GitHubからプロファイルを取得
    async fetchFromGitHub() {
        if (!this.isProfileEnabled()) {
            console.log('📋 Profile sync disabled (no GitHub token)');
            return null;
        }

        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.filePath}`;
        
        try {
            console.log('📡 Fetching personal profile from GitHub...');
            
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `token ${this.config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AImolt-Discord-Bot'
                },
                timeout: this.config.timeout
            });

            if (response.data.content) {
                const content = Buffer.from(response.data.content, 'base64').toString('utf8');
                const profile = JSON.parse(content);
                
                console.log('✅ Personal profile fetched successfully');
                return profile;
            }
            
        } catch (error) {
            console.warn('⚠️ Failed to fetch personal profile:', error.message);
            return null;
        }
    }

    // ローカルキャッシュを確認
    async getLocalCache() {
        try {
            const exists = await fs.access(this.config.localPath).then(() => true).catch(() => false);
            if (!exists) return null;

            const content = await fs.readFile(this.config.localPath, 'utf8');
            const data = JSON.parse(content);
            
            // キャッシュの有効期限チェック
            if (data.cached_at) {
                const cacheAge = Date.now() - new Date(data.cached_at).getTime();
                const maxAge = this.config.cacheTimeMinutes * 60 * 1000;
                
                if (cacheAge < maxAge) {
                    const ageHours = Math.round(cacheAge / 1000 / 60 / 60 * 10) / 10;
                    console.log(`💾 Using cached personal profile (${ageHours}h old)`);
                    return data.profile;
                }
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ Failed to read profile cache:', error.message);
            return null;
        }
    }

    // ローカルキャッシュに保存
    async saveLocalCache(profile) {
        if (!profile) return;
        
        try {
            await fs.mkdir(path.dirname(this.config.localPath), { recursive: true });
            
            const cacheData = {
                profile: profile,
                cached_at: new Date().toISOString(),
                bot_version: 'aimolt-v1.0.0',
                cache_duration_hours: this.config.cacheTimeMinutes / 60
            };
            
            await fs.writeFile(this.config.localPath, JSON.stringify(cacheData, null, 2), 'utf8');
            console.log('💾 Personal profile cached locally (12h cache)');
            
        } catch (error) {
            console.warn('⚠️ Failed to save profile cache:', error.message);
        }
    }

    // プロファイルを取得（メイン関数）
    async getProfile() {
        if (!this.isProfileEnabled()) {
            return null; // プロファイル機能無効
        }

        // キャッシュを確認
        const cached = await this.getLocalCache();
        if (cached) {
            this.cachedProfile = cached;
            return cached;
        }

        // GitHubから取得（リトライ機能付き）
        let retries = 0;
        while (retries < this.config.maxRetries) {
            try {
                const profile = await this.fetchFromGitHub();
                if (profile) {
                    await this.saveLocalCache(profile);
                    this.cachedProfile = profile;
                    this.lastFetch = Date.now();
                    return profile;
                }
                break;
            } catch (error) {
                retries++;
                if (retries < this.config.maxRetries) {
                    console.log(`🔄 Retry ${retries}/${this.config.maxRetries} in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.warn('❌ All retry attempts failed');
                }
            }
        }

        // フォールバック: 期限切れキャッシュを使用
        try {
            const fallbackContent = await fs.readFile(this.config.localPath, 'utf8');
            const fallbackData = JSON.parse(fallbackContent);
            console.log('🆘 Using expired cache as fallback');
            return fallbackData.profile;
        } catch (error) {
            console.warn('⚠️ No fallback cache available');
            return null;
        }
    }

    // 適応型プロファイル拡張（メッセージ内容に応じて情報を選択）
    generateAdaptiveProfileExtension(profile, userMessage = '') {
        if (!profile || !profile.personal_characteristics) {
            return '';
        }

        const char = profile.personal_characteristics;
        const ctx = profile.contextual_information || {};
        const insights = profile.key_insights || [];
        
        let extension = '\n\n== ユーザーの関連特性 ==\n';
        let relevantInfo = [];
        
        const message = userMessage.toLowerCase();
        
        // 技術・開発関連キーワード
        const techKeywords = ['プログラム', 'コード', 'システム', 'アプリ', 'サーバー', 'データベース', 'api', 'github', 'docker', 'javascript', 'python', 'react', 'node'];
        const isTechRelated = techKeywords.some(keyword => message.includes(keyword));
        
        // 学習・教育関連キーワード
        const learningKeywords = ['学習', '勉強', '覚え', '理解', '習得', '教え', '説明', '解説', '方法', 'やり方'];
        const isLearningRelated = learningKeywords.some(keyword => message.includes(keyword));
        
        // 仕事・プロジェクト関連キーワード
        const workKeywords = ['仕事', 'プロジェクト', 'タスク', '作業', '進捗', '完了', '締切', '計画', '管理', '効率'];
        const isWorkRelated = workKeywords.some(keyword => message.includes(keyword));
        
        // 技術関連の場合
        if (isTechRelated) {
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`愛用技術: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            }
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`進行中: ${ctx.current_projects.slice(0, 2).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                const techThinking = char.thinking_patterns.filter(pattern => 
                    pattern.includes('論理') || pattern.includes('段階') || pattern.includes('体系') || pattern.includes('効率')
                );
                if (techThinking.length > 0) {
                    relevantInfo.push(`思考スタイル: ${techThinking.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 学習関連の場合
        if (isLearningRelated) {
            if (ctx.recent_learnings && ctx.recent_learnings.length > 0) {
                relevantInfo.push(`最近の学習: ${ctx.recent_learnings.slice(0, 3).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                relevantInfo.push(`学習パターン: ${char.thinking_patterns.slice(0, 2).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                const learningValues = char.core_values.filter(value => 
                    value.includes('学習') || value.includes('成長') || value.includes('知識') || value.includes('理解')
                );
                if (learningValues.length > 0) {
                    relevantInfo.push(`学習価値観: ${learningValues.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 仕事・プロジェクト関連の場合
        if (isWorkRelated) {
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`現在のプロジェクト: ${ctx.current_projects.slice(0, 2).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                const workValues = char.core_values.filter(value => 
                    value.includes('効率') || value.includes('実用') || value.includes('品質') || value.includes('継続')
                );
                if (workValues.length > 0) {
                    relevantInfo.push(`仕事の価値観: ${workValues.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 一般的な場合（上記に該当しない、または追加情報として）
        if (relevantInfo.length < 2) {
            // 興味分野を追加
            if (char.interests_and_passions && char.interests_and_passions.length > 0) {
                relevantInfo.push(`興味分野: ${char.interests_and_passions.slice(0, 3).join(', ')}`);
            }
            
            // コミュニケーションスタイルを追加
            if (char.communication_style && char.communication_style.length > 0) {
                relevantInfo.push(`コミュニケーション: ${char.communication_style.slice(0, 2).join(', ')}`);
            }
            
            // 重要な洞察を追加
            if (insights.length > 0) {
                relevantInfo.push(`特徴: ${insights.slice(0, 2).join(' / ')}`);
            }
        }
        
        // 情報が多すぎる場合は制限
        if (relevantInfo.length > 4) {
            relevantInfo = relevantInfo.slice(0, 4);
        }
        
        if (relevantInfo.length > 0) {
            extension += relevantInfo.join('\n') + '\n';
            extension += '\n※ これらの特性を踏まえて、より個人的で関連性の高い応答をしてください。aimoltの基本的な明るい性格は保持してください。';
        } else {
            extension = ''; // 関連情報がない場合は拡張なし
        }
        
        return extension;
    }

    // 強制更新
    async forceRefresh() {
        console.log('🔄 Forcing profile refresh...');
        this.cachedProfile = null;
        this.lastFetch = null;
        
        // キャッシュファイルを削除
        try {
            await fs.unlink(this.config.localPath);
        } catch (error) {
            // ファイルが存在しない場合は無視
        }
        
        return await this.getProfile();
    }

    // プロファイルの状態を取得
    getStatus() {
        const cacheAge = this.lastFetch ? Date.now() - this.lastFetch : null;
        const cacheAgeHours = cacheAge ? Math.round(cacheAge / 1000 / 60 / 60 * 10) / 10 : null;
        
        return {
            enabled: this.isProfileEnabled(),
            hasProfile: !!this.cachedProfile,
            lastFetch: this.lastFetch ? new Date(this.lastFetch).toISOString() : null,
            cacheAgeHours: cacheAgeHours,
            cacheTimeHours: this.config.cacheTimeMinutes / 60,
            githubRepo: `${this.config.owner}/${this.config.repo}`,
            profilePath: this.config.filePath
        };
    }
}

module.exports = AimoltProfileSync;