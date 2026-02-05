import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { VADService } from './application/services/vad.service';
import { RelationshipService } from './application/services/relationship.service';
import { ProfileSyncService } from './application/services/profile-sync.service';
import { SupabaseEmotionRepository } from './infrastructure/repositories/supabase-emotion.repository';
import { SupabaseRelationshipRepository } from './infrastructure/repositories/supabase-relationship.repository';
import { IEmotionRepository } from './domain/repositories/emotion.repository.interface';
import { IRelationshipRepository } from './domain/repositories/relationship.repository.interface';

import { PersonalityGateway } from './interface/personality.gateway';
import { ProfileGateway } from './interface/profile.gateway';
import { DiscordModule } from '../discord/discord.module';

@Module({
    imports: [CoreModule, DiscordModule],
    providers: [
        PersonalityGateway,
        ProfileGateway,
        VADService,
        RelationshipService,
        ProfileSyncService,
        {
            provide: IEmotionRepository,
            useClass: SupabaseEmotionRepository,
        },
        {
            provide: IRelationshipRepository,
            useClass: SupabaseRelationshipRepository,
        },
    ],
    exports: [VADService, RelationshipService, ProfileSyncService],
})
export class PersonalityModule { }
