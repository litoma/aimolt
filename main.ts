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

// Assign events with explicit wrappers to ensure correct argument mapping
// @ts-ignore: Discordeno type definition mismatch with runtime behavior
bot.events.reactionAdd = (b, p) => reactionAdd(b, p);
// @ts-ignore: Discordeno type definition mismatch with runtime behavior
bot.events.messageCreate = (b, m) => messageCreate(b, m);

console.log("[Main] Event handlers assigned.");

bot.events.ready = (_bot, { user }) => {
    console.log(`[Main] Logged in as ${user.username}! (Deno)`);
};
bot.events.debug = (data) => {
    // Log Heartbeats to verify connection is alive
    if (data.includes("Heartbeat") || data.includes("MESSAGE_CREATE") || data.includes("Dispatch")) {
        console.log(`[Debug] ${data}`);
    }
};

// Start Discord Bot (Background)
bot.start().catch((err) => {
    console.error("[Fatal] Discord Bot crashed:", err);
});

// Keep track of last run
let lastCronRun = "Never";

// Start HTTP Server (Required for Deno Deploy health checks)
Deno.serve({ port: 8000 }, (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
        return new Response(JSON.stringify({
            status: "ok",
            last_cron: lastCronRun,
            uptime: performance.now(),
            memory: Deno.memoryUsage()
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }
    return new Response("Discord Bot is running 🤖");
});

// Keep-alive via Interval (Reliable fallback for serverless)
console.log("[Main] Starting Keep-Alive Interval...");
setInterval(() => {
    lastCronRun = new Date().toISOString();
    console.log(`[Interval] Keep-Alive Tick at ${lastCronRun}`);

    // Optional: Check if bot is connected?
    // This simple log keeps the isolate busy if it's not frozen.
}, 60 * 1000); // Every 1 minute
