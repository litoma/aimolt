import { Injectable, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

@Injectable()
export class PromptService implements OnModuleInit {
    private systemPrompt: string = '';
    private likePrompt: string = '';
    private transcribePrompt: string = '';

    constructor(private readonly supabaseService: SupabaseService) { }

    async onModuleInit() {
        await this.refreshPrompts();
    }

    async refreshPrompts() {
        // Try DB first
        const { data, error } = await this.supabaseService.getClient()
            .from('prompts')
            .select('prompt_type, content');

        if (!error && data && data.length > 0) {
            data.forEach(p => {
                if (p.prompt_type === 'system') this.systemPrompt = p.content;
                if (p.prompt_type === 'like_reaction') this.likePrompt = p.content;
                if (p.prompt_type === 'transcribe') this.transcribePrompt = p.content;
            });
            console.log('✅ Prompts refreshed from DB');
        } else {
            console.warn('⚠️ DB Prompt fetch failed or empty, falling back to files:', error?.message);
            await this.loadFromFiles();
        }
    }

    async loadFromFiles() {
        try {
            const promptDir = path.join(process.cwd(), 'prompt');

            // System Prompt
            try {
                this.systemPrompt = await readFileAsync(path.join(promptDir, 'system.txt'), 'utf8');
                console.log('📄 Loaded system prompt from file');
            } catch (e) {
                console.warn('Failed to load system.txt');
            }

            // Like Prompt
            try {
                this.likePrompt = await readFileAsync(path.join(promptDir, 'like_reaction.txt'), 'utf8');
                console.log('📄 Loaded like prompt from file');
            } catch (e) {
                // Ignore missing specific prompts
            }
            // Transcribe Prompt
            try {
                this.transcribePrompt = await readFileAsync(path.join(promptDir, 'transcribe.txt'), 'utf8');
            } catch (e) {
                // Ignore
            }

        } catch (error) {
            console.error('❌ Failed to load prompts from files:', error);
        }
    }

    getSystemPrompt(): string {
        return this.systemPrompt || 'You are a helpful assistant.';
    }

    getLikePrompt(): string {
        return this.likePrompt || 'Generate a positive, short reaction.';
    }

    getTranscribePrompt(): string {
        return this.transcribePrompt || 'Transcript the audio to Japanese, removing filler words.';
    }

    // Placeholder for dynamic/adaptive prompts if needed
    async getDynamicLikePrompt(userId: string, message: string): Promise<string> {
        // Logic for retrieving specific prompt variations from DB can go here
        return this.getLikePrompt();
    }
}
