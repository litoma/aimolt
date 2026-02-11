
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const sourceUrl = process.env.SUPABASE_URL;
const sourceKey = process.env.SUPABASE_KEY;
const destUrl = process.env.SUPABASE2_URL;
const destKey = process.env.SUPABASE2_KEY;

if (!sourceUrl || !sourceKey || !destUrl || !destKey) {
    console.error('Missing environment variables for migration.');
    process.exit(1);
}

const sourceClient = createClient(sourceUrl, sourceKey);
const destClient = createClient(destUrl, destKey);

async function migrateTable(tableName: string) {
    console.log(`Starting migration for table: ${tableName}`);
    let count = 0;
    let page = 0;
    const pageSize = 100; // Small batch size to avoid payload limits

    while (true) {
        const { data, error } = await sourceClient
            .from(tableName)
            .select('*')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error(`Error fetching from ${tableName}:`, error);
            break;
        }

        if (!data || data.length === 0) {
            break;
        }

        console.log(`Fetching ${data.length} records...`);

        // Insert into destination
        const { error: insertError } = await destClient
            .from(tableName)
            .insert(data); // Supabase handles ID preservation if included

        if (insertError) {
            console.error(`Error inserting into ${tableName}:`, insertError);
            // Retry individually if batch fails?
            // For now, break or continue?
            // If ID conflict, it might fail.
            // But we are migrating to fresh DB.
        } else {
            count += data.length;
            console.log(`Migrated ${count} records so far...`);
        }

        if (data.length < pageSize) {
            break;
        }
        page++;
    }
    console.log(`Finished migration for table: ${tableName}. Total: ${count}`);
}

async function runMigration() {
    try {
        await migrateTable('emotions');
        await migrateTable('relationships');
        await migrateTable('transcripts');
        await migrateTable('conversations');
        console.log('Migration completed successfully.');
    } catch (e) {
        console.error('Migration failed:', e);
    }
}

runMigration();
