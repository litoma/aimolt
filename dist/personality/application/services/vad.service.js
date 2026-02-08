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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VADService = void 0;
const common_1 = require("@nestjs/common");
const emotion_repository_interface_1 = require("../../domain/repositories/emotion.repository.interface");
const emotion_entity_1 = require("../../domain/entities/emotion.entity");
let VADService = class VADService {
    constructor(emotionRepository) {
        this.emotionRepository = emotionRepository;
    }
    async getCurrentEmotion(userId) {
        const emotion = await this.emotionRepository.findByUserId(userId);
        if (!emotion) {
            return this.createInitialEmotion(userId);
        }
        return emotion;
    }
    async createInitialEmotion(userId) {
        const defaultEmotion = emotion_entity_1.Emotion.createDefault(userId);
        return await this.emotionRepository.create(defaultEmotion);
    }
    async updateEmotion(userId, message) {
        let emotion = await this.emotionRepository.findByUserId(userId);
        if (!emotion) {
            emotion = await this.createInitialEmotion(userId);
        }
        const vadDelta = this.calculateVAD(message);
        const k = 0.1;
        emotion.valence = Math.max(0, Math.min(100, emotion.valence + (vadDelta.valence - 50) * k));
        emotion.arousal = Math.max(0, Math.min(100, emotion.arousal + (vadDelta.arousal - 50) * k));
        emotion.dominance = Math.max(0, Math.min(100, emotion.dominance + (vadDelta.dominance - 50) * k));
        return await this.emotionRepository.update(emotion);
    }
    calculateVAD(message) {
        return {
            valence: this.calculateValence(message),
            arousal: this.calculateArousal(message),
            dominance: this.calculateDominance(message),
        };
    }
    calculateValence(message) {
        const positivePatterns = [
            /嬉しい|楽しい|好き|最高|ありがと|幸せ|喜び|素晴らしい|良い|面白い/gi,
            /やった|成功|達成|完了|クリア|解決|できた|よかった|安心/gi,
            /笑|www|ｗ|爆笑|へー|すごい|さすが|いいね|オッケー|OK/gi
        ];
        const negativePatterns = [
            /悲しい|つらい|辛い|嫌|ダメ|最悪|ひどい|むかつく|腹立つ|怒り/gi,
            /疲れた|しんどい|きつい|大変|困った|難しい|無理|失敗|負け/gi,
            /心配|不安|怖い|恐い|びっくり|驚き|ショック|がっかり/gi
        ];
        let score = 50;
        positivePatterns.forEach(p => { const m = message.match(p); if (m)
            score += m.length * 8; });
        negativePatterns.forEach(p => { const m = message.match(p); if (m)
            score -= m.length * 8; });
        return Math.max(0, Math.min(100, score));
    }
    calculateArousal(message) {
        const high = [/！|!|やった|すごい|びっくり|急いで|興奮|テンション|盛り上がる/gi, /熱い|燃える|アツい|ワクワク|ドキドキ|はやく|今すぐ/gi];
        const low = [/疲れた|眠い|ゆっくり|落ち着く|静か|穏やか|のんびり|リラックス/gi];
        let score = 50;
        high.forEach(p => { const m = message.match(p); if (m)
            score += m.length * 10; });
        low.forEach(p => { const m = message.match(p); if (m)
            score -= m.length * 8; });
        if (message.length > 100)
            score += 5;
        const exclamations = (message.match(/！|!/g) || []).length;
        score += exclamations * 3;
        return Math.max(0, Math.min(100, score));
    }
    calculateDominance(message) {
        const high = [/決める|指示|命令|やってください|しなければ|すべき|必要|重要/gi, /私が|僕が|確信|絶対|間違いない|当然|明らか|決定/gi];
        const low = [/お願い|助けて|わからない|困った|どうしよう|教えて|聞きたい/gi, /すみません|申し訳|恐縮|もしよろしければ|できれば/gi];
        let score = 50;
        high.forEach(p => { const m = message.match(p); if (m)
            score += m.length * 12; });
        low.forEach(p => { const m = message.match(p); if (m)
            score -= m.length * 10; });
        return Math.max(0, Math.min(100, score));
    }
};
exports.VADService = VADService;
exports.VADService = VADService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(emotion_repository_interface_1.IEmotionRepository)),
    __metadata("design:paramtypes", [Object])
], VADService);
//# sourceMappingURL=vad.service.js.map