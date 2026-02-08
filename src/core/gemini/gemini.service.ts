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
}
