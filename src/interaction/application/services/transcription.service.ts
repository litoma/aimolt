import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { DiscordService } from '../../../discord/discord.service';
import { Message, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';
import * as https from 'https';
import { AnalysisService } from '../../../personality/services/analysis.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class TranscriptionService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly discordService: DiscordService,
        private readonly supabaseService: SupabaseService,
        private readonly analysisService: AnalysisService,
    ) { }

    async handleTranscription(message: Message, userId: string, saveToDb: boolean = true): Promise<void> {
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

        const maxSize = 20 * 1024 * 1024; // Lower limit for memory safety (20MB)
        if (targetAttachment.size > maxSize) {
            await this.sendMessage(message, `<@${userId}> ❌ ファイルサイズが大きすぎます（20MBまで）`);
            return;
        }

        const downloadUrl = targetAttachment.proxyURL || targetAttachment.url;

        try {
            const audioBuffer = await this.downloadAudio(downloadUrl);
            const systemInstruction = this.promptService.getTranscribePrompt();

            // Determine MIME type
            let mimeType = targetAttachment.contentType;
            if (!mimeType) {
                const ext = (targetAttachment.name || '').toLowerCase().split('.').pop();
                switch (ext) {
                    case 'mp3': mimeType = 'audio/mpeg'; break;
                    case 'wav': mimeType = 'audio/wav'; break;
                    case 'm4a': mimeType = 'audio/mp4'; break;
                    case 'ogg': mimeType = 'audio/ogg'; break;
                    default: mimeType = 'audio/ogg'; // Default fallback
                }
            }

            const parts = [
                '以下の音声を日本語のテキストに変換し、フィラー語を除去して自然な文章にしてください。',
                {
                    inlineData: {
                        data: audioBuffer.toString('base64'),
                        mimeType: mimeType
                    }
                }
            ];

            const transcriptionRaw = await this.geminiService.generateTextWithParts(
                systemInstruction,
                parts,
                { temperature: 0.1 } // Low temperature to prevent hallucinations
            );
            const cleanedText = this.removeFillerWords(transcriptionRaw);

            await this.sendMessage(message, '🎉文字起こしが完了しました');

            if (cleanedText.trim()) {
                // Send as text
                const MAX_LENGTH = 1900;
                if (cleanedText.length > MAX_LENGTH) {
                    // Send as file
                    const buffer = Buffer.from(cleanedText, 'utf-8');
                    await this.sendMessage(message, '📝 文字起こし結果が長いため、テキストファイルで送信します。', [{
                        attachment: buffer,
                        name: 'transcription.txt'
                    }]);
                } else {
                    // Send as text
                    await this.sendMessage(message, `>>> ${cleanedText}`);
                }

                // Save to DB and Generate Advice
                if (saveToDb) {
                    const embedding = await this.geminiService.embedText(cleanedText);
                    const transcriptId = await this.saveTranscription(userId, cleanedText, embedding);

                    if (transcriptId) {
                        try {
                            const advice = await this.analysisService.generateAdvice(cleanedText);
                            if (advice) {
                                await this.sendMessage(message, `💡 **AIからのアドバイス**: \n${advice}`);
                                await this.updateAdvice(transcriptId, advice);
                            }
                        } catch (adviceError) {
                            console.error('Advice generation failed:', adviceError);
                        }
                    }
                }

            } else {
                await this.sendMessage(message, `<@${userId}> ⚠️ 文字起こし結果が空でした`);
            }

        } catch (error) {
            console.error('Transcription Error:', error);
            await this.sendMessage(message, `<@${userId}> ❌ 音声処理中にエラーが発生しました: ${error.message}`);
        }
    }

    private async saveTranscription(userId: string, text: string, embedding: number[]): Promise<number | null> {
        try {
            const { data, error } = await this.supabaseService.getClient()
                .from('transcripts')
                .insert([{
                    user_id: userId,
                    text: text,
                    embedding: embedding,
                    created_at: new Date()
                }])
                .select('id')
                .single();

            if (error) {
                console.error('Failed to save transcription:', error);
                return null;
            } else {
                console.log(`Saved transcription for user ${userId}, ID: ${data.id}`);
                return data.id;
            }
        } catch (err) {
            console.error('Supabase persistence error (transcripts):', err);
            return null;
        }
    }

    private async updateAdvice(id: number, advice: string): Promise<void> {
        try {
            const { error } = await this.supabaseService.getClient()
                .from('transcripts')
                .update({ advice: advice })
                .eq('id', id);

            if (error) {
                console.error(`Failed to update advice for transcript ${id}:`, error);
            }
        } catch (err) {
            console.error(`Supabase persistence error (update advice ${id}):`, err);
        }
    }

    private async sendMessage(originalMessage: Message, content: string, files?: any[]): Promise<Message | null> {
        const channel = originalMessage.channel as TextChannel | DMChannel | NewsChannel | ThreadChannel;
        if (channel.send) {
            return await channel.send({ content, files });
        }
        return null;
    }

    private downloadAudio(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const chunks: Buffer[] = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
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
