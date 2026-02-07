import { Message } from "@discordeno/bot";
import { config } from "../../config.ts";

export class MemoService {
    async handleMemo(message: Message, userId: string): Promise<void> {
        if (!config.OBSIDIAN_URL || !config.OBSIDIAN_API) {
            console.warn("[MemoService] Missing Obsidian Config");
            return;
        }

        let inputText = message.content || "";

        // Handle quote block
        if (inputText.startsWith(">>> ")) {
            inputText = inputText.substring(4);
        }

        // Extract embed content (Simplified for Deno)
        // Discordeno Message.embeds is array of Embed objects
        if (message.embeds && message.embeds.length > 0) {
            const embedContent = message.embeds.map((embed: any) => {
                let content = "";
                if (embed.title) content += `# ${embed.title}\n\n`;
                if (embed.description) content += `${embed.description}\n\n`;
                if (embed.fields) {
                    embed.fields.forEach((field: any) => {
                        content += `**${field.name}**: ${field.value}\n\n`;
                    });
                }
                return content;
            }).join("\n---\n");

            if (embedContent) {
                inputText += inputText ? `\n\n【Embed内容】\n${embedContent}` : embedContent;
            }
        }

        if (!inputText.trim()) {
            return;
        }

        // We can't easily send a "processing" message and then edit it in the same way without the bot helper passing through cleanly, 
        // but we can try if we pass the bot format. For now, we'll just Log and Fire-and-Forget the Obsidian save, 
        // or we could use the sendReply callback if we pass it.
        // The previous architecture didn't pass sendReply to handleMemo.
        // We will assume fire-and-forget or we can add a reaction to indicate success?
        // The legacy one sent a message "Adding to Obsidian...".

        // For now, let's just implement the Obsidian push.

        try {
            const messageLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
            // Time in JST
            const now = new Date();
            const timeOnly = now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });

            const finalContent = `- [${timeOnly}](${messageLink}) ${inputText}\n\n`;

            await this.appendToObsidianDaily(finalContent);
            console.log(`[MemoService] Saved to Obsidian: ${finalContent.substring(0, 50)}...`);

        } catch (error) {
            console.error(`[MemoService] Error: ${error}`);
        }
    }

    private async appendToObsidianDaily(content: string) {
        const url = `${config.OBSIDIAN_URL}/periodic/daily/`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${config.OBSIDIAN_API}`,
                "Content-Type": "text/markdown"
            },
            body: content
        });

        if (!response.ok) {
            throw new Error(`Obsidian API Error: ${response.status} ${response.statusText}`);
        }
    }
}

export const memoService = new MemoService();
