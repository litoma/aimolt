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

// Keep-alive cron job (every 3 minutes)
Deno.cron("Continuous Request", "*/3 * * * *", () => {
    console.log("🔄 Bot is active!");
});

await bot.start();
