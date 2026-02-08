import { Injectable, Inject } from '@nestjs/common';
import { IConversationAnalysisRepository } from '../../domain/repositories/conversation-analysis.repository.interface';
import { ConversationAnalysis } from '../../domain/entities/conversation-analysis.entity';

@Injectable()
export class AnalysisService {
    constructor(
        @Inject(IConversationAnalysisRepository)
        private readonly analysisRepository: IConversationAnalysisRepository,
    ) { }

    async analyzeMessage(userId: string, message: string): Promise<ConversationAnalysis> {
        const analysis = new ConversationAnalysis({
            user_id: userId,
            user_message: message,
            sentiment: this.analyzeSentiment(message),
            emotion_detected: this.detectEmotion(message),
            topic_category: this.categorizeMessage(message),
            keywords: this.extractKeywords(message),
            importance_score: this.calculateImportanceScore(message),
            confidence_score: 0.75 // Default confidence
        });

        return await this.analysisRepository.create(analysis);
    }

    private analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
        const positivePatterns = /楽しい|嬉しい|最高|ありがとう|好き|面白い|すごい/gi;
        const negativePatterns = /悲しい|辛い|最悪|嫌い|つまらない|疲れた|怒っている/gi;

        const positiveMatches = (message.match(positivePatterns) || []).length;
        const negativeMatches = (message.match(negativePatterns) || []).length;

        if (positiveMatches > negativeMatches) return 'positive';
        if (negativeMatches > positiveMatches) return 'negative';
        return 'neutral';
    }

    private detectEmotion(message: string): string {
        const patterns = {
            joy: /嬉しい|楽しい|やった|最高|ハッピー/gi,
            sadness: /悲しい|落ち込む|憂鬱|泣きたい/gi,
            anger: /怒り|むかつく|イライラ/gi,
            fear: /怖い|不安|心配/gi,
            surprise: /びっくり|えっ|まじ|驚き/gi,
            gratitude: /ありがとう|感謝|助かる/gi,
            love: /好き|愛|ラブ/gi,
        };

        for (const [emotion, pattern] of Object.entries(patterns)) {
            if (pattern.test(message)) return emotion;
        }
        return 'neutral';
    }

    private categorizeMessage(message: string): string {
        const categories = {
            coding: /コード|プログラミング|バグ|エラー|実装/gi,
            game: /ゲーム|プレイ|攻略/gi,
            daily: /今日|明日|天気|ご飯|寝る/gi,
            work: /仕事|タスク|会議|残業/gi,
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(message)) return category;
        }
        return 'general';
    }

    private extractKeywords(message: string): string[] {
        // Simple extraction logic: remove common particles and keep meaningful words
        // In production, consider using a proper tokenizer like kuromoji.js
        const stopWords = /^[はがをにへとのでも]|です|ます|した|する/gi;
        return message.split(/\s+/).filter(w => w.length > 2 && !stopWords.test(w)).slice(0, 5);
    }

    private calculateImportanceScore(message: string): number {
        let score = 1;
        if (message.length > 50) score += 2;
        if (message.includes('?')) score += 1;
        if (/重要|緊急|教えて|相談/.test(message)) score += 3;
        return Math.min(score, 10);
    }
}
