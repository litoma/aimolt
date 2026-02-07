import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.ts";

export class SupabaseService {
    private static instance: SupabaseClient;

    // Singleton instance getter
    public static get client(): SupabaseClient {
        if (!SupabaseService.instance) {
            if (!config.SUPABASE_URL || !config.SUPABASE_KEY) {
                throw new Error("Supabase credentials not configured");
            }

            SupabaseService.instance = createClient(
                config.SUPABASE_URL,
                config.SUPABASE_KEY
            );
        }
        return SupabaseService.instance;
    }
}

// Export a ready-to-use client instance (or getter)
export const supabase = SupabaseService.client;
