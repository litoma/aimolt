import { createBot, Intents } from "@discordeno/bot";
import { config } from "./src/config.ts";
import { reactionAdd } from "./src/events/reactionAdd.ts";
import { messageCreate } from "./src/events/messageCreate.ts";
import { promptService } from "./src/services/utils/prompt.service.ts";

// Initialize Services
console.log("[Main] Initializing services...");
try {
    console.log("[Main] Fetching prompts...");
    await promptService.refreshPrompts();
    console.log("[Main] Prompts loaded.");
} catch (error) {
    console.error("[Main] Failed to load prompts:", error);
}

const bot = createBot({
    token: config.DISCORD_TOKEN,
    intents: Intents.Guilds | Intents.GuildMessages | Intents.GuildMessageReactions | Intents.MessageContent,
});

// Assign events after bot creation to handle circular dependency and strict grouping
bot.events.reactionAdd = (payload) => reactionAdd(bot, payload);
bot.events.messageCreate = (message) => messageCreate(bot, message);
bot.events.ready = (_bot, { user }) => {
    console.log(`[Main] Logged in as ${user.username}! (Deno)`);
};

console.log("[Main] Starting Deno Bot...");

// Keep-alive interval (every 1 minute for debugging)
console.log("[KeepAlive] System started");
setInterval(() => {
    console.log("🔄 Bot is active! (Keep-Alive via setInterval)");
}, 10 * 1000);

// Start Discord Bot (Background)
bot.start().catch((err) => {
    console.error("[Fatal] Discord Bot crashed:", err);
});

// Start HTTP Server (Required for Deno Deploy)
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖");
});
