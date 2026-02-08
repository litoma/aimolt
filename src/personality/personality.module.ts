import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { VADService } from './application/services/vad.service';
import { RelationshipService } from './application/services/relationship.service';
import { AnalysisService } from './application/services/analysis.service';
import { MemoryService } from './application/services/memory.service';
import { SupabaseEmotionRepository } from './infrastructure/repositories/supabase-emotion.repository';
import { SupabaseRelationshipRepository } from './infrastructure/repositories/supabase-relationship.repository';
import { SupabaseConversationAnalysisRepository } from './infrastructure/repositories/supabase-conversation-analysis.repository';
import { SupabaseUserMemoryRepository } from './infrastructure/repositories/supabase-user-memory.repository';
import { SupabaseRelationshipHistoryRepository } from './infrastructure/repositories/supabase-relationship-history.repository';
import { IEmotionRepository } from './domain/repositories/emotion.repository.interface';
import { IRelationshipRepositoryToken } from './domain/repositories/relationship.repository.interface';
import { IConversationAnalysisRepository } from './domain/repositories/conversation-analysis.repository.interface';
import { IUserMemoryRepository } from './domain/repositories/user-memory.repository.interface';
import { IRelationshipHistoryRepository } from './domain/repositories/relationship-history.repository.interface';

import { PersonalityGateway } from './interface/personality.gateway';
import { DiscordModule } from '../discord/discord.module';

@Module({
    imports: [CoreModule, DiscordModule],
    providers: [
        PersonalityGateway,
        VADService,
        RelationshipService,
        AnalysisService,
        MemoryService,
        {
            provide: IEmotionRepository,
            useClass: SupabaseEmotionRepository,
        },
        {
            provide: IRelationshipRepositoryToken,
            useClass: SupabaseRelationshipRepository,
        },
        {
            provide: IConversationAnalysisRepository,
            useClass: SupabaseConversationAnalysisRepository,
        },
        {
            provide: IUserMemoryRepository,
            useClass: SupabaseUserMemoryRepository,
        },
        {
            provide: IRelationshipHistoryRepository,
            useClass: SupabaseRelationshipHistoryRepository,
        },
    ],
    exports: [VADService, RelationshipService, AnalysisService, MemoryService],
})
export class PersonalityModule { }
