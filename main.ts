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

// Deno Deploy requires an HTTP server to keep the deployment alive/healthy
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖");
});

// Keep-alive interval (every 1 minute for debugging)
console.log("[KeepAlive] System started");
setInterval(() => {
    console.log("🔄 Bot is active! (Keep-Alive via setInterval)");
}, 1 * 60 * 1000);

await bot.start();
