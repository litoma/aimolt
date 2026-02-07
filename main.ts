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
    desiredProperties: {
        interaction: {
            id: true,
            type: true,
            data: true,
            token: true,
            user: true,
            member: true,
        },
        message: {
            id: true,
            content: true,
            author: true,
            channelId: true,
            guildId: true,
            timestamp: true,
        },
        user: {
            id: true,
            username: true,
            discriminator: true,
            bot: true,
        }
    },
});

// Assign events
// Discordeno v21 passes (message) to the handler.
bot.events.reactionAdd = (payload) => reactionAdd(bot, payload);
bot.events.messageCreate = (message) => {
    // console.log(`[Debug] Message: ${message.id} from ${message.author?.id}`);
    return messageCreate(bot, message);
};

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


