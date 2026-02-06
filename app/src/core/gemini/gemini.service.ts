import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

@Injectable()
export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

        this.genAI = new GoogleGenerativeAI(apiKey);
        // Default to gemini-3-flash-preview as requested by user
        const modelId = this.configService.get<string>('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';

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
        try {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    }

    async generateTextWithParts(systemPrompt: string, parts: any[]): Promise<string> {
        try {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(parts);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini API Error (Multimodal):', error);
            throw error;
        }
    }

    async startChat(systemPrompt: string, history: any[]) {
        const modelName = this.configService.get<string>('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
        const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt
        });
        return model.startChat({ history });
    }
}
