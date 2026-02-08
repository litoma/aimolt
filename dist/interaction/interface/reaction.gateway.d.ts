import { OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { LikeService } from '../application/services/like.service';
import { MemoService } from '../application/services/memo.service';
import { TranscriptionService } from '../application/services/transcription.service';
import { MessageReaction, User, PartialMessageReaction, PartialUser } from 'discord.js';
export declare class ReactionGateway implements OnModuleInit {
    private readonly discordService;
    private readonly likeService;
    private readonly memoService;
    private readonly transcriptionService;
    constructor(discordService: DiscordService, likeService: LikeService, memoService: MemoService, transcriptionService: TranscriptionService);
    onModuleInit(): void;
    handleReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void>;
}
