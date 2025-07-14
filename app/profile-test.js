const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ProfileProcessor = require('./src/profile-processor');

async function testProfileSystem() {
    console.log('=== Profile System Test ===');
    
    // Gemini APIの初期化
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // ProfileProcessorの初期化
    const processor = new ProfileProcessor();
    
    try {
        console.log('1. Initializing database tables...');
        await processor.initializeProfileTables();
        console.log('✅ Database tables initialized');
        
        console.log('\n2. Fetching notes from Obsidian...');
        const notes = await processor.getAllNotesFromObsidian();
        console.log(`✅ Found ${notes.length} notes`);
        
        if (notes.length > 0) {
            console.log('\n3. Saving notes to database...');
            await processor.saveNotesToDB(notes);
            console.log('✅ Notes saved to database');
            
            console.log('\n4. Processing unprocessed notes...');
            await processor.processUnprocessedNotes(genAI);
            console.log('✅ Notes processed');
            
            console.log('\n5. Getting current profile...');
            const profile = await processor.getCurrentProfile();
            console.log('✅ Current Profile:');
            console.log(JSON.stringify(profile, null, 2));
        } else {
            console.log('⚠️ No notes found. Check your Obsidian configuration.');
        }
        
    } catch (error) {
        console.error('❌ Error during profile system test:', error);
    }
}

async function showCurrentProfile() {
    console.log('=== Current Profile ===');
    
    const processor = new ProfileProcessor();
    
    try {
        const profile = await processor.getCurrentProfile();
        if (Object.keys(profile).length === 0) {
            console.log('No profile data found. Run the full process first.');
        } else {
            console.log(JSON.stringify(profile, null, 2));
        }
    } catch (error) {
        console.error('Error getting profile:', error);
    }
}

async function runFullProcess() {
    console.log('=== Running Full Profile Process ===');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const processor = new ProfileProcessor();
    
    try {
        await processor.runFullProcess(genAI);
        console.log('✅ Full process completed');
    } catch (error) {
        console.error('❌ Error during full process:', error);
    }
}

// コマンドライン引数で動作を切り替え
const command = process.argv[2];

switch (command) {
    case 'test':
        testProfileSystem();
        break;
    case 'profile':
        showCurrentProfile();
        break;
    case 'full':
        runFullProcess();
        break;
    default:
        console.log(`
Profile System Test Script

Usage:
  node profile-test.js test     - Run full test sequence
  node profile-test.js profile - Show current profile
  node profile-test.js full    - Run full processing

Environment variables required:
  - OBSIDIAN_URL
  - OBSIDIAN_API
  - GEMINI_API_KEY
  - POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
        `);
        break;
}
