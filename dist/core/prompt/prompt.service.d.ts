import { OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
export declare class PromptService implements OnModuleInit {
    private readonly supabaseService;
    private systemPrompt;
    private likePrompt;
    private transcribePrompt;
    constructor(supabaseService: SupabaseService);
    onModuleInit(): Promise<void>;
    refreshPrompts(): Promise<void>;
    loadFromFiles(): Promise<void>;
    getSystemPrompt(): string;
    getLikePrompt(): string;
    getTranscribePrompt(): string;
    getDynamicLikePrompt(userId: string, message: string): Promise<string>;
}
