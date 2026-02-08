import { Injectable } from '@nestjs/common';
import { SYSTEM_PROMPT, LIKE_REACTION_PROMPT, TRANSCRIBE_PROMPT } from '../../config/prompts';

@Injectable()
export class PromptService {
    constructor() { }

    getSystemPrompt(): string {
        return SYSTEM_PROMPT;
    }

    getLikePrompt(): string {
        return LIKE_REACTION_PROMPT;
    }

    getTranscribePrompt(): string {
        return TRANSCRIBE_PROMPT;
    }

    // Placeholder for dynamic/adaptive prompts if needed
    async getDynamicLikePrompt(userId: string, message: string): Promise<string> {
        return this.getLikePrompt();
    }
}
