
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../core/supabase/supabase.service';
import { BlueskyPostingService } from './bluesky-posting.service';

@Injectable()
export class BlueskySchedulerService {
    private readonly logger = new Logger(BlueskySchedulerService.name);
    private isPosting = false; // 二重実行防止

    constructor(
        private readonly supabase: SupabaseService,
        private readonly postingService: BlueskyPostingService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async checkAndPost() {
        if (this.isPosting) return;

        try {
            const { data, error } = await this.supabase.getClient()
                .from('posts')
                .select('id, next_scheduled_at')
                .order('next_scheduled_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                // No posts or error, log mostly if error isn't just "no rows" (PGRST116)
                if (error && error.code !== 'PGRST116') {
                    this.logger.warn(`Failed to check schedule: ${error.message}`);
                }
                return;
            }

            const scheduledAt = new Date(data.next_scheduled_at);
            if (scheduledAt > new Date()) return; // まだ時刻ではない

            this.logger.log(`Scheduled time reached (${scheduledAt.toISOString()}). Triggering post.`);

            this.isPosting = true;
            await this.postingService.execute();
        } catch (err) {
            this.logger.error('Posting check failed', err);
        } finally {
            this.isPosting = false;
        }
    }
}
