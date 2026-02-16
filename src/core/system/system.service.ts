import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SystemService {
    private readonly logger = new Logger(SystemService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async updateActivityTime(): Promise<void> {
        try {
            const { error } = await this.supabaseService.getClient()
                .from('system')
                .upsert({
                    key: 'last_activity_time',
                    value: new Date().toISOString(),
                    updated_at: new Date()
                });

            if (error) {
                this.logger.error('Failed to update last_activity_time:', error);
            }
        } catch (error) {
            this.logger.error('Error updating last_activity_time:', error);
        }
    }

    async updateBackupTime(target: string = 'koyeb'): Promise<void> {
        // We only track 'last_backup_time' generally, or we could key by target if needed.
        // For now, simple key.
        try {
            const { error } = await this.supabaseService.getClient()
                .from('system')
                .upsert({
                    key: 'last_backup_time',
                    value: new Date().toISOString(),
                    updated_at: new Date()
                });

            if (error) {
                this.logger.error('Failed to update last_backup_time:', error);
            }
        } catch (error) {
            this.logger.error('Error updating last_backup_time:', error);
        }
    }

    async getValue(key: string): Promise<string | null> {
        try {
            const { data, error } = await this.supabaseService.getClient()
                .from('system')
                .select('value')
                .eq('key', key)
                .single();

            if (error) {
                // It's okay if not found initially
                return null;
            }
            return data?.value || null;
        } catch (error) {
            this.logger.error(`Error fetching value for key ${key}:`, error);
            return null;
        }
    }
}
