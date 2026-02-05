import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Message, Embed, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';
import axios from 'axios';

@Injectable()
export class MemoService {
    private obsidianUrl: string;
    private obsidianApiKey: string;

    constructor(private readonly configService: ConfigService) {
        this.obsidianUrl = this.configService.get<string>('OBSIDIAN_URL');
        this.obsidianApiKey = this.configService.get<string>('OBSIDIAN_API');
    }

    async handleMemo(message: Message, userId: string): Promise<void> {
        if (!this.checkConfig(message)) return;

        let inputText = message.content || '';

        // Handle quote block
        if (inputText.startsWith('>>> ')) {
            inputText = inputText.substring(4);
        }

        // Extract embed content
        const embedContent = this.extractEmbedContent(message.embeds);
        if (embedContent) {
            inputText += inputText ? `\n\n【Embed内容】\n${embedContent}` : embedContent;
        }

        if (!inputText.trim()) {
            await this.sendMessage(message, `<@${userId}> ⚠️ メッセージに内容がありません。`);
            return;
        }

        // Process Message
        const processingMsg = await this.sendMessage(message, `<@${userId}> 📝 メッセージをObsidian Daily Noteに追加中...`);
        if (!processingMsg) return; // Should not happen ideally

        try {
            const messageLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;

            const timeOnly = new Date().toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                hour: '2-digit',
                minute: '2-digit'
            });

            const finalContent = `- [${timeOnly}](${messageLink}) ${inputText}\n\n`;

            await this.appendToObsidianDaily(finalContent);

            await processingMsg.edit({
                content: '',
                embeds: [{
                    title: '✅ Obsidian追加完了',
                    description: 'Daily Noteに追加しました。',
                    color: 0x00ff00
                }]
            });

        } catch (error) {
            console.error(`Memo Error: ${error.message}`);
            await processingMsg.edit({
                content: '',
                embeds: [{
                    title: '❌ メモ追加失敗',
                    description: 'メモの追加中にエラーが発生しました。',
                    color: 0xff0000,
                    fields: [
                        { name: 'エラー詳細', value: `\`${error.message}\``, inline: false },
                        { name: 'Obsidian URL', value: `\`${this.obsidianUrl}\``, inline: false }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'NestJS Memo System' }
                }]
            });
        }
    }

    private async sendMessage(originalMessage: Message, content: string): Promise<Message | null> {
        // Type assertion for channels that support sending
        const channel = originalMessage.channel as TextChannel | DMChannel | NewsChannel | ThreadChannel;
        if (channel.send) {
            return await channel.send(content);
        }
        return null;
    }

    private async appendToObsidianDaily(content: string) {
        const url = `${this.obsidianUrl}/periodic/daily/`;

        await axios.post(url, content, {
            headers: {
                'Authorization': `Bearer ${this.obsidianApiKey}`,
                'Content-Type': 'text/markdown'
            }
        });
    }

    private checkConfig(message: Message): boolean {
        if (!this.obsidianUrl) {
            this.sendMessage(message, '❌ OBSIDIAN_URLが設定されていません。');
            return false;
        }
        if (!this.obsidianApiKey) {
            this.sendMessage(message, '❌ OBSIDIAN_APIが設定されていません。');
            return false;
        }
        return true;
    }

    private extractEmbedContent(embeds: Embed[]): string | null {
        if (!embeds.length) return null;

        let content = '';
        for (const embed of embeds) {
            if (embed.title) content += `# ${embed.title}\n\n`;
            if (embed.description) content += `${embed.description}\n\n`;
            for (const field of embed.fields) {
                if (field.name && field.value) {
                    const val = field.value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                    content += `**${field.name}**: ${val}\n\n`;
                }
            }
        }
        return content.trim() || null;
    }
}
