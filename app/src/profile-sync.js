// profile-sync.js - AImolt プロファイル同期モジュール（適応型）
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
        this.isEnabled = !!this.config.githubToken;
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
                this.lastFetch = Date.now();
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
                    console.log(`💾 Using cached personal profile (${Math.round(cacheAge/1000/60/60)}h old)`);
                    this.lastFetch = new Date(data.cached_at).getTime();
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
                cache_duration_hours: this.config.cacheTimeMinutes / 60,
                bot_version: 'aimolt-v1.0.0'
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
            return null;
        }

        // キャッシュを確認
        const cached = await this.getLocalCache();
        if (cached) {
            this.cachedProfile = cached;
            return cached;
        }

        // GitHubから取得（リトライ機能付き）
        for (let retry = 0; retry < this.config.maxRetries; retry++) {
            const profile = await this.fetchFromGitHub();
            if (profile) {
                await this.saveLocalCache(profile);
                this.cachedProfile = profile;
                return profile;
            }
            
            if (retry < this.config.maxRetries - 1) {
                console.log(`🔄 Retrying profile fetch (${retry + 1}/${this.config.maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 全試行失敗時はフォールバック
        console.warn('⚠️ All profile fetch attempts failed, checking for expired cache...');
        try {
            const content = await fs.readFile(this.config.localPath, 'utf8');
            const data = JSON.parse(content);
            if (data.profile) {
                console.log('🆘 Using expired cache as fallback');
                this.cachedProfile = data.profile;
                return data.profile;
            }
        } catch (error) {
            console.warn('❌ No fallback cache available');
        }

        return null;
    }

    // 適応型プロンプト拡張生成（メッセージ内容に応じて情報を選択）
    generateAdaptivePromptExtension(profile, userMessage = '') {
        if (!profile || !profile.personal_characteristics) {
            return '';
        }

        const char = profile.personal_characteristics;
        const ctx = profile.contextual_information || {};
        const insights = profile.key_insights || [];
        
        let extension = '\n\n== ユーザーの関連特性 ==\n';
        let relevantInfo = [];
        
        // メッセージ内容を解析
        const message = userMessage.toLowerCase();
        
        // 技術・開発関連のキーワード
        const techKeywords = ['プログラム', 'コード', 'システム', 'アプリ', 'サイト', 'api', 'データベース', 'サーバー', 'git', 'github', 'バグ', 'エラー', 'デバッグ', 'テスト', 'リリース', 'デプロイ', 'フレームワーク', 'ライブラリ', 'アルゴリズム', 'セキュリティ'];
        
        // 学習・成長関連のキーワード
        const learningKeywords = ['学習', '勉強', '覚え', '習得', 'スキル', '知識', '理解', '身につけ', '向上', '成長', '改善', '練習', '研究', '調査', '分析', '理解', '習慣'];
        
        // 仕事・プロジェクト関連のキーワード
        const workKeywords = ['仕事', 'プロジェクト', 'タスク', '作業', '業務', '進捗', '締切', '計画', '設計', '開発', '実装', '運用', '保守', '管理', 'マネジメント', 'チーム', '会議', '報告', '相談'];
        
        // 効率・生産性関連のキーワード
        const efficiencyKeywords = ['効率', '生産性', '時間', '自動化', 'ツール', '改善', '最適化', 'ワークフロー', '手順', '方法', 'やり方', 'コツ', 'ベストプラクティス', '便利', '簡単', '速い', '早い'];

        // 技術関連の応答
        if (techKeywords.some(keyword => message.includes(keyword))) {
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`愛用技術: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            }
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`進行中: ${ctx.current_projects.slice(0, 2).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                const techThinking = char.thinking_patterns.filter(pattern => 
                    pattern.includes('論理') || pattern.includes('段階') || pattern.includes('具体') || pattern.includes('実用')
                );
                if (techThinking.length > 0) {
                    relevantInfo.push(`思考スタイル: ${techThinking.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 学習関連の応答
        else if (learningKeywords.some(keyword => message.includes(keyword))) {
            if (ctx.recent_learnings && ctx.recent_learnings.length > 0) {
                relevantInfo.push(`最近の学習: ${ctx.recent_learnings.slice(0, 3).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                const learningValues = char.core_values.filter(value => 
                    value.includes('学習') || value.includes('成長') || value.includes('向上') || value.includes('習得')
                );
                if (learningValues.length > 0) {
                    relevantInfo.push(`学習価値観: ${learningValues.join(', ')}`);
                }
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                relevantInfo.push(`学習アプローチ: ${char.thinking_patterns.slice(0, 2).join(', ')}`);
            }
        }
        
        // 仕事・プロジェクト関連の応答
        else if (workKeywords.some(keyword => message.includes(keyword))) {
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`現在のプロジェクト: ${ctx.current_projects.join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                const workValues = char.core_values.filter(value => 
                    value.includes('効率') || value.includes('品質') || value.includes('実用') || value.includes('問題解決')
                );
                if (workValues.length > 0) {
                    relevantInfo.push(`仕事の価値観: ${workValues.join(', ')}`);
                }
            }
            if (char.communication_style && char.communication_style.length > 0) {
                relevantInfo.push(`コミュニケーション: ${char.communication_style.slice(0, 2).join(', ')}`);
            }
        }
        
        // 効率・生産性関連の応答
        else if (efficiencyKeywords.some(keyword => message.includes(keyword))) {
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`効率化ツール: ${ctx.preferred_tools.slice(0, 3).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                const efficiencyValues = char.core_values.filter(value => 
                    value.includes('効率') || value.includes('自動化') || value.includes('生産性') || value.includes('最適化')
                );
                if (efficiencyValues.length > 0) {
                    relevantInfo.push(`効率性の価値観: ${efficiencyValues.join(', ')}`);
                }
            }
        }
        
        // 一般的な応答（上記に該当しない場合）
        else {
            if (char.interests_and_passions && char.interests_and_passions.length > 0) {
                relevantInfo.push(`興味分野: ${char.interests_and_passions.slice(0, 4).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                relevantInfo.push(`大切にすること: ${char.core_values.slice(0, 3).join(', ')}`);
            }
            if (char.communication_style && char.communication_style.length > 0) {
                relevantInfo.push(`好みのスタイル: ${char.communication_style.slice(0, 2).join(', ')}`);
            }
        }
        
        // 共通で重要な洞察を追加
        if (insights.length > 0) {
            const topInsights = insights.slice(0, 2);
            relevantInfo.push(`特徴: ${topInsights.join(' / ')}`);
        }
        
        // 情報がない場合のフォールバック
        if (relevantInfo.length === 0) {
            if (char.core_values && char.core_values.length > 0) {
                relevantInfo.push(`価値観: ${char.core_values.slice(0, 2).join(', ')}`);
            }
        }
        
        extension += relevantInfo.join('\n');
        if (relevantInfo.length > 0) {
            extension += '\n\n※ この情報を参考に、ユーザーの関心や価値観に沿った、より個人的で意味のある応答を提供してください。aimoltの基本性格は保持しつつ、より関連性の高い内容にしてください。';
        }
        
        return extension;
    }

    // 強制更新
    async forceRefresh() {
        console.log('🔄 Force refreshing profile...');
        this.cachedProfile = null;
        this.lastFetch = null;
        return await this.getProfile();
    }

    // プロファイルの状態を取得
    getStatus() {
        const cacheAge = this.lastFetch ? Date.now() - this.lastFetch : null;
        return {
            enabled: this.isProfileEnabled(),
            hasProfile: !!this.cachedProfile,
            lastFetch: this.lastFetch ? new Date(this.lastFetch).toISOString() : null,
            cacheAgeHours: cacheAge ? Math.round(cacheAge / 1000 / 60 / 60 * 10) / 10 : null,
            cacheTimeHours: this.config.cacheTimeMinutes / 60,
            nextRefreshIn: cacheAge ? Math.max(0, Math.round((this.config.cacheTimeMinutes * 60 * 1000 - cacheAge) / 1000 / 60 / 60 * 10) / 10) : null
        };
    }
}

module.exports = AimoltProfileSync;