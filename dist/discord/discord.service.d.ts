import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'discord.js';
export declare class DiscordService implements OnModuleInit, OnModuleDestroy {
    private configService;
    client: Client;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    startTyping(channel: any): () => void;
}
