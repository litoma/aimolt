import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { CommonService } from '../common/common.service';

@Injectable()
export class GeminiService {
    private genAI: GoogleGenAI;

    constructor(
        private configService: ConfigService,
        private commonService: CommonService
    ) {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY is not defined');

        this.genAI = new GoogleGenAI({ apiKey });
    }

    async generateText(systemPrompt: string, userPrompt: string, _modelOverride?: string, generationConfig?: object): Promise<string> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
            if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

            const result = await this.genAI.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                    systemInstruction: systemPrompt,
                    ...(generationConfig || {})
                }
            });

            return result.text || '';
        }, 3, 1000, 10000, 'Gemini Text Generation');
    }

    async generateTextWithParts(systemPrompt: string, parts: any[], config?: any): Promise<string> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
            if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

            const result = await this.genAI.models.generateContent({
                model: modelName,
                contents: parts,
                config: {
                    systemInstruction: systemPrompt,
                    ...(config || {})
                }
            });

            return result.text || '';
        }, 3, 1000, 10000, 'Gemini Multimodal Generation');
    }

    async startChat(systemPrompt: string, history: any[]) {
        const modelName = this.configService.get<string>('GEMINI_AI_MODEL');
        if (!modelName) throw new Error('GEMINI_AI_MODEL is not defined');

        return this.genAI.chats.create({
            model: modelName,
            config: {
                systemInstruction: systemPrompt
            },
            history: history
        });
    }

    async embedText(text: string): Promise<number[]> {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get<string>('GEMINI_AI_MODEL_EMBEDDING') || 'models/gemini-embedding-001';

            // Truncate text to fit within 2048 tokens.
            // Estimation: 1 token ~ 1.5 chars (Japanese/mixed). 
            // 2048 tokens ~ 3000 chars. Setting safe limit to 3000 chars.
            const SAFE_MAX_CHARS = 3000;
            const truncatedText = text.length > SAFE_MAX_CHARS ? text.slice(0, SAFE_MAX_CHARS) : text;

            const result = await this.genAI.models.embedContent({
                model: modelName,
                contents: truncatedText
            });
            return result.embeddings?.[0]?.values || [];
        }, 3, 1000, 10000, 'Gemini Embedding Generation');
    }
}
