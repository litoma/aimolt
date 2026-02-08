import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { DiscordService } from '../../../discord/discord.service';
import { Message } from 'discord.js';
export declare class TranscriptionService {
    private readonly geminiService;
    private readonly promptService;
    private readonly discordService;
    constructor(geminiService: GeminiService, promptService: PromptService, discordService: DiscordService);
    handleTranscription(message: Message, userId: string): Promise<void>;
    private sendMessage;
    private downloadAudio;
    private removeFillerWords;
}
