import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { DiscordModule } from './discord/discord.module';
import { PersonalityModule } from './personality/personality.module';
import { InteractionModule } from './interaction/interaction.module';
import { HealthModule } from './health/health.module';

@Module({
    imports: [CoreModule, DiscordModule, PersonalityModule, InteractionModule, HealthModule],
    controllers: [],
    providers: [],
})
export class AppModule { }
