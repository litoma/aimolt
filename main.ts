import { createBot, Intents } from "@discordeno/bot";
import { config } from "./src/config.ts";
import { reactionAdd } from "./src/events/reactionAdd.ts";
import { promptService } from "./src/services/utils/prompt.service.ts";

// Initialize Services
await promptService.refreshPrompts();

const bot = createBot({
    token: config.DISCORD_TOKEN,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.GuildMessageReactions | Intents.MessageContent,
    events: {
        reactionAdd,
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

await bot.start();
