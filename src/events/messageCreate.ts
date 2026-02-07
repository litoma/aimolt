import { Bot, EventHandlers } from "@discordeno/bot";
import { vadService } from "../services/personality/vad.service.ts";

export const messageCreate: EventHandlers["messageCreate"] = async (bot: Bot, message) => {
    console.log(`[MessageCreate] Received message: ${message.content} from ${message.authorId}, isBot: ${message.isBot}`);

    // Ignore bot's own messages
    if (message.isBot) return;

    const content = message.content.trim();

    // Command: !personality status
    if (content === "!personality status") {
        console.log("[MessageCreate] Command detected!");
        try {
            const userId = message.authorId.toString();
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
