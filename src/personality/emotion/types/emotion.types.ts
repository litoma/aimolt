
/**
 * VADモデルに基づく感情状態
 * 全て0～100のスケール
 */
export interface EmotionState {
    valence: number;    // 0=非常にネガティブ, 50=中立, 100=非常にポジティブ
    arousal: number;    // 0=非常に落ち着き, 100=非常に興奮
    dominance: number;  // 0=非常に受動的, 100=非常に主体的
}

/**
 * 感情分析の結果（更新後の値 + 変化量）
 */
export interface EmotionUpdateResult {
    // 更新後の値
    valence: number;
    arousal: number;
    dominance: number;

    // 変化量（デバッグ・ログ用）
    delta: {
        valence: number;
        arousal: number;
        dominance: number;
    };

    // 判定理由
    reason: string;
}

/**
 * Geminiからの応答形式
 */
export interface GeminiEmotionDelta {
    valence_delta: number;
    arousal_delta: number;
    dominance_delta: number;
    reason: string;
}
