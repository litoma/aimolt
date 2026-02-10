import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { CommonService } from '../common/common.service';

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(
        private configService: ConfigService,
        private commonService: CommonService
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

        this.genAI = new GoogleGenerativeAI(apiKey);

        const modelId = this.configService.get<string>('GEMINI_AI_MODEL');
        if (!modelId) throw new Error('GEMINI_AI_MODEL is not defined');

        this.model = this.genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 1.0,
                topP: 0.95,
            }
        });
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
            if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, 'Gemini Text Generation');
    }

    async generateTextWithParts(systemPrompt: string, parts: any[]): Promise<string> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
            if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(parts);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, 'Gemini Multimodal Generation');
    }

    async startChat(systemPrompt: string, history: any[]) {
        const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
        if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

        const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt
        });
        return model.startChat({ history });
    }

    async embedText(text: string): Promise<number[]> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL_EMBEDDING') || 'models/gemini-embedding-001';

            // Truncate text to fit within 2048 tokens.
            // For Japanese, 1 character can sometimes be close to 1 token.
            // To be absolutely safe against the 2048 token limit, we set the char limit to 2000.
            const SAFE_MAX_CHARS = 2000;
            const truncatedText = text.length > SAFE_MAX_CHARS ? text.slice(0, SAFE_MAX_CHARS) : text;

            const model = this.genAI.getGenerativeModel({ model: modelName });
            const result = await model.embedContent(truncatedText);
            return result.embedding.values;
        }, 3, 1000, 10000, 'Gemini Embedding Generation');
    }
}
