import { Injectable, Logger } from '@nestjs/common';
import { EmotionAnalyzerService } from '../emotion/emotion-analyzer.service';
import { EmotionHelper } from '../emotion/emotion.helper';
import { EmotionState } from '../emotion/types/emotion.types';
import { SupabaseEmotionRepository } from '../repositories/supabase-emotion.repository';
import { Emotion } from '../entities/emotion.entity';

@Injectable()
export class PersonalityService {
    private readonly logger = new Logger(PersonalityService.name);

    constructor(
        private readonly emotionAnalyzer: EmotionAnalyzerService,
        private readonly emotionRepository: SupabaseEmotionRepository,
    ) { }

    /**
     * ユーザーメッセージを処理して感情状態を更新
     */
    async processUserMessage(
        userId: string,
        message: string,
        context?: string,
    ): Promise<EmotionState> {
        // 1. 現在のVAD値を取得
        const currentEmotion = await this.getCurrentEmotion(userId);

        this.logger.debug(
            `Current emotion for ${userId}: ${EmotionHelper.toLogString(currentEmotion)}`,
        );

        // 2. メッセージによる感情変化を分析
        const result = await this.emotionAnalyzer.analyzeEmotionChange(
            message,
            currentEmotion,
            context,
        );

        // 3. 変化をログ出力
        this.logger.log(
            `Emotion update for ${userId}:
      Before: ${EmotionHelper.toLogString(currentEmotion)}
      Delta:  V:${result.delta.valence > 0 ? '+' : ''}${result.delta.valence}, A:${result.delta.arousal > 0 ? '+' : ''}${result.delta.arousal}, D:${result.delta.dominance > 0 ? '+' : ''}${result.delta.dominance}
      After:  ${EmotionHelper.toLogString(result)}
      Reason: ${result.reason}`,
        );

        // 4. DBに保存
        await this.saveEmotion(userId, result);

        return {
            valence: result.valence,
            arousal: result.arousal,
            dominance: result.dominance,
        };
    }

    /**
     * 現在の感情状態を取得（存在しない場合はデフォルト値）
     */
    private async getCurrentEmotion(userId: string): Promise<EmotionState> {
        const emotion = await this.emotionRepository.findByUserId(userId);

        if (!emotion) {
            // デフォルト値: 中立的な状態
            return {
                valence: 50,
                arousal: 50,
                dominance: 50,
            };
        }

        return {
            valence: emotion.valence,
            arousal: emotion.arousal,
            dominance: emotion.dominance,
        };
    }

    /**
     * 感情状態をDBに保存
     */
    private async saveEmotion(
        userId: string,
        emotionState: EmotionState,
    ): Promise<void> {
        const emotion = new Emotion({
            user_id: userId,
            valence: emotionState.valence,
            arousal: emotionState.arousal,
            dominance: emotionState.dominance,
            updated_at: new Date()
        });

        try {
            // Try update first
            try {
                await this.emotionRepository.update(emotion);
            } catch (error) {
                // Return if simple update fails, try check and upsert
                const existing = await this.emotionRepository.findByUserId(userId);
                if (existing) {
                    await this.emotionRepository.update(emotion);
                } else {
                    await this.emotionRepository.create(emotion);
                }
            }
        } catch (e) {
            this.logger.error(`Failed to save emotion for ${userId}`, e);
            throw e;
        }
    }

    /**
     * 感情状態のサマリーを取得（デバッグ・UI用）
     */
    async getEmotionSummary(userId: string): Promise<string> {
        const emotion = await this.getCurrentEmotion(userId);
        return EmotionHelper.getSummary(emotion);
    }

    /**
     * 現在の感情状態を取得（公的アクセサ）
     */
    async getCurrentEmotionState(userId: string): Promise<EmotionState> {
        return this.getCurrentEmotion(userId);
    }
}
