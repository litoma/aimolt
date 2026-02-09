import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { VADService } from './services/vad.service';
import { RelationshipService } from './services/relationship.service';
import { AnalysisService } from './services/analysis.service';
import { MemoryService } from './services/memory.service';
import { SupabaseEmotionRepository } from './repositories/supabase-emotion.repository';
import { SupabaseRelationshipRepository } from './repositories/supabase-relationship.repository';
import { SupabaseUserMemoryRepository } from './repositories/supabase-user-memory.repository';

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
        SupabaseEmotionRepository,
        SupabaseRelationshipRepository,
        SupabaseUserMemoryRepository,
    ],
    exports: [VADService, RelationshipService, AnalysisService, MemoryService],
})
export class PersonalityModule { }
