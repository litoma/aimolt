import { Bot } from "@discordeno/bot";
import { vadService } from "../services/personality/vad.service.ts";
import { relationshipService } from "../services/personality/relationship.service.ts";

export const messageCreate = async (bot: Bot, message: any) => {
    // Determine author ID correctly from v21 structure (message.author.id)
    const authorId = message.author?.id ?? message.authorId;
    const authorName = message.author?.username ?? "Unknown";

    console.log(`[MessageCreate] Received message: ${message?.content} from ${authorName} (${authorId})`);

    // Ignore bot's own messages
    if (message.author?.bot || message.isBot) return;

    const content = message.content?.trim();
    if (!content) return;

    if (content === "!personality status") {
        console.log("[MessageCreate] Command detected!");
        try {
            await bot.helpers.triggerTypingIndicator(message.channelId);
        } catch { /* ignore typing errors */ }

        try {
            if (!authorId) throw new Error("Author ID not found in message object.");

            const userId = authorId.toString();
            const [emotion, relationship] = await Promise.all([
                vadService.getCurrentEmotion(userId),
                relationshipService.getRelationship(userId)
            ]);

            // Helper for Mood Emoji
            const getMoodEmoji = (mood: string) => {
                switch (mood) {
                    case 'happy': return '😄';
                    case 'calm': return '😌';
                    case 'excited': return '🤩';
                    case 'sad': return '😢';
                    case 'angry': return '😠';
                    case 'neutral': return '😐';
                    default: return '😐';
                }
            };

            // Helper for Stage Emoji
            const getStageEmoji = (stage: string) => {
                switch (stage) {
                    case 'close_friend': return '🥰';
                    case 'friend': return '😊';
                    case 'acquaintance': return '🙂';
                    case 'stranger': return '👤';
                    default: return '👤';
                }
            };

            // Format Dates
            const formatDate = (date: string | Date | undefined) => {
                if (!date) return "N/A";
                const d = new Date(date);
                return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')} `;
            };

            // Calculate days known
            const daysKnown = relationship.created_at
                ? Math.floor((new Date().getTime() - new Date(relationship.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : 0;

            const statusMessage = [
                `🧠 ** ${authorName} の人格プロファイル ** `,
                "🎭 **感情状態 (VAD)**",
                `${getMoodEmoji(emotion.mood_type)} ${emotion.mood_type} `,
                `😄 快適度: ${emotion.valence.toFixed(0)}/100`,
                `⚡ 覚醒度: ${emotion.arousal.toFixed(0)}/100`,
                `💪 主導性: ${emotion.dominance.toFixed(0)}/100`,
                `💬 会話回数: ${emotion.conversation_count}回`,
                "",
                "🤝 **関係性**",
                `${getStageEmoji(relationship.relationship_stage)} ${relationship.relationship_stage}`,
                `💖 好感度: ${relationship.affection_level.toFixed(0)}/100`,
                `🤝 信頼度: ${relationship.trust_level.toFixed(0)}/100`,
                `😊 親密度: ${relationship.comfort_level.toFixed(0)}/100`,
                `💬 重要な会話: ${relationship.meaningful_interactions}回`,
                `🗣️ 話し方: ${relationship.preferred_formality}`,
                "",
                "📊 **統計情報**",
                `📅 関係開始: ${daysKnown}日前`,
                `🔄 最終更新: ${formatDate(emotion.updated_at)}`
            ].join("\n");

            await bot.helpers.sendMessage(message.channelId, {
                content: statusMessage,
                messageReference: {
                    messageId: message.id,
                    channelId: message.channelId,
                    guildId: message.guildId,
                    failIfNotExists: false,
                }
            });

        } catch (error: any) {
            console.error("Error fetching personality status:", error);
            // serialized error
            try {
                const errObj = JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                console.error("Error Details:", errObj);
            } catch (e) {
                console.error("Could not serialize error:", e);
            }

            await bot.helpers.sendMessage(message.channelId, {
                content: "❌ Failed to retrieve personality status."
            });
        }
    }
};
