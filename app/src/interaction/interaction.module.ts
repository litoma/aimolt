import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PersonalityModule } from '../personality/personality.module';
import { DiscordModule } from '../discord/discord.module';
import { LikeService } from './application/services/like.service';
import { MemoService } from './application/services/memo.service';
import { TranscriptionService } from './application/services/transcription.service';
import { ReactionGateway } from './interface/reaction.gateway';

@Module({
    imports: [CoreModule, PersonalityModule, DiscordModule],
    providers: [LikeService, MemoService, TranscriptionService, ReactionGateway],
    exports: [LikeService, MemoService, TranscriptionService],
})
export class InteractionModule { }
