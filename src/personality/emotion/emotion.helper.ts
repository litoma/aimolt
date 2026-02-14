
import { EmotionState } from './types/emotion.types';

/**
 * 感情状態を人間が読みやすい形式に変換するヘルパー
 */
export class EmotionHelper {
    /**
     * Valenceをラベルに変換
     */
    static getValenceLabel(valence: number): string {
        if (valence >= 80) return 'とてもポジティブ';
        if (valence >= 60) return 'ポジティブ';
        if (valence >= 45) return 'やや中立〜ポジティブ';
        if (valence >= 40) return '中立';
        if (valence >= 25) return 'やや中立〜ネガティブ';
        if (valence >= 20) return 'ネガティブ';
        return 'とてもネガティブ';
    }

    /**
     * Arousalをラベルに変換
     */
    static getArousalLabel(arousal: number): string {
        if (arousal >= 80) return 'とても興奮';
        if (arousal >= 60) return '興奮';
        if (arousal >= 40) return 'やや活発';
        if (arousal >= 20) return 'やや落ち着き';
        return 'とても落ち着き';
    }

    /**
     * Dominanceをラベルに変換
     */
    static getDominanceLabel(dominance: number): string {
        if (dominance >= 80) return 'とても主体的';
        if (dominance >= 60) return '主体的';
        if (dominance >= 40) return 'やや主体的';
        if (dominance >= 20) return 'やや受動的';
        return 'とても受動的';
    }

    /**
     * ポジティブかどうか判定
     */
    static isPositive(valence: number): boolean {
        return valence > 50;
    }

    /**
     * ネガティブかどうか判定
     */
    static isNegative(valence: number): boolean {
        return valence < 50;
    }

    /**
     * 中立かどうか判定
     */
    static isNeutral(valence: number): boolean {
        return valence >= 40 && valence <= 60;
    }

    /**
     * 感情状態をサマリー文字列に変換
     */
    static getSummary(emotion: EmotionState): string {
        const v = this.getValenceLabel(emotion.valence);
        const a = this.getArousalLabel(emotion.arousal);
        const d = this.getDominanceLabel(emotion.dominance);

        return `${v}、${a}、${d}な状態`;
    }

    /**
     * 感情状態をログ用文字列に変換
     */
    static toLogString(emotion: EmotionState): string {
        return `V:${emotion.valence}, A:${emotion.arousal}, D:${emotion.dominance}`;
    }
}
