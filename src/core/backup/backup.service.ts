import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as cron from 'node-cron';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { ConfigService } from '@nestjs/config';

const execAsync = promisify(exec);

@Injectable()
export class BackupService implements OnApplicationBootstrap {
    private readonly logger = new Logger(BackupService.name);

    constructor(private readonly configService: ConfigService) { }

    onApplicationBootstrap() {
        this.scheduleBackup();
    }

    private scheduleBackup() {
        // Run every day at 00:00 JST (Asia/Tokyo)
        // Cron pattern: 0 0 * * *
        // Note: node-cron uses system time. We should ensure system time is correct or handle offset.
        // Assuming container timezone is UTC, 00:00 JST is 15:00 UTC previous day.
        // However, it's safer to specify timezone if supported or just rely on server time.
        // Here we schedule for 00:00 server time for simplicity, but user asked for "1 day 1 time".

        cron.schedule('0 0 * * *', () => {
            this.logger.log('Starting daily database backup...');
            this.executeBackup();
        }, {
            timezone: 'Asia/Tokyo'
        });

        this.logger.log('Daily database backup scheduled (00:00 JST).');
    }

    async executeBackup() {
        const databaseUrl = this.configService.get<string>('DATABASE_URL');
        if (!databaseUrl) {
            this.logger.error('DATABASE_URL is not defined. Skipping backup.');
            return;
        }

        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const filename = `backup-${yyyy}-${mm}-${dd}.sql`;

        // Use /app/temp in container, or relative temp for local dev
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, filename);

        // Command: pg_dump "DATABASE_URL" -f "filePath"
        // Note: DATABASE_URL should be in connection string format
        const command = `pg_dump "${databaseUrl}" -f "${filePath}"`;

        try {
            await execAsync(command);
            this.logger.log(`Database backup completed successfully: ${filePath}`);

            // Optional: Cleanup old backups (keep last 7 days)
            this.cleanupOldBackups(tempDir);
        } catch (error) {
            this.logger.error('Database backup failed:', error);
        }
    }

    private cleanupOldBackups(dir: string) {
        try {
            const files = fs.readdirSync(dir);
            const now = Date.now();
            const retentionDays = 7;
            const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

            for (const file of files) {
                if (file.startsWith('backup-') && file.endsWith('.sql')) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtimeMs > retentionMs) {
                        fs.unlinkSync(filePath);
                        this.logger.log(`Deleted old backup: ${file}`);
                    }
                }
            }
        } catch (error) {
            this.logger.warn('Failed to cleanup old backups:', error);
        }
    }
}
