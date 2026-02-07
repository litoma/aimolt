import { load } from "@std/dotenv";

// Load environment variables from .env file
await load({ export: true });

export const config = {
    // Application
    CONVERSATION_LIMIT: parseInt(Deno.env.get("CONVERSATION_LIMIT") || "100"),

    // Discord
    DISCORD_TOKEN: Deno.env.get("DISCORD_BOT_TOKEN") || "",

    // Supabase
    SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
    SUPABASE_KEY: Deno.env.get("SUPABASE_KEY") || "",

    // Gemini
    GEMINI_API_KEY: Deno.env.get("GEMINI_API_KEY") || "",
    GEMINI_AI_MODEL: Deno.env.get("GEMINI_AI_MODEL") || "gemini-3-flash-preview",

    // Obsidian
    OBSIDIAN_URL: Deno.env.get("OBSIDIAN_URL") || "",
    OBSIDIAN_API: Deno.env.get("OBSIDIAN_API") || "",
};

// Log warning if critical keys are missing
if (!config.DISCORD_TOKEN) console.warn("Missing DISCORD_TOKEN");
if (!config.SUPABASE_URL) console.warn("Missing SUPABASE_URL");
if (!config.SUPABASE_KEY) console.warn("Missing SUPABASE_KEY");
if (!config.GEMINI_API_KEY) console.warn("Missing GEMINI_API_KEY");
