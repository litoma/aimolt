import { Message } from "@discordeno/bot";
import { config } from "../../config.ts";
import { supabase } from "../../supabase.ts";
import { geminiService } from "../ai/gemini.service.ts";
import { promptService } from "../utils/prompt.service.ts";
import { vadService } from "../personality/vad.service.ts";
import { relationshipService } from "../personality/relationship.service.ts";

export class LikeService {
    async handleLike(message: Message, userId: string, sendReply: (content: string) => Promise<void>): Promise<void> {
        const userMessage = message.content;
        if (!userMessage) {
            await sendReply("メッセージが空か無効です！😅");
            return;
        }

        try {
            // 1. Save User Message
            await this.saveConversation(userId, "user", userMessage);

            // 2. Fetch Conversation History (Context)
            const limit = config.CONVERSATION_LIMIT || 100;
            const history = await this.getRecentContext(userId, limit);

            // 3. Prepare Prompt
            const systemInstruction = promptService.getSystemPrompt();
            const baseLikePrompt = promptService.getLikePrompt();

            let contextBlock = "";
            if (history.length > 0) {
                contextBlock = "\n\n【直近の会話履歴】\n" +
                    history.map((h) => `${h.role === "user" ? "ユーザー" : "AImolt"}: ${h.content}`).join("\n");
            }

            const promptWithMessage = `${baseLikePrompt}${contextBlock}\n\nユーザーのメッセージ: ${userMessage}`;

            // 4. Generate Response
            const replyText = await geminiService.generateText(
                systemInstruction,
                promptWithMessage,
            );

            // 5. Send Reply
            // Truncate to 2000 chars if needed (Discord limit)
            await sendReply(replyText.slice(0, 2000));

            // 6. Save AI Response
            await this.saveConversation(userId, "assistant", replyText);

            // 7. Update Personality (Fire and forget)
            this.updatePersonality(userId, userMessage).catch((err) =>
                console.error("Personality update error:", err)
            );
        } catch (error) {
            console.error("Error in LikeService:", error);
            await sendReply("うわっ、なんかミスっちゃったみたい！🙈");
        }
    }

    private async updatePersonality(userId: string, userMessage: string) {
        // Update Emotion (VAD)
        const newEmotion = await vadService.updateEmotion(userId, userMessage);

        // Derive approximate sentiment from Valence
        let sentiment = "neutral";
        if (newEmotion.valence > 60) sentiment = "positive";
        if (newEmotion.valence < 40) sentiment = "negative";

        // Update Relationship
        await relationshipService.updateRelationship(userId, {
            sentiment: sentiment,
            sentimentScore: (newEmotion.valence - 50) / 50,
        });
    }

    private async getRecentContext(
        userId: string,
        limit: number,
    ): Promise<{ role: string; content: string }[]> {
        const { data, error } = await supabase
            .from("conversations")
            .select("user_message, bot_response, initiator, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Failed to fetch context:", error);
            return [];
        }

        return (data || []).reverse().map((item) => {
            const role = item.initiator === "user" ? "user" : "assistant";
            const content = item.initiator === "user" ? item.user_message : item.bot_response;
            return { role, content };
        }).filter((item) => item.content);
    }

    private async saveConversation(
        userId: string,
        role: "user" | "assistant",
        content: string,
    ): Promise<void> {
        try {
            const payload = {
                user_id: userId,
                initiator: role === "user" ? "user" : "bot",
                user_message: role === "user" ? content : "",
                bot_response: role === "assistant" ? content : "",
                message_type: "text",
            };

            const { error } = await supabase
                .from("conversations")
                .insert([payload]);

            if (error) {
                console.error(`Failed to save ${role} message to Supabase:`, error);
            }
        } catch (err) {
            console.error("Supabase persistence error:", err);
        }
    }
}

export const likeService = new LikeService();
