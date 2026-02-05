import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

@Injectable()
export class ProfileSyncService {
    private readonly logger = new Logger(ProfileSyncService.name);
    private readonly config: any;
    private cachedProfile: any = null;
    private lastFetch: number | null = null;

    constructor(private readonly configService: ConfigService) {
        this.config = {
            githubToken: this.configService.get<string>('GITHUB_TOKEN'),
            owner: 'litoma',
            repo: 'obsidian',
            filePath: 'Profile/personal-profile.json',
            localPath: path.resolve(process.cwd(), 'profile/personal-profile.json'),
            cacheTimeMinutes: 720, // 12 hours
            maxRetries: 3,
            timeout: 10000
        };
    }

    isProfileEnabled(): boolean {
        return !!this.config.githubToken;
    }

    async getProfile(): Promise<any> {
        if (!this.isProfileEnabled()) {
            return null;
        }

        const cached = await this.getLocalCache();
        if (cached) {
            this.cachedProfile = cached;
            return cached;
        }

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
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    this.logger.warn('All retry attempts failed');
                }
            }
        }

        // Fallback
        try {
            const fallbackContent = await readFileAsync(this.config.localPath, 'utf8');
            const fallbackData = JSON.parse(fallbackContent);
            this.logger.log('Using expired cache as fallback');
            this.cachedProfile = fallbackData.profile;
            return fallbackData.profile;
        } catch (error) {
            this.logger.warn('No fallback cache available');
        }

        return null;
    }

    async forceRefresh(): Promise<any> {
        this.logger.log('Force refreshing profile...');
        this.cachedProfile = null;
        this.lastFetch = null;
        return await this.getProfile();
    }

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

    generateLikePromptExtension(profile: any, userMessage: string = ''): string {
        if (!profile || !profile.personal_characteristics) {
            return '';
        }

        const char = profile.personal_characteristics;
        const ctx = profile.contextual_information || {};
        const insights = profile.key_insights || [];

        let extension = '\n\n== 関連するユーザー特性 ==\n';
        let relevantInfo: string[] = [];
        const message = userMessage.toLowerCase();

        // Technical
        if (message.includes('プログラム') || message.includes('コード') || message.includes('システム') ||
            message.includes('開発') || message.includes('api') || message.includes('github') ||
            message.includes('javascript') || message.includes('python') || message.includes('ai')) {

            if (ctx.preferred_tools?.length > 0) relevantInfo.push(`愛用技術: ${ctx.preferred_tools.slice(0, 4).join(', ')}`);
            if (ctx.current_projects?.length > 0) relevantInfo.push(`進行中: ${ctx.current_projects.slice(0, 3).join(', ')}`);
            if (char.thinking_patterns?.some((p: string) => p.includes('論理') || p.includes('効率'))) {
                relevantInfo.push(`思考スタイル: ${char.thinking_patterns.filter((p: string) => p.includes('論理') || p.includes('効率') || p.includes('実用')).slice(0, 2).join(', ')}`);
            }
        }
        // Learning
        else if (message.includes('学習') || message.includes('勉強') || message.includes('覚え') ||
            message.includes('理解') || message.includes('教え') || message.includes('説明')) {
            if (ctx.recent_learnings?.length > 0) relevantInfo.push(`最近の学習: ${ctx.recent_learnings.slice(0, 3).join(', ')}`);
            if (char.thinking_patterns?.length > 0) relevantInfo.push(`学習スタイル: ${char.thinking_patterns.slice(0, 2).join(', ')}`);
        }

        // Use generic info if empty
        if (relevantInfo.length === 0) {
            if (char.interests_and_passions?.length > 0) relevantInfo.push(`興味分野: ${char.interests_and_passions.slice(0, 3).join(', ')}`);
            if (char.core_values?.length > 0) relevantInfo.push(`価値観: ${char.core_values.slice(0, 2).join(', ')}`);
        }

        if (relevantInfo.length === 0) return '';

        extension += relevantInfo.join('\n') + '\n';
        extension += '\n※ 上記の情報を参考に、aimoltの基本性格を保ちながら、ユーザーの関心や価値観により沿った応答をしてください。';

        return extension;
    }

    private async fetchFromGitHub(): Promise<any> {
        if (!this.isProfileEnabled()) return null;

        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.filePath}`;
        try {
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
                this.lastFetch = Date.now();
                return profile;
            }
        } catch (error) {
            this.logger.warn(`Failed to fetch personal profile: ${error.message}`);
        }
        return null;
    }

    private async getLocalCache(): Promise<any> {
        try {
            if (!fs.existsSync(this.config.localPath)) return null;

            const content = await readFileAsync(this.config.localPath, 'utf8');
            const data = JSON.parse(content);

            if (data.cached_at) {
                const cacheAge = Date.now() - new Date(data.cached_at).getTime();
                const maxAge = this.config.cacheTimeMinutes * 60 * 1000;
                if (cacheAge < maxAge) {
                    this.logger.log(`Using cached personal profile (${Math.round(cacheAge / 1000 / 60 / 60)}h old)`);
                    this.lastFetch = new Date(data.cached_at).getTime();
                    return data.profile;
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to read profile cache: ${error.message}`);
        }
        return null;
    }

    private async saveLocalCache(profile: any): Promise<void> {
        try {
            const dir = path.dirname(this.config.localPath);
            if (!fs.existsSync(dir)) await mkdirAsync(dir, { recursive: true });

            const cacheData = {
                profile: profile,
                cached_at: new Date().toISOString(),
                bot_version: 'aimolt-v2.0.0', // Updated version
                cache_duration_hours: this.config.cacheTimeMinutes / 60
            };

            await writeFileAsync(this.config.localPath, JSON.stringify(cacheData, null, 2), 'utf8');
        } catch (error) {
            this.logger.warn(`Failed to save profile cache: ${error.message}`);
        }
    }
}
