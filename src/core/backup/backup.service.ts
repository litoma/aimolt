import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as cron from 'node-cron';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BackupService implements OnApplicationBootstrap {
    private readonly logger = new Logger(BackupService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseService: SupabaseService
    ) { }

    onApplicationBootstrap() {
        this.scheduleBackup();
    }

    private scheduleBackup() {
        // Run every day at 00:00 JST (Asia/Tokyo)
        cron.schedule('0 0 * * *', () => {
            this.logger.log('Starting daily database backup (JSON)...');
            this.executeBackup();
        }, {
            timezone: 'Asia/Tokyo'
        });

        this.logger.log('Daily database backup scheduled (00:00 JST).');
    }

    async executeBackup() {
        const client = this.supabaseService.getClient();
        if (!client) {
            this.logger.error('Supabase client is not initialized. Skipping backup.');
            return;
        }

        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const backupDirName = `backup-${yyyy}-${mm}-${dd}`;

        // Use /app/temp in container, or relative temp for local dev
        const tempDir = path.resolve(process.cwd(), 'temp');
        const backupDirPath = path.join(tempDir, backupDirName);

        if (!fs.existsSync(backupDirPath)) {
            fs.mkdirSync(backupDirPath, { recursive: true });
        }

        // List of tables to backup
        // Note: Supabase API (PostgREST) reads are non-blocking. 
        // Writes can continue during backup, but data consistency across tables is not guaranteed.
        const tables = [
            'conversations',
            'transcripts',
            'emotions',
            'relationships'
        ];

        for (const table of tables) {
            try {
                this.logger.log(`Backing up table: ${table}...`);

                // Fetch all rows
                // Note: For very large tables, we should use pagination (range). 
                // For now, assuming manageable size or increasing limit. Default limit is often 1000.
                // We'll set a high limit.
                const { data, error } = await client
                    .from(table)
                    .select('*')
                    .limit(1000000); // Adjust as needed or implement pagination

                if (error) {
                    this.logger.error(`Failed to fetch data for table ${table}: ${error.message}`);
                    continue;
                }

                if (data) {
                    const filePath = path.join(backupDirPath, `${table}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                    this.logger.log(`Saved ${data.length} rows to ${filePath}`);
                }
            } catch (error) {
                this.logger.error(`Error backing up table ${table}:`, error);
            }
        }

        this.logger.log(`Database backup completed: ${backupDirPath}`);

        // Cleanup old backups (keep last 7 days)
        this.cleanupOldBackups(tempDir);
    }

    private cleanupOldBackups(dir: string) {
        try {
            const files = fs.readdirSync(dir);
            const now = Date.now();
            const retentionDays = 7;
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

            for (const file of files) {
                // Check if it's a backup directory
                if (file.startsWith('backup-')) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    if (stats.isDirectory() && (now - stats.mtimeMs > retentionMs)) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                        this.logger.log(`Deleted old backup: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.logger.warn('Failed to cleanup old backups:', error);
        }
    }
}
