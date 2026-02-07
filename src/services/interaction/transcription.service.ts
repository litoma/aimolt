import { Message } from "@discordeno/bot";
import { geminiService } from "../ai/gemini.service.ts";
import { promptService } from "../utils/prompt.service.ts";
import { encodeBase64 } from "@std/encoding";

export class TranscriptionService {
    async handleTranscription(
        message: Message,
        userId: string,
        sendReply: (content: string) => Promise<void>
    ): Promise<void> {
        const audioExts = [".ogg", ".mp3", ".wav", ".m4a"];
        let targetAttachment = null;

        if (message.attachments) {
            for (const attachment of message.attachments) {
                const filenameLower = (attachment.filename || "").toLowerCase();
                if (audioExts.some((ext) => filenameLower.endsWith(ext))) {
                    targetAttachment = attachment;
                    break;
                }
            }
        }

        if (!targetAttachment) {
            await sendReply(`<@${userId}> ⚠️ 音声ファイルが見つかりません。対応形式: ${audioExts.join(", ")}`);
            return;
        }

        // Check size (approximate, since Discordeno attachment size might not be directly available or named differently? 
        // Types say `size` exists).
        const maxSize = 100 * 1024 * 1024; // 100MB
        if (targetAttachment.size && targetAttachment.size > maxSize) {
            await sendReply(`<@${userId}> ❌ ファイルサイズが100MBを超えています。`);
            return;
        }

        const downloadUrl = targetAttachment.proxyUrl || targetAttachment.url;

        try {
            // Download Audio (On-memory)
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(`Failed to download audio: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const base64Data = encodeBase64(arrayBuffer);
            const mimeType = targetAttachment.contentType || "audio/ogg";

            const systemInstruction = promptService.getTranscribePrompt();

            const parts = [
                { text: "以下の音声を日本語のテキストに変換し、フィラー語を除去して自然な文章にしてください。" },
                {
                    inlineData: {
                        data: base64Data,
                        mimeType: mimeType,
                    },
                },
            ];

            const transcriptionRaw = await geminiService.generateTextWithParts(systemInstruction, parts);
            const cleanedText = this.removeFillerWords(transcriptionRaw);

            await sendReply("🎉 文字起こしが完了したよ〜！");

            if (cleanedText.trim()) {
                const quotedText = `>>> ${cleanedText}`;
                // Split if too long
                for (let i = 0; i < quotedText.length; i += 1900) {
                    await sendReply(quotedText.slice(i, i + 1900));
                }
            } else {
                await sendReply(`<@${userId}> ⚠️ 文字起こし結果が空でした。😓`);
            }

        } catch (error) {
            console.error("Transcription Error:", error);
            // await sendReply(`<@${userId}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error instanceof Error ? error.message : "Unknown error"}`);
            await sendReply(`<@${userId}> ❌ 音声処理中にエラーが発生したよ！🙈`);
        }
    }

    private removeFillerWords(text: string): string {
        const fillerPatterns = [
            /\b(あー|ああ|あああ)\b/g,
            /\b(えー|ええ|えええ)\b/g,
            /\b(うー|ううん|うう)\b/g,
            /\b(おー|おお)\b/g,
            /\b(んー|んん)\b/g,
            /\b(まあ|まー)\b/g,
            /\b(そのー|その)\b/g,
            /\b(なんか|なんて)\b/g,
            /\b(ちょっと)\b/g,
            /(.)\1{2,}/g,
            /\s+/g,
        ];

        let cleanText = text;
        // Simple replacement loop
        // Note: JS/TS RegExp might need adjustments for global flag in loop or just chaining
        // The original code used a loop.
        // Deno/V8 RegExp handles unicode?

        // Original loop adjusted:
        const simplePatterns = [
            /あー|ああ|あああ/g,
            /えー|ええ|えええ/g,
            /うー|ううん|うう/g,
            /おー|おお/g,
            /んー|んん/g,
            /まあ|まー/g,
            /そのー|その/g,
            /なんか|なんて/g,
            /ちょっと/g,
            /(.)\1{2,}/g, // Repeating chars
        ];

        simplePatterns.forEach(p => {
            cleanText = cleanText.replace(p, (match) => {
                // Logic for repeating chars: replace with 2 chars? "$1$1"
                if (p.source.includes("(.)\\1{2,}")) {
                    return match.substring(0, 2);
                }
                return "";
            });
        });

        cleanText = cleanText.replace(/\s+/g, " "); // collapse whitespace

        return cleanText.trim();
    }
}

export const transcriptionService = new TranscriptionService();
