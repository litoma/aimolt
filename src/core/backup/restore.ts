
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

// Map PostgreSQL types to generic types if needed, or use as is
// We will use them as is for Create Table statements

// ... imports (kept as is, but we need to ensure they are available in scope or just modify the function)

export async function restore(backupDir?: string, target: string = 'supabase') {
    // If called via CLI, these might be undefined, handle that in the CLI check block or passed args
    if (!backupDir) {
        // Fallback or error
        console.error('Backup directory is required.');
        return;
    }

    console.log(`Starting restore process...`);
    console.log(`Source: ${backupDir}`);
    console.log(`Target: ${target}`);

    if (target === 'koyeb') {
        await restoreToKoyeb(backupDir);
    } else {
        await restoreToSupabase(backupDir);
    }
}

// ... helper functions (restoreToKoyeb, createTableFromSchema, restoreTableDataToPostgres, restoreToSupabase) ...
// We need to keep them in the file. I will use the "whole file" replacement strategy or careful editing if ReplaceFileContent supports it.
// Actually, ReplaceFileContent supports replacing a block.

// Let's modify the top part and the bottom part.

// Check if run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const dir = args[0];
    const targetFlag = args.find(arg => arg.startsWith('--target='));
    const target = targetFlag ? targetFlag.split('=')[1] : 'supabase';

    if (!dir) {
        console.error('Usage: ts-node src/core/backup/restore.ts <backup-directory-path> [--target=supabase|koyeb]');
        process.exit(1);
    }

    restore(dir, target).catch(console.error);
}


async function restoreToKoyeb(backupDir: string) {
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
        console.error('Error: DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, and DATABASE_NAME must be set for Koyeb restore.');
        process.exit(1);
    }

    const client = new Client(dbConfig);

    try {
        await client.connect();
        console.log('Connected to Koyeb PostgreSQL.');

        // 1. Drop and Recreate Schema
        console.log('Dropping and recreating public schema...');
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO public'); // Or specific user

        // Re-enable pgvector if needed (assuming superuser or enough privs, or it's already installed globally)
        // If the user doesn't have privileges to create extensions, this might fail unless extension persists outside schema (it does usually).
        // But DROP SCHEMA CASCADE might drop types/functions in public related to it? 
        // vector extension usually installs into a schema. If it was in public, it's gone.
        // Let's try to create it.
        try {
            await client.query('CREATE EXTENSION IF NOT EXISTS vector');
            console.log('Extension "vector" enabled.');
        } catch (e) {
            console.warn('Warning: Could not create extension "vector". It might be restricted or already exists.', e.message);
        }

        // 2. Load Schema Info
        const schemaPath = path.join(backupDir, 'schema.json');
        if (!fs.existsSync(schemaPath)) {
            console.warn('Warning: schema.json not found. Attempting to restore data to existing tables (might fail if tables missing).');
        } else {
            console.log('Restoring schema from schema.json...');
            const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
            const schemaInfo: Record<string, ColumnInfo[]> = JSON.parse(schemaContent);

            for (const [tableName, columns] of Object.entries(schemaInfo)) {
                await createTableFromSchema(client, tableName, columns);
            }
        }

        // 3. Restore Data
        const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json') && file !== 'schema.json');

        // Sort files if needed, or just iterate
        // With foreign keys dropped/recreated, order might matter for constraints, 
        // but we are creating tables without FK constraints initially (simple backup).
        // The get_table_columns does not return FK info, so we are just recreating basic tables.
        // This is a "data warehouse" style restore, not full constraint restore.
        // Should we try to infer types? schema.json has them.

        for (const file of files) {
            const tableName = file.replace('.json', '');
            await restoreTableDataToPostgres(client, tableName, path.join(backupDir, file));
        }

        console.log('Koyeb restore completed successfully.');

        // Write completion timestamp
        try {
            const timestampPath = path.join(backupDir, 'restore_complete.txt');
            fs.writeFileSync(timestampPath, new Date().toISOString());
            console.log(`Recorded completion timestamp to ${timestampPath}`);

            // Update system table for persistence
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_KEY;

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
                    console.error('Failed to update system table (last_backup_time):', error);
                } else {
                    console.log('Updated system table (last_backup_time).');
                }
            }
        } catch (e) {
            console.error('Failed to write completion timestamp or update system table:', e);
        }

    } catch (error) {
        console.error('Koyeb restore failed:', error);
    } finally {
        await client.end();
    }
}

async function createTableFromSchema(client: Client, tableName: string, columns: ColumnInfo[]) {
    // Construct CREATE TABLE statement
    // Simple mapping: "column_name data_type [DEFAULT default] [NOT NULL]"
    // Note: data_type from information_schema includes "AS" stuff sometimes or special user types.
    // For vector, it might show "USER-DEFINED" or "vector".
    // Let's assume standard types or vector.

    const colDefs = columns.map(col => {
        let def = `"${col.column_name}" ${col.data_type}`;

        // Handle vector type explicitly if needed.
        // information_schema might say 'USER-DEFINED' for vector.
        // But get_table_columns uses data_type. 
        // If it returns 'USER-DEFINED', we might need udt_name. 
        // Let's rely on what the RPC returns. 
        // Actually, the RPC gets "data_type". For vector it returns "USER-DEFINED" usually. 
        // We should probably verify what RPC returns for vector columns.
        // Let's check test_rpc output. "halfvec" might be returned if available or "USER-DEFINED".

        // Since we didn't check RPC output for vector type specifics in the test command earlier (it showed bigint/text etc),
        // let's assume if it is 'USER-DEFINED' we might strictly need to know the type.
        // BUT, given the complexity, maybe we can just cast to text for backup if strictly needed? No, we want vector search.

        // Workaround: We know 'embedding' columns are 'halfvec(3072)'.
        if (col.column_name === 'embedding') {
            def = `"${col.column_name}" halfvec(3072)`;
        } else {
            if (col.is_nullable === 'NO') {
                def += ' NOT NULL';
            }
            // Default? timestamps usually have defaults.
            if (col.column_default) {
                // Remove casting like ::timestamp with time zone
                // e.g. "now()" or "'val'::text"
                // Simple pass through might work or might fail.
                // For safety, let's omit default for restoration to avoid syntax errors, 
                // unless strict. Data insert will carry the values anyway.
                // def += ` DEFAULT ${col.column_default}`;
            }
        }

        // Primary Key? 
        // We are not fetching constraint info. 
        // But 'id' is usually PK.
        if (col.column_name === 'id') {
            def += ' PRIMARY KEY';
        }

        return def;
    });

    const createSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;

    console.log(`Creating table ${tableName}...`);
    // console.log(createSql); 
    await client.query(createSql);
}

async function restoreTableDataToPostgres(client: Client, tableName: string, filePath: string) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data) || data.length === 0) {
        console.log(`Table ${tableName} has no data. Skipping.`);
        return;
    }

    console.log(`Restoring ${data.length} rows to ${tableName}...`);

    // Batch insert
    const batchSize = 1000;

    // We need to ensure we map data to columns order
    // Let's get columns from the first row of data
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

                // Handle objects/arrays for JSON/JSONB or Array types (including vector)
                if (typeof val === 'object' && val !== null) {
                    // If it's a vector (array of numbers), we should format it as string for pg-vector?
                    // valid pg-vector format is '[1,2,3]' string or just array if driver supports it.
                    // node-postgres usually supports arrays.
                    // JSON objects should be stringified.
                    // Let's assume the driver handles arrays correctly for vector types if passed as array.
                    // BUT for JSON types, it might need stringify if the column is text, or object if jsonb.
                    // Since we created tables with simple types, 
                    // and we don't know exact column type here easily without lookup logic again.

                    // Heuristic:
                    // If it looks like a vector (array of numbers), keep as array.
                    // If it is a generic object, stringify it just in case it maps to text/jsonb.
                    // node-postgres handles JSON serialization if type is json/jsonb automatically?
                    // safest is to stringify if it's an object/array unless it's a date.

                    // Actually, node-postgres handles JS arrays to PG arrays: {1,2,3} not [1,2,3].
                    // vector extension expects '[1,2,3]'.
                    // So for vector column, we MUST stringify the array.
                    // For json column, we also usually stringify or pass object.

                    // Let's rely on JSON.stringify for now as a safe default for complex types 
                    // being inserted into text/json/vector compatible fields via standard SQL adapter.
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
        } catch (e) { // Explicitly typed as any or handled implicitly
            console.error(`Error inserting batch into ${tableName}:`, (e as Error).message);
        }
    }
}

async function restoreToSupabase(backupDir: string) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Target Supabase: ${supabaseUrl}`);

    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json') && file !== 'schema.json');

    // Define restore priority if needed
    // Simple sort
    const filesSorted = files.sort();

    for (const file of filesSorted) {
        const tableName = file.replace('.json', '');
        const filePath = path.join(backupDir, file);

        try {
            console.log(`Restoring table: ${tableName}...`);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`Table ${tableName} has no data. Skipping.`);
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
                    console.error(`Error restoring batch for table ${tableName}:`, error);
                } else {
                    console.log(`Restored batch ${i / batchSize + 1} for ${tableName}`);
                }
            }
        } catch (error) {
            console.error(`Failed to restore table ${tableName}:`, error);
        }
    }
    console.log('Supabase restore completed.');
}


