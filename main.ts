import { createBot, Intents } from "@discordeno/bot";
import { config } from "./src/config.ts";
import { reactionAdd } from "./src/events/reactionAdd.ts";
import { messageCreate } from "./src/events/messageCreate.ts";
import { promptService } from "./src/services/utils/prompt.service.ts";

// Initialize Services
await promptService.refreshPrompts();

const bot = createBot({
    token: config.DISCORD_TOKEN,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.GuildMessageReactions | Intents.MessageContent,
    events: {
        reactionAdd,
        messageCreate,
        ready: (_bot, { user }) => {
            console.log(`[Main] Logged in as ${user.username}! (Deno)`);
        }
    },
});

console.log("[Main] Starting Deno Bot...");

// 1. Setup Keep-Alive (setInterval)
console.log("[KeepAlive] System started");
setInterval(() => {
    console.log("🔄 Bot is active! (Keep-Alive via setInterval)");
}, 1 * 60 * 1000);

// 2. Start Discord Bot (Background)
// Don't await here, so Deno.serve can start immediately after
bot.start().catch((err) => {
    console.error("[Fatal] Discord Bot crashed:", err);
});

// 3. Start HTTP Server (Required for Deno Deploy)
// This might block the main thread depending on environment, so we put it last
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖");
});
