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

        // フォールバック: 期限切れキャッシュでも使用
        try {
            const fallbackContent = await fs.readFile(this.config.localPath, 'utf8');
            const fallbackData = JSON.parse(fallbackContent);
            console.log('🆘 Using expired cache as fallback');
            this.cachedProfile = fallbackData.profile;
            return fallbackData.profile;
        } catch (fallbackError) {
            console.warn('⚠️ No fallback cache available');
        }

        return null;
    }

    // 強制更新
    async forceRefresh() {
        console.log('🔄 Force refreshing profile...');
        this.cachedProfile = null;
        this.lastFetch = null;
        return await this.getProfile();
    }

    // 適応型プロンプト拡張を生成（メッセージ内容に応じて情報を選択）
    generateLikePromptExtension(profile, userMessage = '') {
        if (!profile || !profile.personal_characteristics) {
            return '';
        }

        const char = profile.personal_characteristics;
        const ctx = profile.contextual_information || {};
        const insights = profile.key_insights || [];
        
        let extension = '\n\n== 関連するユーザー特性 ==\n';
        let relevantInfo = [];
        
        // メッセージ内容に基づいて関連情報を抽出
        const message = userMessage.toLowerCase();
        
        // 技術・プログラミング関連
        if (message.includes('プログラム') || message.includes('コード') || message.includes('システム') || 
            message.includes('開発') || message.includes('api') || message.includes('github') ||
            message.includes('javascript') || message.includes('python') || message.includes('ai')) {
            
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`愛用技術: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            }
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`進行中: ${ctx.current_projects.slice(0, 3).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.some(p => p.includes('論理') || p.includes('効率'))) {
                const techPatterns = char.thinking_patterns.filter(p => p.includes('論理') || p.includes('効率') || p.includes('実用'));
                relevantInfo.push(`思考スタイル: ${techPatterns.slice(0, 2).join(', ')}`);
            }
        }
        
        // 学習・勉強関連
        else if (message.includes('学習') || message.includes('勉強') || message.includes('覚え') || 
                 message.includes('理解') || message.includes('教え') || message.includes('説明')) {
            
            if (ctx.recent_learnings && ctx.recent_learnings.length > 0) {
                relevantInfo.push(`最近の学習: ${ctx.recent_learnings.slice(0, 3).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.length > 0) {
                relevantInfo.push(`学習スタイル: ${char.thinking_patterns.slice(0, 2).join(', ')}`);
            }
            if (char.core_values && char.core_values.some(v => v.includes('学習') || v.includes('成長'))) {
                const learningValues = char.core_values.filter(v => v.includes('学習') || v.includes('成長') || v.includes('向上'));
                relevantInfo.push(`価値観: ${learningValues.slice(0, 2).join(', ')}`);
            }
        }
        
        // 仕事・プロジェクト関連
        else if (message.includes('仕事') || message.includes('プロジェクト') || message.includes('タスク') || 
                 message.includes('効率') || message.includes('自動化') || message.includes('時間')) {
            
            if (char.core_values && char.core_values.some(v => v.includes('効率') || v.includes('実用'))) {
                const workValues = char.core_values.filter(v => v.includes('効率') || v.includes('実用') || v.includes('最適'));
                relevantInfo.push(`仕事の価値観: ${workValues.slice(0, 2).join(', ')}`);
            }
            if (ctx.current_projects && ctx.current_projects.length > 0) {
                relevantInfo.push(`現在のプロジェクト: ${ctx.current_projects.slice(0, 3).join(', ')}`);
            }
            if (char.thinking_patterns && char.thinking_patterns.some(p => p.includes('問題解決') || p.includes('段階'))) {
                const workPatterns = char.thinking_patterns.filter(p => p.includes('問題解決') || p.includes('段階') || p.includes('実用'));
                relevantInfo.push(`アプローチ: ${workPatterns.slice(0, 2).join(', ')}`);
            }
        }
        
        // ツール・技術関連
        else if (message.includes('ツール') || message.includes('アプリ') || message.includes('ソフト') || 
                 message.includes('obsidian') || message.includes('vscode') || message.includes('docker')) {
            
            if (ctx.preferred_tools && ctx.preferred_tools.length > 0) {
                relevantInfo.push(`愛用ツール: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            }
            if (char.interests_and_passions && char.interests_and_passions.some(i => i.includes('技術') || i.includes('ツール'))) {
                const techInterests = char.interests_and_passions.filter(i => i.includes('技術') || i.includes('ツール') || i.includes('自動'));
                relevantInfo.push(`技術的興味: ${techInterests.slice(0, 3).join(', ')}`);
            }
        }
        
        // 一般的な関心事・雑談
        if (relevantInfo.length === 0) {
            // 基本的な特性情報を提供
            if (char.interests_and_passions && char.interests_and_passions.length > 0) {
                relevantInfo.push(`興味分野: ${char.interests_and_passions.slice(0, 3).join(', ')}`);
            }
            if (char.core_values && char.core_values.length > 0) {
                relevantInfo.push(`価値観: ${char.core_values.slice(0, 2).join(', ')}`);
            }
            if (char.communication_style && char.communication_style.length > 0) {
                relevantInfo.push(`好みのスタイル: ${char.communication_style.slice(0, 2).join(', ')}`);
            }
        }
        
        // 重要な洞察があれば追加
        if (insights.length > 0 && relevantInfo.length < 3) {
            relevantInfo.push(`特徴: ${insights.slice(0, 2).join(' / ')}`);
        }
        
        if (relevantInfo.length === 0) {
            return '';
        }
        
        extension += relevantInfo.join('\n') + '\n';
        extension += '\n※ 上記の情報を参考に、aimoltの基本性格を保ちながら、ユーザーの関心や価値観により沿った応答をしてください。';
        
        return extension;
    }

    // プロファイルの状態を取得
    getStatus() {
        const lastFetchTime = this.lastFetch ? new Date(this.lastFetch) : null;
        const cacheAge = this.lastFetch ? Date.now() - this.lastFetch : null;
        
        return {
            enabled: this.isProfileEnabled(),
            hasProfile: !!this.cachedProfile,
            lastFetch: lastFetchTime ? lastFetchTime.toISOString() : null,
            cacheAgeHours: cacheAge ? Math.round(cacheAge / 1000 / 60 / 60 * 10) / 10 : null,
            cacheTimeHours: this.config.cacheTimeMinutes / 60,
            isExpired: cacheAge ? cacheAge > (this.config.cacheTimeMinutes * 60 * 1000) : null
        };
    }
}

module.exports = AimoltProfileSync;