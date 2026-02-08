export declare class PromptService {
    constructor();
    getSystemPrompt(): string;
    getLikePrompt(): string;
    getTranscribePrompt(): string;
    getDynamicLikePrompt(userId: string, message: string): Promise<string>;
}
