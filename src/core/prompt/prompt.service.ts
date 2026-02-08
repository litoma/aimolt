import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

@Injectable()
export class PromptService implements OnModuleInit {
    private systemPrompt: string = '';
    private likePrompt: string = '';
    private transcribePrompt: string = '';

    constructor() { }

    async onModuleInit() {
        await this.loadFromFiles();
    }

    async loadFromFiles() {
        try {
            const promptDir = path.join(process.cwd(), 'prompt');
            console.log(`Loading prompts from: ${promptDir}`);

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
        return this.getLikePrompt();
    }
}
