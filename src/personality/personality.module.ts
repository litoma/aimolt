import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { VADService } from './services/vad.service';
import { RelationshipService } from './services/relationship.service';
import { AnalysisService } from './services/analysis.service';
import { SupabaseEmotionRepository } from './repositories/supabase-emotion.repository';
import { SupabaseRelationshipRepository } from './repositories/supabase-relationship.repository';

import { PersonalityGateway } from './interface/personality.gateway';
import { DiscordModule } from '../discord/discord.module';
import { ImpressionService } from './services/impression.service';
import { EmotionModule } from './emotion/emotion.module';
import { PersonalityService } from './services/personality.service';

@Module({
    imports: [CoreModule, DiscordModule, EmotionModule],
    providers: [
        PersonalityGateway,
        VADService,
        RelationshipService,
        AnalysisService,
        ImpressionService,
        SupabaseEmotionRepository,
        SupabaseRelationshipRepository,
        PersonalityService,
    ],
    exports: [VADService, RelationshipService, AnalysisService, ImpressionService, PersonalityService],
})
export class PersonalityModule { }
