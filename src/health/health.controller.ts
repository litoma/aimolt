import { Controller, Get, Res } from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { SupabaseService } from '../core/supabase/supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Response } from 'express';

@Controller()
export class HealthController {
    constructor(
        private readonly discordService: DiscordService,
        private readonly supabaseService: SupabaseService
    ) { }

    @Get('avatar')
    async getAvatar(@Res() res: Response) {
        const user = this.discordService.client.user;
        if (!user) {
            return res.redirect('https://cdn.discordapp.com/embed/avatars/0.png');
        }

        const avatarHash = user.avatar;
        if (!avatarHash) {
            return res.redirect(user.displayAvatarURL({ size: 256 }));
        }

        // Use /app/temp in production (container), or relative temp for local dev
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filePath = path.join(tempDir, `${avatarHash}.png`);

        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }

        try {
            const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png' });
            const response = await axios.get(avatarUrl, { responseType: 'arraybuffer' });

            // Clean up old avatar files
            const files = fs.readdirSync(tempDir);
            for (const file of files) {
                if (file.endsWith('.png')) {
                    fs.unlinkSync(path.join(tempDir, file));
                }
            }

            fs.writeFileSync(filePath, response.data);
            return res.sendFile(filePath);
        } catch (error) {
            console.error('Failed to cache avatar:', error);
            return res.redirect(user.displayAvatarURL({ size: 256 }));
        }
    }

    @Get()
    async check() {
        const user = this.discordService.client.user;
        // Use local cached avatar endpoint with hash for cache busting
        const iconUrl = user && user.avatar ? `/avatar?v=${user.avatar}` : (user ? user.displayAvatarURL({ size: 256 }) : 'https://cdn.discordapp.com/embed/avatars/0.png');
        const status = user ? 'Online' : 'Initializing';
        let lastMessageTime = 'N/A';

        try {
            const [convRes, transRes] = await Promise.all([
                this.supabaseService.getClient()
                    .from('conversations')
                    .select('created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single(),
                this.supabaseService.getClient()
                    .from('transcripts')
                    .select('created_at')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()
            ]);

            const convTime = convRes.data ? new Date(convRes.data.created_at).getTime() : 0;
            const transTime = transRes.data ? new Date(transRes.data.created_at).getTime() : 0;

            const latestTime = Math.max(convTime, transTime);

            if (latestTime > 0) {
                lastMessageTime = new Date(latestTime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
            }
        } catch (e) {
            console.error('Failed to fetch last activity time', e);
        }

        // Check for latest backup
        let lastBackupTime = 'N/A';
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (fs.existsSync(tempDir)) {
            const files = fs.readdirSync(tempDir);
            // Look for backup directories: backup-YYYY-MM-DD
            const backupDirs = files.filter(file => {
                const filePath = path.join(tempDir, file);
                try {
                    return file.startsWith('backup-') && fs.statSync(filePath).isDirectory();
                } catch (e) {
                    return false;
                }
            });

            if (backupDirs.length > 0) {
                // Sort by dirname (which contains date) descending to get latest
                backupDirs.sort().reverse();
                const latestBackupDir = backupDirs[0];

                try {
                    // Use modification time of the directory
                    const stats = fs.statSync(path.join(tempDir, latestBackupDir));
                    lastBackupTime = stats.mtime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
                } catch (e) {
                    console.error('Failed to get backup directory stats', e);
                }
            }
        }

        return `
            <!DOCTYPE html>
            <html lang="ja">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>AImolt Status</title>
                <style>
                    body {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                        background-color: #f0f2f5;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #333;
                    }
                    .container {
                        text-align: center;
                        background: white;
                        padding: 2rem;
                        border-radius: 12px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        width: 300px;
                    }
                    .greeting {
                        font-size: 1.5rem;
                        font-weight: bold;
                        color: #000;
                        margin-bottom: 1rem;
                    }
                    .version {
                        font-size: 1rem;
                        font-weight: bold;
                        color: #000;
                        margin-bottom: 0.5rem;
                    }
                    .icon {
                        width: 128px;
                        height: 128px;
                        border-radius: 50%;
                        margin-bottom: 1rem;
                        border: 4px solid #fff;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .status {
                        font-size: 1.2rem;
                        font-weight: bold;
                        margin-bottom: 0.5rem;
                        color: #2e7d32;
                    }
                    .status.error {
                        color: #d32f2f;
                    }
                    .info {
                        font-size: 0.9rem;
                        color: #666;
                        margin-top: 0.5rem;
                    }
                    .badges {
                        margin-top: 1rem;
                        display: flex;
                        justify-content: center;
                        gap: 10px;
                    }
                    .badge img {
                        height: 28px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="greeting">Hi, I'm AImolt.</div>
                    <img src="${iconUrl}" alt="Bot Icon" class="icon">
                    <div class="version">v1.0.0</div>
                    <div class="status ${user ? '' : 'error'}">Status: ${status}</div>
                    <div class="info">Last Activity: ${lastMessageTime}</div>
                    <div class="info">Last Backup: ${lastBackupTime}</div>
                    <div class="badges">
                        <a href="https://github.com/litoma/aimolt" target="_blank" class="badge">
                            <img src="https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
                        </a>
                        <a href="https://bsky.app/profile/aimolt.bsky.social" target="_blank" class="badge">
                            <img src="https://img.shields.io/badge/Bluesky-0285FF?style=for-the-badge&logo=bluesky&logoColor=white" alt="Bluesky">
                        </a>
                    </div>
                </div>
            </body>
            </html>
        `;
    }
}
