import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { DiscordService } from '../../../discord/discord.service';
import { Message, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const readFileAsync = promisify(fs.readFile);

@Injectable()
export class TranscriptionService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly discordService: DiscordService,
    ) {
        // Ensure temp directory exists
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }
    }

    async handleTranscription(message: Message, userId: string): Promise<void> {
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

        const maxSize = 100 * 1024 * 1024; // 100MB
        if (targetAttachment.size > maxSize) {
            await this.sendMessage(message, `<@${userId}> ❌ ファイルサイズが100MBを超えています。`);
            return;
        }

        // Temp file setup
        const timestamp = Date.now();
        const tempDir = path.join(process.cwd(), 'temp');
        const filePath = path.join(tempDir, `original_${timestamp}_${targetAttachment.name}`);
        const downloadUrl = targetAttachment.proxyURL || targetAttachment.url;

        // Typing indicator is now handled by ReactionGateway

        try {
            await this.downloadAudio(downloadUrl, filePath);

            const systemInstruction = this.promptService.getTranscribePrompt();
            const audioData = await readFileAsync(filePath);
            const mimeType = targetAttachment.contentType || 'audio/ogg'; // Defaulting if missing

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
                // Discord 2000 char limit splitting
                for (let i = 0; i < quotedText.length; i += 1900) {
                    await this.sendMessage(message, quotedText.slice(i, i + 1900));
                }
            } else {
                await this.sendMessage(message, `<@${userId}> ⚠️ 文字起こし結果が空でした。😓`);
            }

        } catch (error) {
            console.error('Transcription Error:', error);
            await this.sendMessage(message, `<@${userId}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
        } finally {
            // Cleanup
            if (fs.existsSync(filePath)) {
                await unlinkAsync(filePath).catch(err => console.error('Cleanup error:', err));
            }
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

    private downloadAudio(url: string, filePath: string): Promise<void> {
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

    private removeFillerWords(text: string): string {
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
            } else if (pattern.source === '(.)\\1{2,}') {
                cleanText = cleanText.replace(pattern, '$1$1');
            } else {
                cleanText = cleanText.replace(pattern, '');
            }
        });

        return cleanText.trim();
    }
}
