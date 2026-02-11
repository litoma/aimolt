import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { CoreModule } from '../core/core.module';
import { DiscordModule } from '../discord/discord.module';

@Module({
    imports: [CoreModule, DiscordModule],
    controllers: [HealthController],
})
export class HealthModule { }
