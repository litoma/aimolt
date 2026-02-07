require('dotenv').config({ path: 'app/.env' });
const { createClient } = require('@supabase/supabase-js');

async function testInsert() {
    console.log('--- Testing Supabase Insert with message_type ---');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const userId = 'TEST_DEBUGPERISTENCE';

    // Attempt 1: Just message_type
    console.log('Attempt 1: Adding message_type...');
    const payload1 = {
        user_id: userId,
        initiator: 'user',
        user_message: 'Test Message Type Check',
        bot_response: '',
        message_type: 'text'
    };

    const { data: d1, error: e1 } = await supabase
        .from('conversations')
        .insert([payload1])
        .select();

    if (e1) console.error('❌ Attempt 1 Error:', e1);
    else console.log('✅ Attempt 1 Success:', d1);
}

testInsert();
