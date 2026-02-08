import { ConfigService } from '@nestjs/config';
import { CommonService } from '../common/common.service';
export declare class GeminiService {
    private configService;
    private commonService;
    private genAI;
    private model;
    constructor(configService: ConfigService, commonService: CommonService);
    generateText(systemPrompt: string, userPrompt: string): Promise<string>;
    generateTextWithParts(systemPrompt: string, parts: any[]): Promise<string>;
    startChat(systemPrompt: string, history: any[]): Promise<import("@google/generative-ai").ChatSession>;
}
