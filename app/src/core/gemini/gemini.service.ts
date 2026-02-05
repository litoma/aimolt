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
        this.model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash', // Hardcoded or config
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 1.0,
                topP: 0.95,
            }
        });
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        try {
            // Gemini 1.5 style system instruction via model config if feasible, 
            // or prepend to prompt. Using prepend for broad compatibility here or getGenerativeModel config.
            // Re-instantiating model here to allow dynamic system prompt per call if needed, 
            // or use chat session.

            const model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
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
            const model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-flash',
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
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: systemPrompt
        });
        return model.startChat({ history });
    }
}
