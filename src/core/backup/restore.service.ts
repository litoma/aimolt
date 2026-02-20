import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables from .env file if present
dotenv.config();

// Define types for schema info
interface ColumnInfo {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
}

@Injectable()
export class RestoreService {
    private readonly logger = new Logger(RestoreService.name);

    async restore(backupDir?: string, target: string = 'supabase') {
        // If called via CLI, these might be undefined, handle that in the CLI check block or passed args
        if (!backupDir) {
            this.logger.error('Backup directory is required.');
            return;
        }

        this.logger.log(`Starting restore process...`);
        this.logger.log(`Source: ${backupDir}`);
        this.logger.log(`Target: ${target}`);

        if (target === 'koyeb') {
            await this.restoreToKoyeb(backupDir);
        } else {
            await this.restoreToSupabase(backupDir);
        }
    }

    private async restoreToKoyeb(backupDir: string) {
        const host = process.env.DATABASE_HOST;
        const dbConfig = {
            host: host,
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            database: process.env.DATABASE_NAME,
            port: Number(process.env.DATABASE_PORT) || 5432,
            ssl: { rejectUnauthorized: false }, // Koyeb typically needs SSL
            options: host ? `endpoint=${host.split('.')[0]}` : undefined
        };

        if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
            this.logger.log('Koyeb DB environment variables (DATABASE_HOST, etc.) not fully set. Skipping restore.');
            return;
        }

        const client = new Client(dbConfig);

        try {
            await client.connect();
            this.logger.log('Connected to Koyeb PostgreSQL.');

            // 1. Drop and Recreate Schema
            this.logger.log('Dropping and recreating public schema...');
            await client.query('DROP SCHEMA public CASCADE');
            await client.query('CREATE SCHEMA public');
            await client.query('GRANT ALL ON SCHEMA public TO public'); // Or specific user

            // Re-enable pgvector if needed
            try {
                await client.query('CREATE EXTENSION IF NOT EXISTS vector');
                this.logger.log('Extension "vector" enabled.');
            } catch (e) {
                this.logger.warn(`Warning: Could not create extension "vector". It might be restricted or already exists. ${(e as Error).message}`);
            }

            // 2. Load Schema Info
            const schemaPath = path.join(backupDir, 'schema.json');
            if (!fs.existsSync(schemaPath)) {
                this.logger.warn('Warning: schema.json not found. Attempting to restore data to existing tables (might fail if tables missing).');
            } else {
                this.logger.log('Restoring schema from schema.json...');
                const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
                const schemaInfo: Record<string, ColumnInfo[]> = JSON.parse(schemaContent);

                for (const [tableName, columns] of Object.entries(schemaInfo)) {
                    await this.createTableFromSchema(client, tableName, columns);
                }
            }

            // 3. Restore Data
            const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json') && file !== 'schema.json');

            for (const file of files) {
                const tableName = file.replace('.json', '');
                await this.restoreTableDataToPostgres(client, tableName, path.join(backupDir, file));
            }

            this.logger.log('Koyeb restore completed successfully.');

            // Write completion timestamp
            try {
                const timestampPath = path.join(backupDir, 'restore_complete.txt');
                fs.writeFileSync(timestampPath, new Date().toISOString());
                this.logger.log(`Recorded completion timestamp to ${timestampPath}`);

                // Update system table for persistence
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SECRET_KEY;

                if (supabaseUrl && supabaseKey) {
                    const supabase = createClient(supabaseUrl, supabaseKey);
                    // We use 'upsert' to ensure the key exists or is updated
                    const { error } = await supabase
                        .from('system')
                        .upsert({
                            key: 'last_backup_time',
                            value: new Date().toISOString(),
                            updated_at: new Date()
                        });

                    if (error) {
                        this.logger.error(`Failed to update system table (last_backup_time): ${error.message}`);
                    } else {
                        this.logger.log('Updated system table (last_backup_time).');
                    }
                }
            } catch (e) {
                this.logger.error(`Failed to write completion timestamp or update system table: ${e}`);
            }

        } catch (error) {
            this.logger.error(`Koyeb restore failed: ${error}`);
        } finally {
            await client.end();
        }
    }

    private async createTableFromSchema(client: Client, tableName: string, columns: ColumnInfo[]) {
        const colDefs = columns.map(col => {
            let def = `"${col.column_name}" ${col.data_type}`;

            if (col.column_name === 'embedding') {
                def = `"${col.column_name}" halfvec(3072)`;
            } else {
                if (col.is_nullable === 'NO') {
                    def += ' NOT NULL';
                }
            }

            if (col.column_name === 'id') {
                def += ' PRIMARY KEY';
            }

            return def;
        });

        const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;

        this.logger.log(`Creating table ${tableName}...`);
        await client.query(createSql);
    }

    private async restoreTableDataToPostgres(client: Client, tableName: string, filePath: string) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);

        if (!Array.isArray(data) || data.length === 0) {
            this.logger.log(`Table ${tableName} has no data. Skipping.`);
            return;
        }

        this.logger.log(`Restoring ${data.length} rows to ${tableName}...`);

        // Batch insert
        const batchSize = 1000;

        const columns = Object.keys(data[0]);
        const colNames = columns.map(c => `"${c}"`).join(', ');

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);

            let paramIndex = 1;
            const values: any[] = [];
            const placeholders: string[] = [];

            for (const row of batch) {
                const rowPlaceholders: string[] = [];
                for (const col of columns) {
                    let val = row[col];

                    if (typeof val === 'object' && val !== null) {
                        val = JSON.stringify(val);
                    }

                    values.push(val);
                    rowPlaceholders.push(`$${paramIndex++}`);
                }
                placeholders.push(`(${rowPlaceholders.join(', ')})`);
            }

            const query = `INSERT INTO "${tableName}" (${colNames}) VALUES ${placeholders.join(', ')}`;

            try {
                await client.query(query, values);
            } catch (e) {
                this.logger.error(`Error inserting batch into ${tableName}: ${(e as Error).message}`);
            }
        }
    }

    private async restoreToSupabase(backupDir: string) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SECRET_KEY;

        if (!supabaseUrl || !supabaseKey) {
            this.logger.error('Error: SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment variables.');
            if (require.main === module) process.exit(1);
            return;
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        this.logger.log(`Target Supabase: ${supabaseUrl}`);

        const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json') && file !== 'schema.json');
        const filesSorted = files.sort();

        for (const file of filesSorted) {
            const tableName = file.replace('.json', '');
            const filePath = path.join(backupDir, file);

            try {
                this.logger.log(`Restoring table: ${tableName}...`);
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(fileContent);

                if (!Array.isArray(data) || data.length === 0) {
                    this.logger.log(`Table ${tableName} has no data. Skipping.`);
                    continue;
                }

                // Supabase/PostgREST upsert
                const batchSize = 1000;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    const { error } = await supabase
                        .from(tableName)
                        .upsert(batch);

                    if (error) {
                        this.logger.error(`Error restoring batch for table ${tableName}: ${error.message}`);
                    } else {
                        this.logger.log(`Restored batch ${Math.floor(i / batchSize) + 1} for ${tableName}`);
                    }
                }
            } catch (error) {
                this.logger.error(`Failed to restore table ${tableName}: ${error}`);
            }
        }
        this.logger.log('Supabase restore completed.');
    }
}


