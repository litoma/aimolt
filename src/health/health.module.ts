import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CoreModule } from '../core/core.module';
import { DiscordModule } from '../discord/discord.module';

import { BlueskyModule } from '../bluesky/bluesky.module';

@Module({
    imports: [CoreModule, DiscordModule, BlueskyModule],
    controllers: [HealthController],
})
export class HealthModule { }
