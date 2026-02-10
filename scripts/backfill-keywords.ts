import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_AI_MODEL = process.env.GEMINI_AI_MODEL;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY || !GEMINI_AI_MODEL) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_AI_MODEL });

async function extractKeywords(text: string): Promise<string[]> {
    try {
        const prompt = `
以下のテキストから、話者が「現在直面している課題」「関心を持っている技術」「体調や気分の変化」に関する重要なキーワードや短いフレーズを最大5つ抽出してください。
結果はJSON形式の配列で返してください。

テキスト:
${text}

出力形式:
["キーワード1", "キーワード2", ...]
`.trim();

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textResult = response.text();

        const cleanResult = textResult.replace(/```json/g, '').replace(/```/g, '').trim();
        const keywords = JSON.parse(cleanResult);
        return Array.isArray(keywords) ? keywords.slice(0, 5) : [];
    } catch (error) {
        console.error('Extraction error:', error);
        return [];
    }
}

async function main() {
    console.log('Starting backfill...');

    // Fetch transcripts where keywords is null or empty
    // Note: empty array in postgres is '{}'
    const { data: transcripts, error } = await supabase
        .from('transcripts')
        .select('*');

    if (error) {
        console.error('Error fetching transcripts:', error);
        return;
    }

    console.log(`Found ${transcripts.length} transcripts.`);

    for (const t of transcripts) {
        if (t.keywords && t.keywords.length > 0) {
            console.log(`Transcript ${t.id} already has keywords. Skipping.`);
            continue;
        }

        console.log(`Processing transcript ${t.id}...`);
        const keywords = await extractKeywords(t.text);
        console.log(`Keywords:`, keywords);

        if (keywords.length > 0) {
            const { error: updateError } = await supabase
                .from('transcripts')
                .update({ keywords })
                .eq('id', t.id);

            if (updateError) {
                console.error(`Failed to update transcript ${t.id}:`, updateError);
            } else {
                console.log(`Updated transcript ${t.id} successfully.`);
            }
        } else {
            console.log(`No keywords extracted for transcript ${t.id}.`);
        }

        // Rate limit nice-ness
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Backfill complete.');
}

main().catch(console.error);
