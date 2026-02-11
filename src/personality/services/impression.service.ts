import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../core/gemini/gemini.service';
import { RelationshipService } from './relationship.service';
import { Relationship } from '../entities/relationship.entity';

@Injectable()
export class ImpressionService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly relationshipService: RelationshipService
    ) { }

    async analyzeAndUpdate(userId: string, inputType: 'chat' | 'transcript', content: string): Promise<void> {
        try {
            const relationship = await this.relationshipService.getRelationship(userId);

            const systemPrompt = `
あなたは、ユーザーとAI（AImolt）の関係性を分析する「Relationship Analyst」です。
提供された「ユーザーの新しい発言」と「現在の関係性データ」に基づき、以下の4つの項目を更新・算出してください。

### 出力フォーマット (JSONのみ)
\`\`\`json
{
  "impression_summary": "ユーザーの人物像や現在の状況（Text）。新しい発見があれば追記・修正。最大200文字。",
  "mentor_focus": "AIが今意識すべき接し方（Text）。例: 'Listen', 'Encourage', 'Challenge', 'Joke'. 最大3単語。",
  "understanding_delta": 0, // 今回の会話で得られた「理解の深さ」 (0〜5)。深い話や自己開示があれば高くする。
  "affection_delta": 0 // 今回の会話での「好感度変動」 (-5〜+5)。感謝や好意でプラス、拒絶や怒りでマイナス。
}
\`\`\`

### 現在のデータ
- Impression: ${relationship.impression_summary || 'まだ情報なし'}
- Mentor Focus: ${relationship.mentor_focus || 'なし'}

### 分析対象 (${inputType})
${content}
`;

            const response = await this.geminiService.generateText(systemPrompt, "分析を開始してください。");
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            // validate result
            const understandingDelta = result.understanding_delta || 0;
            const affectionDelta = result.affection_delta || 0;
            const newSummary = result.impression_summary || relationship.impression_summary;
            const newFocus = result.mentor_focus || relationship.mentor_focus;

            // Update Relationship
            await this.relationshipService.updateRelationship(userId, {
                impression_summary: newSummary,
                mentor_focus: newFocus,
                understanding_score: relationship.understanding_score + understandingDelta,
                affection_score: Math.min(Math.max(relationship.affection_score + affectionDelta, -100), 100),
                updated_at: new Date()
            });

            console.log(`[ImpressionService] Updated relationship for ${userId}: U+${understandingDelta}, A${affectionDelta > 0 ? '+' : ''}${affectionDelta}`);

        } catch (error) {
            console.error('[ImpressionService] Analysis failed:', error);
        }
    }
}
