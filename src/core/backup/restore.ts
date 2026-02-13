
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

async function restore() {
    const backupDir = process.argv[2];
    if (!backupDir) {
        console.error('Usage: ts-node src/core/backup/restore.ts <backup-directory-path>');
        process.exit(1);
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in environment variables.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Restoring from: ${backupDir}`);
    console.log(`Target Supabase: ${supabaseUrl}`);

    if (!fs.existsSync(backupDir)) {
        console.error(`Error: Backup directory not found: ${backupDir}`);
        process.exit(1);
    }

    const files = fs.readdirSync(backupDir).filter(file => file.endsWith('.json'));

    // Define restore order if necessary (e.g., to satisfy foreign keys)
    // For now, we'll try to process independent tables first if we knew them.
    // Since we don't have a strict dependency graph, we'll process in alphabetical order 
    // or just try all. If foreign key fails, we might need a more sophisticated approach.
    // Given the tables: conversations, transcripts, emotions, relationships
    // conversations -> transcripts (references conversation_id?) - likely.
    // emotions -> probably independent or linked to conversation/message.
    // relationships -> linked to users/conversations.

    // Let's try to restore 'conversations' first if it exists.
    const priorityTables = ['conversations', 'transcripts'];

    const sortedFiles = files.sort((a, b) => {
        const tableA = a.replace('.json', '');
        const tableB = b.replace('.json', '');
        const indexA = priorityTables.indexOf(tableA);
        const indexB = priorityTables.indexOf(tableB);

        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    for (const file of sortedFiles) {
        const tableName = file.replace('.json', '');
        const filePath = path.join(backupDir, file);

        try {
            console.log(`Restoring table: ${tableName}...`);
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            if (!Array.isArray(data)) {
                console.warn(`Warning: File ${file} does not contain an array. Skipping.`);
                continue;
            }

            if (data.length === 0) {
                console.log(`Table ${tableName} has no data. Skipping.`);
                continue;
            }

            // Supabase/PostgREST upsert
            // Batch processing if data is large
            const batchSize = 1000;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                const { error } = await supabase
                    .from(tableName)
                    .upsert(batch); // upsert implies on_conflict: do update

                if (error) {
                    console.error(`Error restoring batch ${i / batchSize + 1} for table ${tableName}:`, error);
                } else {
                    console.log(`Restored batch ${i / batchSize + 1} (${batch.length} rows) for ${tableName}`);
                }
            }
        } catch (error) {
            console.error(`Failed to restore table ${tableName}:`, error);
        }
    }

    console.log('Restore process completed.');
}

restore().catch(console.error);
