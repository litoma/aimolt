
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../core/supabase/supabase.service';
import { BlueskyPostingService } from './bluesky-posting.service';

@Injectable()
export class BlueskySchedulerService {
    private readonly logger = new Logger(BlueskySchedulerService.name);
    private isPosting = false; // 二重実行防止

    constructor(
        private readonly supabase: SupabaseService,
        private readonly postingService: BlueskyPostingService,
        private readonly configService: ConfigService,
    ) { }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async checkAndPost() {
        // 環境変数が設定されていない場合は実行しない
        const identifier = this.configService.get<string>('BLUESKY_IDENTIFIER');
        const password = this.configService.get<string>('BLUESKY_APP_PASSWORD');
        if (!identifier || !password) {
            // ログがうるさくなるのでデバッグレベルにするか、初回のみ出すなどの工夫が必要だが、
            // ここでは単に何もしない（スケジュール実行自体をスキップ）
            return;
        }

        if (this.isPosting) return;

        try {
            const { data, error } = await this.supabase.getClient()
                .from('posts')
                .select('id, next_scheduled_at')
                .order('next_scheduled_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                // No posts found (PGRST116) means first run
                if (error && error.code === 'PGRST116') {
                    this.logger.log('No posts found. Initializing schedule with immediate post.');
                    const { error: insertError } = await this.supabase.getClient().from('posts').insert({
                        content: '（初期化用・投稿なし）',
                        next_scheduled_at: new Date().toISOString(),
                        mode_id: 'initial',
                    });

                    if (insertError) {
                        this.logger.error(`Failed to insert initial post: ${insertError.message}`);
                    } else {
                        this.logger.log('Initial post schedule created.');
                    }
                    return; // Next run will pick this up
                }

                if (error) {
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
