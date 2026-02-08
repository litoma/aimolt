import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';
import { HealthController } from './health.controller';
import { SelfPingService } from './self-ping.service';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        HttpModule,
    ],
    controllers: [HealthController],
    providers: [SelfPingService],
})
export class HealthModule { }
