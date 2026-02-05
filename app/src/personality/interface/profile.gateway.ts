import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscordService } from '../../discord/discord.service';
import { ProfileSyncService } from '../application/services/profile-sync.service';
import { Message, EmbedBuilder } from 'discord.js';

@Injectable()
export class ProfileGateway implements OnModuleInit {
    constructor(
        private readonly discordService: DiscordService,
        private readonly profileService: ProfileSyncService
    ) { }

    onModuleInit() {
        this.discordService.client.on('messageCreate', (message) => this.handleMessage(message));
    }

    async handleMessage(message: Message) {
        if (message.author.bot) return;
        if (!message.content.startsWith('!profile')) return;

        const args = message.content.split(' ').slice(1);
        const command = args[0]?.toLowerCase();

        try {
            switch (command) {
                case 'status':
                    await this.handleStatus(message);
                    break;
                case 'refresh':
                    await this.handleRefresh(message);
                    break;
                case 'help':
                default:
                    await this.handleHelp(message);
                    break;
            }
        } catch (error) {
            console.error('Error in profile command:', error);
            await message.reply('❌ プロファイルコマンドの実行中にエラーが発生しました。');
        }
    }

    private async handleStatus(message: Message) {
        const status = this.profileService.getStatus();
        const embed = new EmbedBuilder()
            .setTitle('🤖 プロファイル状態')
            .setColor(status.hasProfile ? 0x00ff00 : 0xff0000)
            .addFields(
                { name: '機能状態', value: status.enabled ? '✅ 有効' : '❌ 無効 (GITHUB_TOKEN未設定)', inline: true },
                { name: 'プロファイル', value: status.hasProfile ? '✅ 読み込み済み' : '❌ 未読み込み', inline: true },
                { name: 'キャッシュ', value: status.cacheAgeHours !== null ? `${status.cacheAgeHours}時間前` : 'なし', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'AImolt Profile System' });

        await message.reply({ embeds: [embed] });
    }

    private async handleRefresh(message: Message) {
        if (!this.profileService.isProfileEnabled()) {
            await message.reply('❌ プロファイル機能が無効です。');
            return;
        }

        const msg = await message.reply('🔄 プロファイルを更新中...');
        try {
            await this.profileService.forceRefresh();
            await msg.edit('✅ プロファイル更新完了！');
        } catch (error) {
            await msg.edit('❌ プロファイル更新失敗');
        }
    }

    private async handleHelp(message: Message) {
        const embed = new EmbedBuilder()
            .setTitle('📋 プロファイル管理コマンド')
            .setDescription('GitHubからプロファイルを同期します')
            .addFields(
                { name: '!profile status', value: '現在の状態を表示' },
                { name: '!profile refresh', value: 'GitHubから強制同期' }
            )
            .setColor(0x0099ff);

        await message.reply({ embeds: [embed] });
    }
}
