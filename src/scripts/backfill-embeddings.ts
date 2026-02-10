
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.GEMINI_AI_MODEL_EMBEDDING || 'models/gemini-embedding-001';

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
const SAFE_MAX_CHARS = 3000;

async function embedText(text: string): Promise<number[] | null> {
    try {
        const truncatedText = text.length > SAFE_MAX_CHARS ? text.slice(0, SAFE_MAX_CHARS) : text;
        const result = await model.embedContent(truncatedText);
        return result.embedding.values;
    } catch (e) {
        console.error('Embedding error:', e);
        return null;
    }
}

async function backfillConversations() {
    console.log('Starting backfill for conversations...');
    let lastId = 0;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('conversations')
            .select('id, user_message, embedding') // Select embedding to check if exists
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(pageSize);

        if (error) {
            console.error('Fetch error (conversations):', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing ${data.length} conversations (ID > ${lastId})...`);

        for (const record of data) {
            lastId = record.id; // Update lastId regardless of success

            // Skip if already has embedding
            if (record.embedding) continue;
            // Skip if no text
            if (!record.user_message) continue;

            const vector = await embedText(record.user_message);
            if (vector) {
                const { error: updateError } = await supabase
                    .from('conversations')
                    .update({ embedding: vector })
                    .eq('id', record.id);

                if (updateError) console.error(`Failed to update conversation ${record.id}:`, updateError);
                else process.stdout.write('.');
            }
            // Rate limit handling
            await new Promise(r => setTimeout(r, 100));
        }
        console.log('\nBatch complete.');
    }
    console.log('Conversations backfill done.');
}

async function backfillTranscripts() {
    console.log('Starting backfill for transcripts...');
    let lastId = 0;
    const pageSize = 50;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('transcripts')
            .select('id, text, embedding')
            .gt('id', lastId)
            .order('id', { ascending: true })
            .limit(pageSize);

        if (error) {
            console.error('Fetch error (transcripts):', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing ${data.length} transcripts (ID > ${lastId})...`);

        for (const record of data) {
            lastId = record.id;

            if (record.embedding) continue;
            if (!record.text || record.text.trim() === '') {
                // process.stdout.write('S'); // Skipped empty
                continue;
            }

            const vector = await embedText(record.text);
            if (vector) {
                const { error: updateError } = await supabase
                    .from('transcripts')
                    .update({ embedding: vector })
                    .eq('id', record.id);

                if (updateError) console.error(`Failed to update transcript ${record.id}:`, updateError);
                else process.stdout.write('.');
            } else {
                console.error(`Failed to embed transcript ${record.id}`);
            }
            await new Promise(r => setTimeout(r, 100));
        }
        console.log('\nBatch complete.');
    }
    console.log('Transcripts backfill done.');
}

async function main() {
    await backfillConversations();
    await backfillTranscripts();
}

main().catch(console.error);
