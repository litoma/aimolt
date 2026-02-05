import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits } from 'discord.js';

@Injectable()
export class DiscordService implements OnModuleInit, OnModuleDestroy {
    public client: Client;

    constructor(private configService: ConfigService) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMessageReactions,
            ],
        });
    }

    async onModuleInit() {
        const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN is not defined');
        }

        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user?.tag}! (NestJS)`);
        });

        await this.client.login(token);
    }

    async onModuleDestroy() {
        await this.client.destroy();
    }
}
