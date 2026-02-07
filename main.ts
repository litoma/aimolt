import { createBot, Intents } from "@discordeno/bot";
import { config } from "./src/config.ts";

// Minimal Bot Implementation for Debugging
console.log("[Main] Starting Minimal Deno Bot...");

const bot = createBot({
    token: config.DISCORD_TOKEN,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.MessageContent,
    events: {
        ready: (_bot, { user }) => {
            console.log(`[Main] Logged in as ${user.username}! (Minimal Mode)`);
        },
        messageCreate: (message) => {
            console.log(`[MessageCreate] Content: ${message.content}`);
            if (message.isBot) return;

            if (message.content === "!ping") {
                bot.helpers.sendMessage(message.channelId, { content: "Pong! 🏓" });
            }
        }
    }
});

// Start HTTP Server (Required for Deno Deploy health checks)
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖 (Minimal)");
});

// Start Bot
bot.start().catch((err) => {
    console.error("[Fatal] Discord Bot crashed:", err);
});
