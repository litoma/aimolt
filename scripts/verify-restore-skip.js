
const { RestoreService } = require('../src/core/backup/restore.service');
const { Logger } = require('@nestjs/common');

// Mock Logger
Logger.prototype.log = (msg) => console.log(`[LOG] ${msg}`);
Logger.prototype.error = (msg) => console.error(`[ERROR] ${msg}`);
Logger.prototype.warn = (msg) => console.warn(`[WARN] ${msg}`);

// Mock process.env
const originalEnv = process.env;
process.env = { ...originalEnv };
delete process.env.DATABASE_HOST;
delete process.env.DATABASE_USER;
delete process.env.DATABASE_PASSWORD;
delete process.env.DATABASE_NAME;

async function runTest() {
    console.log('--- Starting Test: Restore Skip Logic ---');
    const service = new RestoreService();
    // We pass undefined for backupDir because the check happens before it's used in restoreToKoyeb
    // actually, restore() checks backupDir first. So we need a dummy path.
    await service.restore('/tmp/dummy-backup', 'koyeb');
    console.log('--- Test Finished ---');
}

runTest();
