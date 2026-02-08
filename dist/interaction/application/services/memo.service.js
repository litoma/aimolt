"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
let MemoService = class MemoService {
    constructor(configService) {
        this.configService = configService;
        this.obsidianUrl = this.configService.get('OBSIDIAN_URL');
        this.obsidianApiKey = this.configService.get('OBSIDIAN_API');
    }
    async handleMemo(message, userId) {
        if (!this.checkConfig(message))
            return;
        let inputText = message.content || '';
        if (inputText.startsWith('>>> ')) {
            inputText = inputText.substring(4);
        }
        const embedContent = this.extractEmbedContent(message.embeds);
        if (embedContent) {
            inputText += inputText ? `\n\n【Embed内容】\n${embedContent}` : embedContent;
        }
        if (!inputText.trim()) {
            await this.sendMessage(message, `<@${userId}> ⚠️ メッセージに内容がありません。`);
            return;
        }
        const processingMsg = await this.sendMessage(message, `<@${userId}> 📝 メッセージをObsidian Daily Noteに追加中...`);
        if (!processingMsg)
            return;
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
        }
        catch (error) {
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
    async sendMessage(originalMessage, content) {
        const channel = originalMessage.channel;
        if (channel.send) {
            return await channel.send(content);
        }
        return null;
    }
    async appendToObsidianDaily(content) {
        const url = `${this.obsidianUrl}/periodic/daily/`;
        await axios_1.default.post(url, content, {
            headers: {
                'Authorization': `Bearer ${this.obsidianApiKey}`,
                'Content-Type': 'text/markdown'
            }
        });
    }
    checkConfig(message) {
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
    extractEmbedContent(embeds) {
        if (!embeds.length)
            return null;
        let content = '';
        for (const embed of embeds) {
            if (embed.title)
                content += `# ${embed.title}\n\n`;
            if (embed.description)
                content += `${embed.description}\n\n`;
            for (const field of embed.fields) {
                if (field.name && field.value) {
                    const val = field.value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
                    content += `**${field.name}**: ${val}\n\n`;
                }
            }
        }
        return content.trim() || null;
    }
};
exports.MemoService = MemoService;
exports.MemoService = MemoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MemoService);
//# sourceMappingURL=memo.service.js.map