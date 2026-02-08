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

        this.client.on('messageCreate', (message) => {
            console.log(`[DEBUG] DiscordService received message: ${message.content} from ${message.author.tag}`);
        });

        await this.client.login(token);
    }

    async onModuleDestroy() {
        await this.client.destroy();
    }

    /**
     * Starts sending typing indicator to the channel every 9 seconds.
     * Returns a function to stop the typing indicator.
     */
    startTyping(channel: any): () => void {
        // Initial typing
        if (channel.sendTyping) {
            channel.sendTyping().catch(console.error);
        }

        // Interval to keep it going (Discord typing expires after 10s)
        const interval = setInterval(() => {
            if (channel.sendTyping) {
                channel.sendTyping().catch(console.error);
            }
        }, 9000);

        return () => clearInterval(interval);
    }
}
