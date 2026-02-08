import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { DiscordModule } from './discord/discord.module';
import { PersonalityModule } from './personality/personality.module';
import { InteractionModule } from './interaction/interaction.module';

@Module({
    imports: [CoreModule, DiscordModule, PersonalityModule, InteractionModule],
    controllers: [],
    providers: [],
})
export class AppModule { }
