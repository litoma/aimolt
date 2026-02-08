import { ConfigService } from '@nestjs/config';
import { Message } from 'discord.js';
export declare class MemoService {
    private readonly configService;
    private obsidianUrl;
    private obsidianApiKey;
    constructor(configService: ConfigService);
    handleMemo(message: Message, userId: string): Promise<void>;
    private sendMessage;
    private appendToObsidianDaily;
    private checkConfig;
    private extractEmbedContent;
}
