import { supabase } from "../../supabase.ts";
import { Emotion, DefaultEmotion } from "../../types/personality.ts";

export class VADService {
    async getCurrentEmotion(userId: string): Promise<Emotion> {
        const emotion = await this.findByUserId(userId);
        if (!emotion) {
            return this.createInitialEmotion(userId);
        }
        return emotion;
    }

    async createInitialEmotion(userId: string): Promise<Emotion> {
        const defaultEmotion = DefaultEmotion(userId);
        return await this.save(defaultEmotion);
    }

    async updateEmotion(userId: string, message: string): Promise<Emotion> {
        let emotion = await this.findByUserId(userId);
        if (!emotion) {
            emotion = await this.createInitialEmotion(userId);
        }

        const vadDelta = this.calculateVAD(message);

        const k = 0.1;
        emotion.valence = Math.max(0, Math.min(100, emotion.valence + (vadDelta.valence - 50) * k));
        emotion.arousal = Math.max(0, Math.min(100, emotion.arousal + (vadDelta.arousal - 50) * k));
        emotion.dominance = Math.max(0, Math.min(100, emotion.dominance + (vadDelta.dominance - 50) * k));

        return await this.update(emotion);
    }

    // --- Repository Logic ---

    private async findByUserId(userId: string): Promise<Emotion | null> {
        const { data, error } = await supabase
            .from("emotion_states")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) return null;
        return data as Emotion;
    }

    private async save(emotion: Emotion): Promise<Emotion> {
        const { data, error } = await supabase
            .from("emotion_states")
            .insert([emotion])
            .select()
            .single();

        if (error) {
            console.error("[VADService] Save Error:", JSON.stringify(error, null, 2));
            throw error;
        }
        return data as Emotion;
    }

    private async update(emotion: Emotion): Promise<Emotion> {
        const { data, error } = await supabase
            .from("emotion_states")
            .update(emotion)
            .eq("user_id", emotion.user_id)
            .select()
            .single();

        if (error) {
            console.error("[VADService] Update Error:", JSON.stringify(error, null, 2));
            throw error;
        }
        return data as Emotion;
    }

    // --- VAD Calculation Logic ---

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

export const vadService = new VADService();
