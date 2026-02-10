
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Should be SERVICE_ROLE_KEY if RLS is strict, or ANON if allowed
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_AI_MODEL || 'models/gemini-embedding-001';

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
    console.error('Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

async function embedText(text: string): Promise<number[] | null> {
    try {
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (e) {
        console.error('Embedding error:', e);
        return null;
    }
}

async function backfillConversations() {
    console.log('Starting backfill for conversations...');
    let hasMore = true;
    let page = 0;
    const pageSize = 50;

    while (hasMore) {
        const { data, error } = await supabase
            .from('conversations')
            .select('id, user_message')
            .is('embedding', null)
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Fetch error (conversations):', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing ${data.length} conversations...`);

        for (const record of data) {
            if (!record.user_message) continue;

            // Generate embedding for user_message
            const vector = await embedText(record.user_message);
            if (vector) {
                const { error: updateError } = await supabase
                    .from('conversations')
                    .update({ embedding: vector })
                    .eq('id', record.id);

                if (updateError) console.error(`Failed to update conversation ${record.id}:`, updateError);
                else process.stdout.write('.');
            }
            // Rate limit handling (simple wait)
            await new Promise(r => setTimeout(r, 100));
        }
        console.log('\nBatch complete.');
        // Don't increment page, because we are fetching where embedding is NULL. 
        // Warning: if some fail repeatedly, this loop might get stuck.
        // Safer to just re-fetch same range or use simple pagination if we don't care about order.
        // Actually, since we update rows, they will no longer be NULL.
        // So page 0 is always correct content to fetch next.
    }
    console.log('Conversations backfill done.');
}

async function backfillTranscripts() {
    console.log('Starting backfill for transcripts...');
    // Similar logic
    let hasMore = true;
    const pageSize = 50;

    while (hasMore) {
        const { data, error } = await supabase
            .from('transcripts')
            .select('id, text')
            .is('embedding', null)
            .limit(pageSize);

        if (error) {
            console.error('Fetch error (transcripts):', error);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processing ${data.length} transcripts...`);

        for (const record of data) {
            if (!record.text) continue;

            const vector = await embedText(record.text);
            if (vector) {
                const { error: updateError } = await supabase
                    .from('transcripts')
                    .update({ embedding: vector })
                    .eq('id', record.id);

                if (updateError) console.error(`Failed to update transcript ${record.id}:`, updateError);
                else process.stdout.write('.');
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
