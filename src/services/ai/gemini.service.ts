import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { config } from "../../config.ts";
import { retry } from "../utils/retry.ts";

export class GeminiService {
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor() {
        if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not defined");

        this.genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
        const modelId = config.GEMINI_AI_MODEL || "gemini-3-flash-preview";

        this.model = this.genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 1.0,
                topP: 0.95,
            },
        });
    }

    async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
        return retry(async () => {
            const modelName = config.GEMINI_AI_MODEL || "gemini-3-flash-preview";
            // Re-instantiate model for request-specific config if needed, 
            // or just use this.model if config is static. 
            // The original code re-instantiated, likely for systemPrompt injection.
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, "Gemini Text Generation");
    }

    // Generate with parts (for multimodal)
    async generateTextWithParts(systemPrompt: string, parts: any[]): Promise<string> {
        return retry(async () => {
            const modelName = config.GEMINI_AI_MODEL || "gemini-3-flash-preview";
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });

            const result = await model.generateContent(parts);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, "Gemini Multimodal Generation");
    }
}

export const geminiService = new GeminiService();
