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
exports.LikeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const gemini_service_1 = require("../../../core/gemini/gemini.service");
const prompt_service_1 = require("../../../core/prompt/prompt.service");
const vad_service_1 = require("../../../personality/application/services/vad.service");
const relationship_service_1 = require("../../../personality/application/services/relationship.service");
const analysis_service_1 = require("../../../personality/application/services/analysis.service");
const memory_service_1 = require("../../../personality/application/services/memory.service");
const supabase_service_1 = require("../../../core/supabase/supabase.service");
let LikeService = class LikeService {
    constructor(geminiService, promptService, vadService, relationshipService, analysisService, memoryService, supabaseService, configService) {
        this.geminiService = geminiService;
        this.promptService = promptService;
        this.vadService = vadService;
        this.relationshipService = relationshipService;
        this.analysisService = analysisService;
        this.memoryService = memoryService;
        this.supabaseService = supabaseService;
        this.configService = configService;
    }
    async handleLike(message, userId) {
        const userMessage = message.content;
        if (!userMessage) {
            await message.reply('メッセージが空か無効です！😅');
            return;
        }
        try {
            const [_, analysis, history, memories] = await Promise.all([
                this.saveConversation(userId, 'user', userMessage),
                this.analysisService.analyzeMessage(userId, userMessage),
                this.getRecentContext(userId, parseInt(this.configService.get('CONVERSATION_LIMIT'), 10) || 100),
                this.memoryService.getRelevantMemories(userId)
            ]);
            this.memoryService.processMemory(analysis).catch(e => console.error('Memory process error:', e));
            const systemInstruction = this.promptService.getSystemPrompt();
            const baseLikePrompt = this.promptService.getLikePrompt();
            let contextBlock = '';
            if (history.length > 0) {
                contextBlock += '\n\n【直近の会話履歴】\n' + history.map(h => `${h.role === 'user' ? 'ユーザー' : 'AImolt'}: ${h.content}`).join('\n');
            }
            if (memories) {
                contextBlock += '\n\n【ユーザーに関する記憶】\n' + memories;
            }
            const promptWithMessage = `${baseLikePrompt}${contextBlock}\n\nユーザーのメッセージ: ${userMessage}`;
            const replyText = await this.geminiService.generateText(systemInstruction, promptWithMessage);
            await message.reply(replyText.slice(0, 2000));
            await this.saveConversation(userId, 'assistant', replyText);
            this.updatePersonality(userId, userMessage, analysis).catch(err => console.error('Personality update error:', err));
        }
        catch (error) {
            console.error('Error in LikeService:', error);
            await message.reply('うわっ、なんかミスっちゃったみたい！🙈');
        }
    }
    async updatePersonality(userId, userMessage, analysis) {
        const newEmotion = await this.vadService.updateEmotion(userId, userMessage);
        let sentiment = 'neutral';
        if (newEmotion.valence > 60)
            sentiment = 'positive';
        if (newEmotion.valence < 40)
            sentiment = 'negative';
        await this.relationshipService.updateRelationship(userId, {
            sentiment: sentiment,
            sentimentScore: (newEmotion.valence - 50) / 50,
            analysis: analysis,
            vad: newEmotion,
            userMessage: userMessage
        });
    }
    async getRecentContext(userId, limit) {
        const { data, error } = await this.supabaseService.getClient()
            .from('conversations')
            .select('user_message, bot_response, initiator, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('Failed to fetch context:', error);
            return [];
        }
        return (data || []).reverse().map(item => {
            const role = item.initiator === 'user' ? 'user' : 'assistant';
            const content = item.initiator === 'user' ? item.user_message : item.bot_response;
            return { role, content };
        }).filter(item => item.content);
    }
    async saveConversation(userId, role, content) {
        try {
            const payload = {
                user_id: userId,
                initiator: role === 'user' ? 'user' : 'bot',
                user_message: role === 'user' ? content : '',
                bot_response: role === 'assistant' ? content : '',
                message_type: 'text'
            };
            const { error } = await this.supabaseService.getClient()
                .from('conversations')
                .insert([payload]);
            if (error) {
                console.error(`Failed to save ${role} message to Supabase:`, error);
            }
        }
        catch (err) {
            console.error('Supabase persistence error:', err);
        }
    }
};
exports.LikeService = LikeService;
exports.LikeService = LikeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [gemini_service_1.GeminiService,
        prompt_service_1.PromptService,
        vad_service_1.VADService,
        relationship_service_1.RelationshipService,
        analysis_service_1.AnalysisService,
        memory_service_1.MemoryService,
        supabase_service_1.SupabaseService,
        config_1.ConfigService])
], LikeService);
//# sourceMappingURL=like.service.js.map