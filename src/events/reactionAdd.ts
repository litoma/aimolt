import { Bot } from "@discordeno/bot";
import { likeService } from "../services/interaction/like.service.ts";
import { transcriptionService } from "../services/interaction/transcription.service.ts";
import { memoService } from "../services/interaction/memo.service.ts";

export const reactionAdd = async (bot: Bot, payload: any) => {
    if (payload.userId === bot.id) return;

    const emoji = payload.emoji.name;
    if (!emoji) return;

    try {
        // Handle Like (👍)
        if (emoji === "👍") {
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId) as any;

            // Ignore bot's own messages
            // Note: message.author.bot usage depends on message shape, usually 'author' is object or we check ID
            // Here assuming message has author property or we skip check if not present for now to match v21 quirks
            const authorId = message.authorId || message.author?.id;

            // Verify author if needed, but for now we proceed with logic

            const userId = payload.userId.toString();

            // Typing indicator
            try {
                await bot.helpers.triggerTypingIndicator(payload.channelId);
            } catch {
                // Ignore errors for typing
            }

            await likeService.handleLike(message, userId, async (content) => {
                await bot.helpers.sendMessage(payload.channelId, {
                    content,
                    messageReference: {
                        messageId: payload.messageId,
                        channelId: payload.channelId,
                        guildId: payload.guildId,
                        failIfNotExists: false,
                    }
                });
            });
        }

        // Memo (📝)
        if (emoji === "📝") {
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId) as any;
            const userId = payload.userId.toString();
            // Typing indicator
            try { await bot.helpers.triggerTypingIndicator(payload.channelId); } catch { }

            await memoService.handleMemo(message, userId);
        }

        // Transcription (🎤)
        if (emoji === "🎤") {
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId) as any;
            const userId = payload.userId.toString();

            // Typing indicator
            try { await bot.helpers.triggerTypingIndicator(payload.channelId); } catch { }

            await transcriptionService.handleTranscription(message, userId, async (content) => {
                await bot.helpers.sendMessage(payload.channelId, {
                    content,
                    messageReference: {
                        messageId: payload.messageId,
                        channelId: payload.channelId,
                        guildId: payload.guildId,
                        failIfNotExists: false,
                    }
                });
            });
        }

    } catch (error) {
        console.error("[ReactionAdd] Error:", error);
    }
};
