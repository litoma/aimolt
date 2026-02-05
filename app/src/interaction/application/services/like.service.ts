import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { VADService } from '../../../personality/application/services/vad.service';
import { Message } from 'discord.js';

@Injectable()
export class LikeService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly vadService: VADService,
    ) { }

    async handleLike(message: Message, userId: string): Promise<void> {
        const userMessage = message.content;
        if (!userMessage) {
            await message.reply('メッセージが空か無効です！😅');
            return;
        }

        try {
            const systemInstruction = this.promptService.getSystemPrompt();
            const baseLikePrompt = this.promptService.getLikePrompt();

            const promptWithMessage = `${baseLikePrompt}\n\nユーザーのメッセージ: ${userMessage}`;

            const replyText = await this.geminiService.generateText(
                systemInstruction,
                promptWithMessage
            );

            // Update Personality (Fire and Forget) is skipped for now as planned

            await message.reply(replyText.slice(0, 2000));

        } catch (error) {
            console.error('Error in LikeService:', error);
            await message.reply('うわっ、なんかミスっちゃったみたい！🙈');
        }
    }
}
