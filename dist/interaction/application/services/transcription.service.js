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
exports.TranscriptionService = void 0;
const common_1 = require("@nestjs/common");
const gemini_service_1 = require("../../../core/gemini/gemini.service");
const prompt_service_1 = require("../../../core/prompt/prompt.service");
const discord_service_1 = require("../../../discord/discord.service");
const fs = require("fs");
const path = require("path");
const https = require("https");
const util_1 = require("util");
const unlinkAsync = (0, util_1.promisify)(fs.unlink);
const readFileAsync = (0, util_1.promisify)(fs.readFile);
let TranscriptionService = class TranscriptionService {
    constructor(geminiService, promptService, discordService) {
        this.geminiService = geminiService;
        this.promptService = promptService;
        this.discordService = discordService;
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
    }
    async handleTranscription(message, userId) {
        const audioExts = ['.ogg', '.mp3', '.wav', '.m4a'];
        let targetAttachment = null;
        for (const attachment of message.attachments.values()) {
            const filenameLower = (attachment.name || '').toLowerCase();
            if (audioExts.some(ext => filenameLower.endsWith(ext))) {
                targetAttachment = attachment;
                break;
            }
        }
        if (!targetAttachment) {
            await this.sendMessage(message, `<@${userId}> ⚠️ 音声ファイルが見つかりません。対応形式: ${audioExts.join(', ')}`);
            return;
        }
        const maxSize = 100 * 1024 * 1024;
        if (targetAttachment.size > maxSize) {
            await this.sendMessage(message, `<@${userId}> ❌ ファイルサイズが100MBを超えています。`);
            return;
        }
        const timestamp = Date.now();
        const tempDir = path.join(process.cwd(), 'temp');
        const filePath = path.join(tempDir, `original_${timestamp}_${targetAttachment.name}`);
        const downloadUrl = targetAttachment.proxyURL || targetAttachment.url;
        try {
            await this.downloadAudio(downloadUrl, filePath);
            const systemInstruction = this.promptService.getTranscribePrompt();
            const audioData = await readFileAsync(filePath);
            const mimeType = targetAttachment.contentType || 'audio/ogg';
            const parts = [
                '以下の音声を日本語のテキストに変換し、フィラー語を除去して自然な文章にしてください。',
                {
                    inlineData: {
                        data: audioData.toString('base64'),
                        mimeType: mimeType
                    }
                }
            ];
            const transcriptionRaw = await this.geminiService.generateTextWithParts(systemInstruction, parts);
            const cleanedText = this.removeFillerWords(transcriptionRaw);
            await this.sendMessage(message, '🎉 文字起こしが完了したよ〜！');
            if (cleanedText.trim()) {
                const quotedText = `>>> ${cleanedText}`;
                for (let i = 0; i < quotedText.length; i += 1900) {
                    await this.sendMessage(message, quotedText.slice(i, i + 1900));
                }
            }
            else {
                await this.sendMessage(message, `<@${userId}> ⚠️ 文字起こし結果が空でした。😓`);
            }
        }
        catch (error) {
            console.error('Transcription Error:', error);
            await this.sendMessage(message, `<@${userId}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
        }
        finally {
            if (fs.existsSync(filePath)) {
                await unlinkAsync(filePath).catch(err => console.error('Cleanup error:', err));
            }
        }
    }
    async sendMessage(originalMessage, content) {
        const channel = originalMessage.channel;
        if (channel.send) {
            return await channel.send(content);
        }
        return null;
    }
    downloadAudio(url, filePath) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(filePath);
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(filePath, () => reject(err));
            });
        });
    }
    removeFillerWords(text) {
        const fillerPatterns = [
            /\b(あー|ああ|あああ)+\b/g,
            /\b(えー|ええ|えええ)+\b/g,
            /\b(うー|ううん|うう)+\b/g,
            /\b(おー|おお)+\b/g,
            /\b(んー|んん)+\b/g,
            /\b(まあ|まー)+\b/g,
            /\b(そのー|その)+\b/g,
            /\b(なんか|なんて)+\b/g,
            /\b(ちょっと)+\b/g,
            /(.)\1{2,}/g,
            /\s+/g
        ];
        let cleanText = text;
        fillerPatterns.forEach(pattern => {
            if (pattern.source === '\\s+') {
                cleanText = cleanText.replace(pattern, ' ');
            }
            else if (pattern.source === '(.)\\1{2,}') {
                cleanText = cleanText.replace(pattern, '$1$1');
            }
            else {
                cleanText = cleanText.replace(pattern, '');
            }
        });
        return cleanText.trim();
    }
};
exports.TranscriptionService = TranscriptionService;
exports.TranscriptionService = TranscriptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService,
        prompt_service_1.PromptService,
        discord_service_1.DiscordService])
], TranscriptionService);
//# sourceMappingURL=transcription.service.js.map