import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { BlueskyService } from './bluesky.service';
import { BlueskyPostingService } from './bluesky-posting.service';
import { BlueskySchedulerService } from './bluesky-scheduler.service';
import { BlueskyPromptService } from './bluesky-prompt.service';
import { CoreModule } from '../core/core.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        ConfigModule,
        CoreModule,
    ],
    providers: [
        BlueskyService,
        BlueskyPostingService,
        BlueskySchedulerService,
        BlueskyPromptService,
    ],
    exports: [BlueskyPostingService],
})
export class BlueskyModule { }
