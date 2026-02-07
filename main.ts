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
bot.events.debug = (data) => {
    // Filter for relevant debug events to avoid noise
    if (data.includes("MESSAGE_CREATE") || data.includes("Dispatch")) {
        console.log(`[Debug] ${data}`);
    }
};

// Start HTTP Server (Required for Deno Deploy)
// We start this first to ensure health checks pass regardless of Gateway lock
Deno.serve({ port: 8000 }, (_req) => {
    return new Response("Discord Bot is running 🤖");
});

// Singleton Gateway Management via Deno KV
async function startBotSingleton() {
    try {
        const kv = await Deno.openKv();
        const lockKey = ["gateway_active"];
        const instanceId = crypto.randomUUID();

        console.log(`[Main] Instance ${instanceId} attempting to acquire Gateway lock...`);

        // Simple leader election: Try to set if not exists, or if expired (TTL)
        // Since we don't have a perfect heartbeat here without complexity, we'll try a simpler approach first:
        // Just try to run. If Deno Deploy kills us, lock releases? No, KV persists.
        // We need a TTL (Time To Live). 
        // Let's use a "heartbeat" loop. If we hold the lock, we update it.
        // If lock is old, we take it.

        const heartbeatInterval = 10_000; // 10s
        const lockTTL = 20_000; // 20s expiration

        const attemptLock = async () => {
            const res = await kv.get<{ instanceId: string, lastSeen: number }>(lockKey);
            const now = Date.now();

            let shouldTake = false;
            if (!res.value) {
                shouldTake = true;
            } else if (now - res.value.lastSeen > lockTTL) {
                console.log(`[Main] Lock expired (Last seen: ${now - res.value.lastSeen}ms ago). Taking over.`);
                shouldTake = true;
            }

            if (shouldTake) {
                const setRes = await kv.atomic()
                    .check(res) // Ensure value hasn't changed
                    .set(lockKey, { instanceId, lastSeen: now })
                    .commit();

                if (setRes.ok) {
                    console.log(`[Main] 👑 Lock acquired! Starting Gateway (Shard 0).`);
                    startGateway();
                    // Start heartbeat
                    setInterval(async () => {
                        await kv.set(lockKey, { instanceId, lastSeen: Date.now() });
                    }, heartbeatInterval);
                    return true;
                } else {
                    console.log(`[Main] Failed to acquire lock (conflict). Retrying...`);
                    return false;
                }
            } else {
                // console.log(`[Main] Gateway already active (Instance: ${res.value?.instanceId}). Standing by.`);
                return false;
            }
        };

        // Try immediately
        await attemptLock();

        // If we didn't get it, we could retry or just be a passive node.
        // Deno Deploy might spin up a new node and kill the old one. We want the new one to take over eventually.
        // So we should check periodically?
        setInterval(async () => {
            const res = await kv.get<{ instanceId: string }>(lockKey);
            if (res.value?.instanceId !== instanceId) {
                await attemptLock();
            }
        }, heartbeatInterval);

    } catch (err) {
        console.error("[Main] KV Error:", err);
        // Fallback: Just start if KV fails?
        startGateway();
    }
}

let gatewayStarted = false;
function startGateway() {
    if (gatewayStarted) return;
    gatewayStarted = true;

    console.log("[Main] Starting Deno Bot...");
    bot.start().catch((err) => {
        console.error("[Fatal] Discord Bot crashed:", err);
        // If crash, maybe release lock?
    });
}

// Start the singleton logic
startBotSingleton();
