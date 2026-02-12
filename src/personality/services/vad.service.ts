import { Injectable } from '@nestjs/common';
import { SupabaseEmotionRepository } from '../repositories/supabase-emotion.repository';
import { Emotion } from '../entities/emotion.entity';

@Injectable()
export class VADService {
    constructor(
        private readonly emotionRepository: SupabaseEmotionRepository,
    ) { }

    async getCurrentEmotion(userId: string): Promise<Emotion> {
        const emotion = await this.emotionRepository.findByUserId(userId);
        if (!emotion) {
            return this.createInitialEmotion(userId);
        }
        return emotion;
    }

    async createInitialEmotion(userId: string): Promise<Emotion> {
        const defaultEmotion = Emotion.createDefault(userId);
        return await this.emotionRepository.create(defaultEmotion);
    }

    async updateEmotion(userId: string, message: string): Promise<Emotion> {
        let emotion = await this.emotionRepository.findByUserId(userId);
        if (!emotion) {
            emotion = await this.createInitialEmotion(userId);
        }

        const vadDelta = this.calculateVAD(message);

        // Simple linear update (can be tailored)
        // Adjust current values towards the target or just add/subtract
        // Let's implement a simple shift for now based on delta - 50 (center)
        // Normalize: 0-100. Delta > 50 increases, < 50 decreases.
        // Sensitivity factor 0.5 (Increased from 0.1 for visibility)
        const k = 0.5;

        emotion.valence = Math.round(Math.max(0, Math.min(100, emotion.valence + (vadDelta.valence - 50) * k)));
        emotion.arousal = Math.round(Math.max(0, Math.min(100, emotion.arousal + (vadDelta.arousal - 50) * k)));
        emotion.dominance = Math.round(Math.max(0, Math.min(100, emotion.dominance + (vadDelta.dominance - 50) * k)));

        emotion.updated_at = new Date();

        return await this.emotionRepository.update(emotion);
    }

    // --- VAD Calculation Logic (Ported) ---

    calculateVAD(message: string) {
        return {
            valence: this.calculateValence(message),
            arousal: this.calculateArousal(message),
            dominance: this.calculateDominance(message),
        };
    }

    private calculateValence(message: string): number {
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
        positivePatterns.forEach(p => { const m = message.match(p); if (m) score += m.length * 8; });
        negativePatterns.forEach(p => { const m = message.match(p); if (m) score -= m.length * 8; });
        return Math.max(0, Math.min(100, score));
    }

    private calculateArousal(message: string): number {
        const high = [/！|!|やった|すごい|びっくり|急いで|興奮|テンション|盛り上がる/gi, /熱い|燃える|アツい|ワクワク|ドキドキ|はやく|今すぐ/gi];
        const low = [/疲れた|眠い|ゆっくり|落ち着く|静か|穏やか|のんびり|リラックス/gi];

        let score = 50;
        high.forEach(p => { const m = message.match(p); if (m) score += m.length * 10; });
        low.forEach(p => { const m = message.match(p); if (m) score -= m.length * 8; });

        if (message.length > 100) score += 5;
        const exclamations = (message.match(/！|!/g) || []).length;
        score += exclamations * 3;
        return Math.max(0, Math.min(100, score));
    }

    private calculateDominance(message: string): number {
        const high = [/決める|指示|命令|やってください|しなければ|すべき|必要|重要/gi, /私が|僕が|確信|絶対|間違いない|当然|明らか|決定/gi];
        const low = [/お願い|助けて|わからない|困った|どうしよう|教えて|聞きたい/gi, /すみません|申し訳|恐縮|もしよろしければ|できれば/gi];

        let score = 50;
        high.forEach(p => { const m = message.match(p); if (m) score += m.length * 12; });
        low.forEach(p => { const m = message.match(p); if (m) score -= m.length * 10; });
        return Math.max(0, Math.min(100, score));
    }
}
