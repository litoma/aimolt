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

// Assign events with explicit wrappers to inject the 'bot' instance
// Discordeno v21 passes (payload) to the handler, so we must inject 'bot' ourselves.
// @ts-ignore
bot.events.messageCreate = (...args: any[]) => {
    console.log(`[Debug] messageCreate args length: ${args.length}`);
    if (args.length > 0) {
        // Inspect first argument (shallow)
        const arg0 = args[0];
        console.log(`[Debug] Arg[0] keys: ${Object.keys(arg0 || {}).join(", ")}`);
        // Check if it looks like a Bot or a Message
        if (arg0.events) console.log("[Debug] Arg[0] looks like Bot");
        if (arg0.content !== undefined) console.log("[Debug] Arg[0] looks like Message");
    }
    if (args.length > 1) {
        const arg1 = args[1];
        console.log(`[Debug] Arg[1] keys: ${Object.keys(arg1 || {}).join(", ")}`);
        if (arg1.content !== undefined) console.log("[Debug] Arg[1] looks like Message");
    }

    // Attempt to route based on inspection
    if (args.length === 1 && args[0].content !== undefined) {
        // It is (message)
        return messageCreate(bot, args[0]);
    } else if (args.length >= 2 && args[1]?.content !== undefined) {
        // It is (bot, message)
        return messageCreate(args[0], args[1]);
    } else {
        console.warn("[Debug] Could not map arguments to messageCreate handler.");
    }
};

bot.events.reactionAdd = (...args: any[]) => {
    // Just simple mapping for now, assuming same pattern strictly
    if (args.length === 1) return reactionAdd(bot, args[0]);
    if (args.length >= 2) return reactionAdd(args[0], args[1]);
};

console.log("[Main] Event handlers assigned with bot injection.");

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
