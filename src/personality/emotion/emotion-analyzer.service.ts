
import { Injectable, Logger } from '@nestjs/common';
import { GeminiService } from '../../core/gemini/gemini.service';
import {
    EmotionState,
    EmotionUpdateResult,
    GeminiEmotionDelta,
} from './types/emotion.types';

@Injectable()
export class EmotionAnalyzerService {
    private readonly logger = new Logger(EmotionAnalyzerService.name);

    constructor(private readonly geminiService: GeminiService) { }

    /**
     * 現在のVAD値を考慮して、メッセージによる感情変化を計算
     * 
     * @param message ユーザーからのメッセージ
     * @param currentVAD 現在の感情状態
     * @param context 会話の文脈（オプション）
     * @returns 更新後の感情状態と変化量
     */
    async analyzeEmotionChange(
        message: string,
        currentVAD: EmotionState,
        context?: string,
    ): Promise<EmotionUpdateResult> {
        const systemPrompt = this.buildSystemPrompt();
        const userPrompt = this.buildUserPrompt(message, currentVAD, context);

        try {
            const response = await this.geminiService.generateText(systemPrompt, userPrompt); // Changed from generateContent to generateText to match GeminiService
            const delta = this.extractDeltaFromResponse(response);

            if (delta) {
                return this.applyDelta(currentVAD, delta);
            }
        } catch (error) {
            this.logger.error('Emotion analysis failed', error);
        }

        // フォールバック: 変化なし
        return this.createNoChangeResult(currentVAD);
    }

    /**
   * Geminiへのシステムプロンプトを構築
   */
    private buildSystemPrompt(): string {
        return `
あなたはAIアシスタントの感情エンジンです。
ユーザーからのメッセージを受け取ったとき、AIの感情がどう変化すべきかを判定してください。

# 出力形式（必ずJSON形式で返してください）
{
  "valence_delta": -30〜+30の範囲で変化量を指定,
  "arousal_delta": -30〜+30の範囲で変化量を指定,
  "dominance_delta": -30〜+30の範囲で変化量を指定,
  "reason": "判定理由を1〜2文で説明"
}

# 判定基準
**Valence（感情価）の変化:**
- 感謝・褒め言葉・ポジティブな内容 → +10〜+30
- 批判・不満・ネガティブな内容 → -10〜-30
- 中立的な質問・情報交換 → -5〜+5

**Arousal（覚醒度）の変化:**
- 驚き・緊急性・強い感情表現 → +10〜+30
- 落ち着いた会話・日常的な話題 → -5〜-15
- 退屈・単調な内容 → -10〜-20

**Dominance（支配性）の変化:**
- AIへの信頼・頼り・相談 → +5〜+15（AIの主体性が上がる）
- AIへの指示・命令的な態度 → -5〜-15（受動的になる）
- 対等な会話・共感的なやりとり → -3〜+3

# 重要な制約
- 各deltaは **-30〜+30** の範囲内に収めてください
- 現在値が極端な場合（例: valence=90）、さらに同方向への変化は小さくしてください
- 1回の会話で劇的に変化しすぎないよう、控えめな値を推奨します
- **必ずJSON形式のみを返してください。説明文は不要です。**
`;
    }

    /**
     * Geminiへのユーザープロンプトを構築
     */
    private buildUserPrompt(
        message: string,
        currentVAD: EmotionState,
        context?: string,
    ): string {
        return `
# 現在のAIの感情状態（VADモデル、各0～100スケール）
- Valence（感情価）: ${currentVAD.valence} / 100
  → 0=非常にネガティブ、50=中立、100=非常にポジティブ
- Arousal（覚醒度）: ${currentVAD.arousal} / 100
  → 0=非常に落ち着いている、100=非常に興奮している
- Dominance（支配性）: ${currentVAD.dominance} / 100
  → 0=非常に受動的、100=非常に主体的・自信がある

# ユーザーからのメッセージ
${message}

${context ? `# 会話の文脈\n${context}` : ''}

# タスク
このメッセージを受けて、AIの各感情値がどれだけ変化すべきかを判定してください。
`;
    }

    /**
     * Geminiの応答からJSON部分を抽出してパース
     */
    private extractDeltaFromResponse(response: string): GeminiEmotionDelta | null {
        try {
            // JSONブロックを抽出（```json ... ``` や { ... } の形式に対応）
            const jsonMatch = response.match(/\{[\s\S]*?\}/);

            if (!jsonMatch) {
                this.logger.warn('No JSON found in Gemini response');
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]) as GeminiEmotionDelta;

            // バリデーション
            if (
                typeof parsed.valence_delta !== 'number' ||
                typeof parsed.arousal_delta !== 'number' ||
                typeof parsed.dominance_delta !== 'number'
            ) {
                this.logger.warn('Invalid delta format in response');
                return null;
            }

            // delta値を-30〜+30に制限
            parsed.valence_delta = this.clamp(parsed.valence_delta, -30, 30);
            parsed.arousal_delta = this.clamp(parsed.arousal_delta, -30, 30);
            parsed.dominance_delta = this.clamp(parsed.dominance_delta, -30, 30);

            return parsed;
        } catch (error) {
            this.logger.error('Failed to parse Gemini response', error);
            return null;
        }
    }

    /**
     * delta値を適用して新しいVAD値を計算
     */
    private applyDelta(
        current: EmotionState,
        delta: GeminiEmotionDelta,
    ): EmotionUpdateResult {
        // 境界値での変化を抑制（飽和特性）
        const applyWithSaturation = (
            current: number,
            delta: number,
            min: number,
            max: number,
        ): number => {
            const proposed = current + delta;

            // 単純なクランプ
            if (proposed > max) return max;
            if (proposed < min) return min;

            // 境界に近い場合は変化を減衰（オプション）
            const distanceFromMax = max - current;
            const distanceFromMin = current - min;
            const distanceFromEdge = Math.min(distanceFromMax, distanceFromMin);

            // 境界20以内で変化量を減衰
            if (distanceFromEdge < 20) {
                const saturationFactor = distanceFromEdge / 20;
                return Math.round(current + delta * saturationFactor);
            }

            return Math.round(proposed);
        };

        const newValence = applyWithSaturation(current.valence, delta.valence_delta, 0, 100);
        const newArousal = applyWithSaturation(current.arousal, delta.arousal_delta, 0, 100);
        const newDominance = applyWithSaturation(current.dominance, delta.dominance_delta, 0, 100);

        return {
            valence: newValence,
            arousal: newArousal,
            dominance: newDominance,
            delta: {
                valence: newValence - current.valence,
                arousal: newArousal - current.arousal,
                dominance: newDominance - current.dominance,
            },
            reason: delta.reason || 'No reason provided',
        };
    }

    /**
     * フォールバック用: 変化なしの結果を返す
     */
    private createNoChangeResult(current: EmotionState): EmotionUpdateResult {
        return {
            valence: current.valence,
            arousal: current.arousal,
            dominance: current.dominance,
            delta: {
                valence: 0,
                arousal: 0,
                dominance: 0,
            },
            reason: 'Analysis failed, no change applied',
        };
    }

    /**
     * 値を範囲内にクランプ
     */
    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
