import { Controller, Get } from '@nestjs/common';
import { DiscordService } from '../discord/discord.service';
import { SupabaseService } from '../core/supabase/supabase.service';

@Controller()
export class HealthController {
    constructor(
        private readonly discordService: DiscordService,
        private readonly supabaseService: SupabaseService
    ) { }

    @Get()
    async check() {
        const user = this.discordService.client.user;
        const iconUrl = user ? user.displayAvatarURL({ size: 256 }) : 'https://cdn.discordapp.com/embed/avatars/0.png';
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
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="${iconUrl}" alt="Bot Icon" class="icon">
                    <div class="status ${user ? '' : 'error'}">Status: ${status}</div>
                    <div class="info">Last Activity: ${lastMessageTime}</div>
                </div>
            </body>
            </html>
        `;
    }
}
