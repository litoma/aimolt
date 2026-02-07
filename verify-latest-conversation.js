require('dotenv').config({ path: 'app/.env' });
const { createClient } = require('@supabase/supabase-js');

async function verifyLatest() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

    console.log('--- Fetching Latest Conversation ---');
    const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error('❌ Error:', error);
    } else {
        console.log('✅ Latest 3 rows:', JSON.stringify(data, null, 2));
    }
}

verifyLatest();
