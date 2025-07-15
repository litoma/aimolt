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
                    const cacheHours = Math.round(cacheAge / 1000 / 60 / 60 * 10) / 10;
                    console.log(`💾 Using cached personal profile (${cacheHours}h old)`);
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
        let lastError = null;
        for (let retry = 0; retry < this.config.maxRetries; retry++) {
            try {
                const profile = await this.fetchFromGitHub();
                if (profile) {
                    await this.saveLocalCache(profile);
                    this.cachedProfile = profile;
                    this.lastFetch = Date.now();
                    return profile;
                }
            } catch (error) {
                lastError = error;
                if (retry < this.config.maxRetries - 1) {
                    console.log(`🔄 Retry ${retry + 1}/${this.config.maxRetries} in 2 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        // 全てのリトライが失敗した場合、期限切れキャッシュでもフォールバック
        try {
            const fallbackContent = await fs.readFile(this.config.localPath, 'utf8');
            const fallbackData = JSON.parse(fallbackContent);
            console.log('🆘 Using expired cache as fallback');
            return fallbackData.profile;
        } catch (fallbackError) {
            console.warn('❌ No fallback cache available:', lastError?.message || 'Unknown error');
            return null;
        }
    }

    // 適応型プロファイル拡張生成（メッセージ内容に応じて情報を選択）
    generateAdaptiveExtension(profile, userMessage = '') {
        if (!profile || !profile.personal_characteristics) {
            return '';
        }

        const char = profile.personal_characteristics;
        const ctx = profile.contextual_information || {};
        const message = userMessage.toLowerCase();
        
        let extension = '\n\n== 関連するユーザー特性 ==\n';
        let relevantInfo = [];
        
        // 技術・開発関連キーワード
        const techKeywords = ['プログラム', 'コード', 'システム', 'アプリ', 'bot', 'api', 'github', 'docker', 'node', 'javascript'];
        const isTechRelated = techKeywords.some(keyword => message.includes(keyword));
        
        // 学習・知識関連キーワード
        const learningKeywords = ['学習', '勉強', '覚え', '理解', '知識', '教え', '説明'];
        const isLearningRelated = learningKeywords.some(keyword => message.includes(keyword));
        
        // 効率・生産性関連キーワード
        const efficiencyKeywords = ['効率', '自動', '時間', '改善', '最適化', 'おすすめ'];
        const isEfficiencyRelated = efficiencyKeywords.some(keyword => message.includes(keyword));

        // 技術関連の場合
        if (isTechRelated) {
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`愛用技術: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            }
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`進行中プロジェクト: ${ctx.current_projects.slice(0, 2).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                const techThinking = char.thinking_patterns.filter(pattern => 
                    pattern.includes('論理') || pattern.includes('段階') || pattern.includes('具体')
                );
                if (techThinking.length > 0) {
                    relevantInfo.push(`技術的思考: ${techThinking.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 学習関連の場合
        if (isLearningRelated) {
            if (ctx.recent_learnings && ctx.recent_learnings.length > 0) {
                relevantInfo.push(`最近の学習: ${ctx.recent_learnings.slice(0, 3).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                relevantInfo.push(`学習スタイル: ${char.thinking_patterns.slice(0, 2).join(', ')}`);
            }
            if (char.interests_and_passions && char.interests_and_passions.length > 0) {
                const learningInterests = char.interests_and_passions.filter(interest =>
                    interest.includes('AI') || interest.includes('技術') || interest.includes('学習')
                );
                if (learningInterests.length > 0) {
                    relevantInfo.push(`学習興味: ${learningInterests.slice(0, 2).join(', ')}`);
                }
            }
        }
        
        // 効率・生産性関連の場合
        if (isEfficiencyRelated) {
            if (char.core_values && char.core_values.length > 0) {
                const efficiencyValues = char.core_values.filter(value =>
                    value.includes('効率') || value.includes('実用') || value.includes('最適')
                );
                if (efficiencyValues.length > 0) {
                    relevantInfo.push(`重視する価値: ${efficiencyValues.slice(0, 2).join(', ')}`);
                }
            }
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`効率化ツール: ${ctx.preferred_tools.slice(0, 3).join(', ')}`);
            }
        }

        // 一般的な場合（上記のいずれにも該当しない）
        if (relevantInfo.length === 0) {
            // 基本的な興味・関心
            if (char.interests_and_passions && char.interests_and_passions.length > 0) {
                relevantInfo.push(`興味分野: ${char.interests_and_passions.slice(0, 3).join(', ')}`);
            }
            
            // 核となる価値観
            if (char.core_values && char.core_values.length > 0) {
                relevantInfo.push(`価値観: ${char.core_values.slice(0, 2).join(', ')}`);
            }
            
            // コミュニケーションスタイル
            if (char.communication_style && char.communication_style.length > 0) {
                relevantInfo.push(`コミュニケーション: ${char.communication_style.slice(0, 2).join(', ')}`);
            }
        }

        // 関連情報が取得できた場合のみ拡張を追加
        if (relevantInfo.length > 0) {
            extension += relevantInfo.join('\n') + '\n';
            extension += '\n※ これらの特性を参考に、より個人的で関連性の高い応答を心がけてください。aimoltの基本的な性格は保持してください。';
            return extension;
        }

        return '';
    }

    // プロファイルの状態を取得
    getStatus() {
        const status = {
            enabled: this.isProfileEnabled(),
            hasProfile: !!this.cachedProfile,
            lastFetch: this.lastFetch ? new Date(this.lastFetch).toISOString() : null,
            cacheHours: this.config.cacheTimeMinutes / 60,
            maxRetries: this.config.maxRetries
        };

        // キャッシュの残り時間を計算
        if (this.lastFetch) {
            const elapsed = Date.now() - this.lastFetch;
            const remaining = (this.config.cacheTimeMinutes * 60 * 1000) - elapsed;
            status.cacheRemainingHours = Math.max(0, remaining / 1000 / 60 / 60);
        }

        return status;
    }

    // 手動更新機能
    async forceRefresh() {
        console.log('🔄 Forcing profile refresh...');
        this.cachedProfile = null;
        this.lastFetch = null;
        return await this.getProfile();
    }
}

module.exports = AimoltProfileSync;