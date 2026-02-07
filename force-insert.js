require('dotenv').config({ path: 'app/.env' });
const { createClient } = require('@supabase/supabase-js');

async function forceInsert() {
    console.log('--- Force Insert Test ---');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const userId = 'DEBUG_FORCE_INSERT';

    // Pick a ridiculously high ID to avoid collision
    const safeId = 999999;

    const payload = {
        id: safeId,
        user_id: userId,
        initiator: 'user',
        user_message: 'Force Insert with Safe ID',
        bot_response: '',
        message_type: 'text'
    };

    console.log('Attempting insert with ID:', safeId);
    const { data, error } = await supabase
        .from('conversations')
        .insert([payload])
        .select();

    if (error) {
        console.error('❌ Error:', error);
    } else {
        console.log('✅ Success:', data);
    }
}

forceInsert();
