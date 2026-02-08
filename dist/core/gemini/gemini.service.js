"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
const common_service_1 = require("../common/common.service");
let GeminiService = class GeminiService {
    constructor(configService, commonService) {
        this.configService = configService;
        this.commonService = commonService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        if (!apiKey)
            throw new Error('GEMINI_API_KEY is not defined');
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const modelId = this.configService.get('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
        this.model = this.genAI.getGenerativeModel({
            model: modelId,
            generationConfig: {
                maxOutputTokens: 2000,
                temperature: 1.0,
                topP: 0.95,
            }
        });
    }
    async generateText(systemPrompt, userPrompt) {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });
            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, 'Gemini Text Generation');
    }
    async generateTextWithParts(systemPrompt, parts) {
        return this.commonService.retry(async () => {
            const modelName = this.configService.get('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
            const model = this.genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemPrompt,
            });
            const result = await model.generateContent(parts);
            const response = await result.response;
            return response.text();
        }, 3, 1000, 10000, 'Gemini Multimodal Generation');
    }
    async startChat(systemPrompt, history) {
        const modelName = this.configService.get('GEMINI_AI_MODEL') || 'gemini-3-flash-preview';
        const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt
        });
        return model.startChat({ history });
    }
};
exports.GeminiService = GeminiService;
exports.GeminiService = GeminiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        common_service_1.CommonService])
], GeminiService);
//# sourceMappingURL=gemini.service.js.map