import { Bot } from "@discordeno/bot";
import { vadService } from "../services/personality/vad.service.ts";

export const messageCreate = async (bot: Bot, message: any) => {
    // Determine author ID correctly from v21 structure (message.author.id)
    const authorId = message.author?.id ?? message.authorId;
    const authorName = message.author?.username ?? "Unknown";

    console.log(`[MessageCreate] Received message: ${message?.content} from ${authorName} (${authorId})`);

    // Ignore bot's own messages
    if (message.author?.bot || message.isBot) return;

    const content = message.content?.trim();
    if (!content) return;

    // Command: !personality status
    if (content === "!personality status") {
        console.log("[MessageCreate] Command detected!");
        try {
            if (!authorId) throw new Error("Author ID not found in message object.");

            const userId = authorId.toString();
            const emotion = await vadService.getCurrentEmotion(userId);

            const statusMessage = [
                "**📊 Current Personality Status**",
                `Valence (快/不快): ${emotion.valence.toFixed(1)}`,
                `Arousal (活性度): ${emotion.arousal.toFixed(1)}`,
                `Dominance (支配性): ${emotion.dominance.toFixed(1)}`,
                "",
                `Mood: ${emotion.mood_type || "Neutral"}`
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

        } catch (error) {
            console.error("Error fetching personality status:", error);
            await bot.helpers.sendMessage(message.channelId, {
                content: "❌ Failed to retrieve personality status."
            });
        }
    }
};
