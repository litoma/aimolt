import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SelfPingService {
    private readonly logger = new Logger(SelfPingService.name);

    constructor(private readonly httpService: HttpService) { }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async handleCron() {
        const port = process.env.PORT || 3000;
        const url = `http://localhost:${port}/`;

        this.logger.debug(`Executing self-ping to ${url}`);

        try {
            await firstValueFrom(this.httpService.get(url));
            this.logger.debug('Self-ping successful');
        } catch (error) {
            this.logger.error('Self-ping failed', error.message);
        }
    }
}
