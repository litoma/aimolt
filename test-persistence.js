require('dotenv').config({ path: 'app/.env' });
const { createClient } = require('@supabase/supabase-js');

async function testInsert() {
    console.log('--- Testing Supabase Insert ---');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Config');
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const userId = '123456789 (Test)';
    const content = 'Test Message from Script ' + new Date().toISOString();

    const payload = {
        user_id: userId,
        initiator: 'user',
        user_message: content,
        bot_response: null
    };

    console.log('Payload:', payload);

    const { data, error } = await supabase
        .from('conversations')
        .insert([payload])
        .select();

    if (error) {
        console.error('❌ Insert Error:', error);
    } else {
        console.log('✅ Insert Success. Data:', data);
    }
}

testInsert();
