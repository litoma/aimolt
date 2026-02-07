require('dotenv').config({ path: 'app/.env' });
const { createClient } = require('@supabase/supabase-js');

async function testDupKey() {
    console.log('--- Test Dup Key Persistence ---');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const userId = 'DEBUG_DUP_KEY';

    const payload = {
        // NO ID
        user_id: userId,
        initiator: 'user',
        user_message: 'Dup Key Test',
        bot_response: '',
        message_type: 'text'
    };

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

testDupKey();
