import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { VADService } from './application/services/vad.service';
import { RelationshipService } from './application/services/relationship.service';
import { AnalysisService } from './application/services/analysis.service';
import { MemoryService } from './application/services/memory.service';
import { SupabaseEmotionRepository } from './infrastructure/repositories/supabase-emotion.repository';
import { SupabaseRelationshipRepository } from './infrastructure/repositories/supabase-relationship.repository';

import { SupabaseUserMemoryRepository } from './infrastructure/repositories/supabase-user-memory.repository';
import { IEmotionRepository } from './domain/repositories/emotion.repository.interface';
import { IRelationshipRepositoryToken } from './domain/repositories/relationship.repository.interface';
import { IUserMemoryRepository } from './domain/repositories/user-memory.repository.interface';

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
            provide: IUserMemoryRepository,
            useClass: SupabaseUserMemoryRepository,
        },

    ],
    exports: [VADService, RelationshipService, AnalysisService, MemoryService],
})
export class PersonalityModule { }
