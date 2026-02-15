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

        try {
            // Fetch list of tables dynamically via RPC
            const { data: tables, error: tableError } = await client.rpc('get_all_tables');

            if (tableError) {
                this.logger.error('Failed to fetch table list via RPC:', tableError);
                return;
            }

            if (!tables || tables.length === 0) {
                this.logger.warn('No tables found to backup.');
                return;
            }

            const schemaInfo: Record<string, any> = {};

            for (const t of tables) {
                const tableName = t.table_name;
                this.logger.log(`Backing up table: ${tableName}...`);

                // Fetch schema info
                const { data: columns, error: colError } = await client.rpc('get_table_columns', { t_name: tableName });
                if (colError) {
                    this.logger.error(`Failed to fetch columns for table ${tableName}:`, colError);
                } else {
                    schemaInfo[tableName] = columns;
                }

                // Fetch data
                // Note: For very large tables, we should use pagination (range). 
                // For now, assuming manageable size or increasing limit. Default limit is often 1000.
                // We'll set a high limit.
                const { data, error } = await client
                    .from(tableName)
                    .select('*')
                    .limit(1000000); // Adjust as needed or implement pagination

                if (error) {
                    this.logger.error(`Failed to fetch data for table ${tableName}: ${error.message}`);
                    continue;
                }

                if (data) {
                    const filePath = path.join(backupDirPath, `${tableName}.json`);
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                    this.logger.log(`Saved ${data.length} rows to ${filePath}`);
                }
            }

            // Save schema info
            const schemaPath = path.join(backupDirPath, 'schema.json');
            fs.writeFileSync(schemaPath, JSON.stringify(schemaInfo, null, 2));
            this.logger.log(`Saved schema info to ${schemaPath}`);

            this.logger.log(`Database backup completed: ${backupDirPath}`);

            // Trigger Restore to Koyeb DB
            this.logger.log('Starting automatic restore to Koyeb DB...');
            await this.triggerRestore(backupDirPath);

        } catch (error) {
            this.logger.error('Error during backup process:', error);
        }

        // Cleanup old backups (keep last 7 days)
        this.cleanupOldBackups(tempDir);
    }

    private async triggerRestore(backupDir: string) {
        try {
            this.logger.log(`Starting restore process for directory: ${backupDir}`);

            // Import the restore function dynamically or just assume it is bundled if we change the build 
            // implementation. However, since we are in the same dir...
            // Note: If we use standard import at top of file, we need to ensure restore.ts is treated as a module.
            // It is now.

            // To avoid static import issues if the file structure changes or during circular dependency checks (unlikely here),
            // let's use require or dynamic import.
            // But standard import is best for type safety.
            // Let's rely on the fact that I will add the import at the top.

            // For now, let's use the imported function.
            // I need to add `import { restore } from './restore';` at the top of the file.
            // But since I am editing the middle of the file here, I will use dynamic import 
            // or I should have added the import statement in a separate step?
            // "ReplaceFileContent" can handle multiple chunks? No, I am using single replace tool right now?
            // I can use MultiReplaceFileContent or just use dynamic import here which is cleaner for optional/script-like modules.

            const { restore } = require('./restore');
            // OR check if I can use import()
            // const restoreModule = await import('./restore');
            // restoreModule.restore(...)

            // Since this is a NestJS app (server-side), dynamic require is fine and robust.
            // Using require ensuring relative path is correct relative to this file?
            // In dist, both are in dist/core/backup/.
            // In src, both are in src/core/backup/.
            // So './restore' works.

            await restore(backupDir, 'koyeb');

            this.logger.log('Automatic restore to Koyeb DB completed.');

        } catch (error) {
            this.logger.error('Failed to trigger restore:', error);
        }
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
