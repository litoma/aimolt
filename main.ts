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
// Assign events after bot creation to handle circular dependency and strict grouping
// Note: We cast to 'any' because Discordeno types expect (payload) => void, but runtime passes (bot, payload)
(bot.events.reactionAdd as any) = reactionAdd;
(bot.events.messageCreate as any) = messageCreate;
bot.events.ready = (_bot, { user }) => {
    console.log(`[Main] Logged in as ${user.username}! (Deno)`);
};
bot.events.debug = (data) => {
    // Filter for relevant debug events to avoid noise
    if (data.includes("MESSAGE_CREATE") || data.includes("Dispatch")) {
        console.log(`[Debug] ${data}`);
    }
};

// Start Discord Bot (Background)
bot.start().catch((err) => {
    console.error("[Fatal] Discord Bot crashed:", err);
});

// Start HTTP Server (Required for Deno Deploy health checks)
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖");
});

// Keep-alive via Deno.cron (as requested by user)
// Note: execution requires --unstable-cron flag locally if using older Deno, but standard on Deploy.
try {
    Deno.cron("KeepAlive", "*/3 * * * *", () => {
        console.log("🔄 Bot is active! (Cron execution)");
    });
} catch (e) {
    console.warn("Deno.cron not supported in this environment, falling back to interval.");
    setInterval(() => {
        console.log("🔄 Bot is active! (Interval fallback)");
    }, 3 * 60 * 1000);
}
