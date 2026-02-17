import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { Message, TextChannel, DMChannel, NewsChannel, ThreadChannel } from 'discord.js';
import axios from 'axios';
import { DiscordService } from '../../../discord/discord.service';
import { AnalysisService } from '../../../personality/services/analysis.service';
import { ImpressionService } from '../../../personality/services/impression.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { SystemService } from '../../../core/system/system.service';

@Injectable()
export class TranscriptionService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly discordService: DiscordService,
        private readonly supabaseService: SupabaseService,
        private readonly analysisService: AnalysisService,
        private readonly impressionService: ImpressionService,
        private readonly systemService: SystemService,
    ) { }

    async handleTranscription(message: Message, userId: string, options: { saveToDb: boolean; generateAdvice: boolean; updateActivity: boolean }): Promise<void> {
        // Update activity time
        if (options.updateActivity) {
            this.systemService.updateActivityTime().catch(err => console.error('Failed to update activity time', err));
        }

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

        // Use .url (CDN) instead of .proxyURL (Media Proxy) to avoid potential 415/403 issues with some file types
        const downloadUrl = targetAttachment.url || targetAttachment.proxyURL;

        try {
            const audioBuffer = await this.downloadAudio(downloadUrl);
            const systemInstruction = this.promptService.getTranscribePrompt();

            // Determine MIME type
            const ext = (targetAttachment.name || '').toLowerCase().split('.').pop();
            let mimeType = targetAttachment.contentType;

            // Force or fallback MIME type based on extension
            // Discord sometimes sends 'application/octet-stream' or 'audio/x-m4a' which Gemini might not like.
            switch (ext) {
                case 'mp3': mimeType = 'audio/mpeg'; break;
                case 'wav': mimeType = 'audio/wav'; break;
                case 'm4a': mimeType = 'audio/mp4'; break;
                case 'ogg': mimeType = 'audio/ogg'; break;
                case 'aac': mimeType = 'audio/aac'; break;
                case 'flac': mimeType = 'audio/flac'; break;
                default:
                    // Only use fallback if MIME type is missing or generic
                    if (!mimeType || mimeType === 'application/octet-stream') {
                        mimeType = 'audio/ogg';
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

            await this.sendMessage(message, '🎤 **文字起こしが完了しました**:');

            if (cleanedText.trim()) {
                // Send as text
                const MAX_LENGTH = 1900;
                let transcriptMessage: Message | null = null;

                if (cleanedText.length > MAX_LENGTH) {
                    // Send as file
                    const buffer = Buffer.from(cleanedText, 'utf-8');
                    transcriptMessage = await this.sendMessage(message, '📝 文字起こし結果が長いため、テキストファイルで送信します。', [{
                        attachment: buffer,
                        name: 'transcription.txt'
                    }]);
                } else {
                    // Send as text
                    transcriptMessage = await this.sendMessage(message, `>>> ${cleanedText}`);
                }

                // Save to DB and Generate Advice
                if (options.saveToDb) {
                    const embedding = await this.geminiService.embedText(cleanedText);
                    const transcriptId = await this.saveTranscription(userId, cleanedText, embedding);

                    if (transcriptId) {
                        // Update Relationship (Impression Analysis) - Async
                        this.impressionService.analyzeAndUpdate(userId, 'transcript', cleanedText)
                            .catch(err => console.error('Impression update failure:', err));

                        if (options.generateAdvice) {
                            await this.generateAndSendAdvice(userId, cleanedText, transcriptMessage || message, transcriptId);
                        }
                    }

                } else if (options.generateAdvice) {
                    // Generate advice without saving to DB (Ephemeral advice)
                    // Transcript ID is null here
                    await this.generateAndSendAdvice(userId, cleanedText, transcriptMessage || message, null);
                }

            } else {
                await this.sendMessage(message, `<@${userId}> ⚠️ 文字起こし結果が空でした`);
            }

        } catch (error) {
            console.error('Transcription Error:', error);
            await this.sendMessage(message, `<@${userId}> ❌ 音声処理中にエラーが発生しました: ${error.message}`);
        }
    }

    private async generateAndSendAdvice(userId: string, text: string, replyTarget: Message, transcriptId: number | null) {
        try {
            const advice = await this.analysisService.generateAdvice(text);
            if (advice) {
                const replyContent = `<@${userId}>\n${advice}`;
                await replyTarget.reply(replyContent);

                if (transcriptId) {
                    await this.updateAdvice(transcriptId, advice);
                }
            }
        } catch (adviceError) {
            console.error('Advice generation failed:', adviceError);
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

    private async sendMessage(originalMessage: Message, content: string, files?: any[], embeds?: any[]): Promise<Message | null> {
        const channel = originalMessage.channel as TextChannel | DMChannel | NewsChannel | ThreadChannel;
        if (channel.send) {
            return await channel.send({ content, files, embeds });
        }
        return null;
    }

    private async downloadAudio(url: string): Promise<Buffer> {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'DiscordBot (AImolt, 1.0.0)'
                }
            });
            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download audio: ${error.message} (URL: ${url})`);
        }
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
