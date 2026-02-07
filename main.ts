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

// Singleton Gateway Management via Supabase
import { supabase } from "./supabase.ts";

async function startBotSingleton() {
    try {
        const lockId = "gateway_shard_0";
        const instanceId = crypto.randomUUID();
        const heartbeatInterval = 10_000; // 10s
        const lockTTL = 25_000; // 25s expiration

        console.log(`[Main] Instance ${instanceId} attempting to acquire Gateway lock (Supabase)...`);

        const attemptLock = async () => {
            const now = new Date();
            const threshold = new Date(now.getTime() - lockTTL).toISOString();

            // 1. Try to fetch existing lock
            const { data: currentLock, error: fetchError } = await supabase
                .from("bot_locks")
                .select("*")
                .eq("id", lockId)
                .single();

            if (fetchError && fetchError.code !== "PGRST116") { // Ignore "Row not found"
                console.error("[Main] Lock fetch error:", fetchError.message);
                return false;
            }

            let shouldTake = false;
            if (!currentLock) {
                // No lock exists, try to insert
                const { error: insertError } = await supabase
                    .from("bot_locks")
                    .insert([{ id: lockId, instance_id: instanceId, last_seen_at: new Date().toISOString() }]);

                if (!insertError) shouldTake = true;
            } else if (currentLock.last_seen_at < threshold || currentLock.instance_id === instanceId) {
                // Lock expired or we already own it (restart case), try to update
                const { error: updateError } = await supabase
                    .from("bot_locks")
                    .update({ instance_id: instanceId, last_seen_at: new Date().toISOString() })
                    .eq("id", lockId)
                    // Optimistic concurrency: ensure we are updating the same stale record? 
                    // Actually, if it's expired, we just overwrite.
                    // Ideally we check instance_id hasn't changed in split second, but simplified here.
                    .select("*"); // verify?

                if (!updateError) shouldTake = true;
            }

            if (shouldTake) {
                console.log(`[Main] 👑 Lock acquired! Starting Gateway.`);
                startGateway();

                // Start heartbeat
                setInterval(async () => {
                    await supabase
                        .from("bot_locks")
                        .update({ last_seen_at: new Date().toISOString() })
                        .eq("id", lockId)
                        .eq("instance_id", instanceId); // Only update if we still own it
                }, heartbeatInterval);
                return true;
            }

            return false;
        };

        // Try immediately
        await attemptLock();

        // Periodic check for takeover
        setInterval(async () => {
            // If gateway not started, try to acquire
            if (!gatewayStarted) {
                await attemptLock();
            }
        }, heartbeatInterval);

    } catch (err) {
        console.error("[Main] Locking Error:", err);
        // Fallback: dangerous
        // startGateway(); 
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
