const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ProfileProcessor = require('./src/profile-processor');

class ProfileScheduler {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.processor = new ProfileProcessor();
        this.isRunning = false;
        this.intervalId = null;
    }

    async start() {
        if (this.isRunning) {
            console.log('Profile scheduler is already running');
            return;
        }

        console.log('Starting profile scheduler...');
        
        try {
            // 初期化
            await this.processor.initializeProfileTables();
            
            // 即座に一回実行
            await this.runOnce();
            
            // 定期実行の設定
            const intervalHours = parseFloat(process.env.PROFILE_UPDATE_INTERVAL_HOURS) || 1.0;
            const intervalMs = intervalHours * 60 * 60 * 1000;
            
            this.intervalId = setInterval(async () => {
                await this.runOnce();
            }, intervalMs);
            
            this.isRunning = true;
            console.log(`Profile scheduler started with ${intervalHours}h interval`);
            
        } catch (error) {
            console.error('Error starting profile scheduler:', error);
        }
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('Profile scheduler stopped');
    }

    async runOnce() {
        try {
            console.log(`[${new Date().toISOString()}] Running profile processing...`);
            await this.processor.runFullProcess(this.genAI);
            console.log(`[${new Date().toISOString()}] Profile processing completed`);
        } catch (error) {
            console.error(`[${new Date().toISOString()}] Profile processing error:`, error);
        }
    }

    // 手動実行
    async runManual() {
        console.log('Manual profile processing triggered');
        await this.runOnce();
    }

    // 次回実行時間の取得
    getNextRunTime() {
        if (!this.isRunning || !this.intervalId) {
            return null;
        }
        
        const intervalHours = parseFloat(process.env.PROFILE_UPDATE_INTERVAL_HOURS) || 1.0;
        const nextRun = new Date(Date.now() + (intervalHours * 60 * 60 * 1000));
        return nextRun;
    }

    // ステータス取得
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRun: this.getNextRunTime(),
            intervalHours: parseFloat(process.env.PROFILE_UPDATE_INTERVAL_HOURS) || 1.0
        };
    }
}

// CLI実行時の処理
if (require.main === module) {
    const scheduler = new ProfileScheduler();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            scheduler.start();
            // プロセスを維持
            process.on('SIGINT', () => {
                console.log('\nShutting down scheduler...');
                scheduler.stop();
                process.exit(0);
            });
            break;
            
        case 'once':
            scheduler.runOnce().then(() => {
                console.log('One-time execution completed');
                process.exit(0);
            });
            break;
            
        case 'status':
            console.log('Scheduler Status:', scheduler.getStatus());
            process.exit(0);
            break;
            
        default:
            console.log(`
Profile Scheduler

Usage:
  node profile-scheduler.js start   - Start continuous scheduler
  node profile-scheduler.js once    - Run one-time processing
  node profile-scheduler.js status  - Show scheduler status

Environment variables:
  PROFILE_UPDATE_INTERVAL_HOURS - Update interval in hours (default: 1.0)
            `);
            break;
    }
}

module.exports = ProfileScheduler;
