import { supabase } from "../../supabase.ts";
import { join } from "@std/path";

export class PromptService {
    private systemPrompt: string = "";
    private likePrompt: string = "";
    private transcribePrompt: string = "";

    // Helper to get singleton instance initialized
    static async create(): Promise<PromptService> {
        const service = new PromptService();
        await service.refreshPrompts();
        return service;
    }

    async refreshPrompts() {
        // Try DB first
        const { data, error } = await supabase
            .from("prompts")
            .select("prompt_type, content");

        if (!error && data && data.length > 0) {
            data.forEach((p) => {
                if (p.prompt_type === "system") this.systemPrompt = p.content;
                if (p.prompt_type === "like_reaction") this.likePrompt = p.content;
                if (p.prompt_type === "transcribe") this.transcribePrompt = p.content;
            });
            console.log("✅ Prompts refreshed from DB");
        } else {
            // Debug: Check which URL we are connecting to
            const dbUrl = Deno.env.get("SUPABASE_URL") || "UNKNOWN";
            const maskedUrl = dbUrl.length > 10 ? `${dbUrl.slice(0, 8)}...` : dbUrl;
            console.warn(`⚠️ DB Prompt fetch failed or empty (URL: ${maskedUrl}), falling back to files:`, error?.message);

            await this.loadFromFiles();
        }
    }

    async loadFromFiles() {
        try {
            const cwd = Deno.cwd();
            console.log(`📂 Current Working Directory: ${cwd}`);

            const promptDir = join(cwd, "prompt");
            console.log(`📂 Target Prompt Directory: ${promptDir}`);

            // Debug: List files in prompt dir if possible
            try {
                for await (const dirEntry of Deno.readDir(promptDir)) {
                    console.log(`📄 Found file in prompt dir: ${dirEntry.name}`);
                }
            } catch (e) {
                console.warn(`⚠️ Could not list files in ${promptDir}:`, e);
            }

            // System Prompt
            try {
                this.systemPrompt = await Deno.readTextFile(join(promptDir, "system.txt"));
                console.log("📄 Loaded system prompt from file");
            } catch (e) {
                console.warn("⚠️ Failed to load system.txt:", e);
            }

            // Like Prompt
            try {
                this.likePrompt = await Deno.readTextFile(join(promptDir, "like.txt"));
                console.log("📄 Loaded like prompt from file");
            } catch (e) {
                console.warn("⚠️ Failed to load like.txt:", e);
            }

            // Transcribe Prompt
            try {
                this.transcribePrompt = await Deno.readTextFile(join(promptDir, "transcribe.txt"));
            } catch (e) {
                console.warn("⚠️ Failed to load transcribe.txt:", e);
            }
        } catch (error) {
            console.error("❌ Failed to load prompts from files (Critical):", error);
        }
    }

    getSystemPrompt(): string {
        return this.systemPrompt || "You are a helpful assistant.";
    }

    getLikePrompt(): string {
        return this.likePrompt || "Generate a positive, short reaction.";
    }

    getTranscribePrompt(): string {
        return this.transcribePrompt || "Transcript the audio to Japanese, removing filler words.";
    }
}

// Singleton handling is a bit trickier with async init.
// We export a function to get the initialized service, or verify init in getter.
// For simplicity, we export an instance that needs initialization, or lazy load?
// Better: Export a singleton instance, but callers should ensure it's initialized?
// Or, initialize in main.ts and export the instance.

export const promptService = new PromptService();
