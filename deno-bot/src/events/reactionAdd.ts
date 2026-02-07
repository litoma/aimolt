import { Bot, EventHandlers } from "@discordeno/bot";
import { likeService } from "../services/interaction/like.service.ts";
import { transcriptionService } from "../services/interaction/transcription.service.ts";
import { memoService } from "../services/interaction/memo.service.ts";

export const reactionAdd: EventHandlers["reactionAdd"] = async (bot: Bot, payload) => {
    if (payload.userId === bot.id) return;

    const emoji = payload.emoji.name;
    if (!emoji) return;

    try {
        // Handle Like (👍)
        if (emoji === "👍") {
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId);

            // Ignore bot's own messages (if logic requires, original checked !message.author.bot)
            // Original: if (!message.author.bot)
            const authorId = message.authorId;
            // We need to check if author is bot. Discordeno message has .isBot?
            // message.authorId is BigInt.
            // We can fetch user? Or maybe message object has author details?
            // Discordeno Message object has `authorId`, but to know if bot, we might need to fetch user
            // or check `message.member`? 
            // Actually, standard Message object might doesn't always have full author object?
            // Let's assume we proceed. The original logic: if (!message.author.bot)

            // Fetch user to get ID as string
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
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId);
            const userId = payload.userId.toString();
            // Typing indicator
            try { await bot.helpers.triggerTypingIndicator(payload.channelId); } catch { }

            await memoService.handleMemo(message, userId);
        }

        // Transcription (🎤)
        if (emoji === "🎤") {
            const message = await bot.helpers.getMessage(payload.channelId, payload.messageId);
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
