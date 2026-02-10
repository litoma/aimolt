import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { DiscordService } from '../../../discord/discord.service';
import { Message } from 'discord.js';
import { SupabaseService } from '../../../core/supabase/supabase.service';
export declare class TranscriptionService {
    private readonly geminiService;
    private readonly promptService;
    private readonly discordService;
    private readonly supabaseService;
    constructor(geminiService: GeminiService, promptService: PromptService, discordService: DiscordService, supabaseService: SupabaseService);
    handleTranscription(message: Message, userId: string, saveToDb?: boolean): Promise<void>;
    private saveTranscription;
    private sendMessage;
    private downloadAudio;
    private removeFillerWords;
    private extractKeywords;
}
