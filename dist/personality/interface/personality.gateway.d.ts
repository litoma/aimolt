import { OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { VADService } from '../services/vad.service';
import { RelationshipService } from '../services/relationship.service';
import { Message } from 'discord.js';
export declare class PersonalityGateway implements OnModuleInit {
    private readonly discordService;
    private readonly vadService;
    private readonly relationshipService;
    constructor(discordService: DiscordService, vadService: VADService, relationshipService: RelationshipService);
    onModuleInit(): void;
    handleMessage(message: Message): Promise<void>;
    private handleStatus;
}
