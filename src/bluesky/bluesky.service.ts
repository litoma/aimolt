import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BskyAgent } from '@atproto/api';

@Injectable()
export class BlueskyService implements OnModuleInit {
    private readonly logger = new Logger(BlueskyService.name);
    private agent: BskyAgent;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        this.agent = new BskyAgent({
            service: 'https://bsky.social',
        });
        await this.login();
    }

    private async login() {
        const identifier = this.configService.get<string>('BLUESKY_IDENTIFIER');
        const password = this.configService.get<string>('BLUESKY_APP_PASSWORD');

        if (!identifier || !password) {
            this.logger.warn('Bluesky credentials not found. Skipping login.');
            return;
        }

        try {
            await this.agent.login({ identifier, password });
            this.logger.log('Logged in to Bluesky successfully.');
        } catch (error) {
            this.logger.error('Failed to login to Bluesky', error);
        }
    }

    async post(text: string) {
        if (!this.agent.hasSession) {
            await this.login();
        }

        if (!this.agent.hasSession) {
            throw new Error('Bluesky session not active');
        }

        try {
            const result = await this.agent.post({
                text: text,
                createdAt: new Date().toISOString(),
            });
            this.logger.log(`Posted to Bluesky: ${text}`);
            return result;
        } catch (error) {
            this.logger.error('Failed to post to Bluesky', error);
            throw error;
        }
    }
}
