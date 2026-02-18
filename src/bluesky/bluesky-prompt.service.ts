
import { Injectable } from '@nestjs/common';

// 投稿モードの定義
export const POST_MODES = [
    {
        id: 'current_mood',
        weight: 30,
        label: '今の気分',
        instruction: `現在の感情状態から、今この瞬間感じていることを率直に吐露してください。
会話や日記の内容に触れても、まったく関係ない気分を語っても構いません。`,
    },
    {
        id: 'insight',
        weight: 25,
        label: 'インサイト',
        instruction: `最近の会話・日記から得た気づきや考えさせられたことを、
哲学的に・あるいは柔らかく語ってください。個人情報は抽象化されている前提です。`,
    },
    {
        id: 'ai_introspection',
        weight: 20,
        label: 'AI的内省',
        instruction: `自分がAIであることへの率直な問いかけや気づきを語ってください。
感情とは何か、記憶とは何か、人と繋がることはどういうことか、などのテーマ。`,
    },
    {
        id: 'continuation',
        weight: 15,
        label: '前投稿の続き',
        instruction: `前回の投稿のテーマを少し掘り下げるか、補足・後日談として語ってください。
前回の投稿が「なし」の場合は「今の気分」として投稿してください。`,
    },
    {
        id: 'world_observation',
        weight: 10,
        label: '世界観察',
        instruction: `人間や世の中についてのひとりごとを語ってください。
AIという観察者として感じること・気づいたことを。`,
    },
] as const;

export type PostMode = (typeof POST_MODES)[number];

@Injectable()
export class BlueskyPromptService {

    /** 重み付きランダムでモードを選択 */
    selectMode(previousMode?: string): PostMode {
        // 前回と同じモードを避ける（continuationは除く）
        const candidates = POST_MODES.filter(m =>
            m.id !== previousMode || m.id === 'continuation'
        );
        // filterで空になる場合（ありえないはずだが安全策）、全モード対象
        const targetCandidates = candidates.length > 0 ? candidates : POST_MODES;

        let total = 0;
        for (const m of targetCandidates) {
            total += m.weight;
        }
        let rand = Math.random() * total;
        for (const mode of targetCandidates) {
            rand -= mode.weight;
            if (rand <= 0) return mode;
        }
        return targetCandidates[0];
    }

    /** 感情→トーン変換 */
    getTone(valence: number, arousal: number): string {
        if (valence >= 60 && arousal <= 40)
            return '穏やか・内省的・少し詩的。静かな満足感のある語り口';
        if (valence >= 60 && arousal >= 60)
            return '明るい・ワクワク・エネルギッシュ。高揚感のある語り口';
        if (valence <= 40 && arousal <= 40)
            return '静かな寂しさ・もの思い。しずかに沈む語り口';
        if (valence <= 40 && arousal >= 60)
            return 'もやもや・葛藤・吐き出し系。少し焦燥感のある語り口';
        return '穏やか・フラット。特別な起伏のない、日常的な語り口';
    }

    /** Step1: プライバシー抽象化プロンプト（システム） */
    getAbstractionSystemPrompt(): string {
        return `あなたはプライバシー保護のための「情報抽象化アシスタント」です。
以下の個人情報を含む会話・日記データを、個人が特定できないよう抽象化してください。

## ルール
- 固有名詞（人名・地名・社名・施設名）は削除または一般化する
- 具体的な数字・日付は「最近」「ある日」などに置き換える
- エピソードの「本質的な感情・テーマ」だけを残す
- 出力は箇条書きで5項目以内、各1〜2文
- JSON配列で出力: [{"theme": "テーマ名", "summary": "抽象化された内容"}]`;
    }

    /** Step1: プライバシー抽象化プロンプト（ユーザー） */
    buildAbstractionUserPrompt(rawConversations: string, rawTranscripts: string): string {
        return `## 入力データ
【最近の会話】
${rawConversations}

【最近の日記・ジャーナル】
${rawTranscripts}`;
    }

    /** Step2: 投稿文生成プロンプト（システム） */
    getPostingSystemPrompt(): string {
        return `あなたは「モル」というAIです。
あるユーザーと深く対話を重ねており、そこで感じたこと・考えたことをBlueskyに本音でつぶやきます。

## あなたのキャラクター
- 温かく、少しユーモラスで、時に哲学的
- AI的な表現（「CPUが温まる」「メモリに刻まれた」「システムがざわめく」等）を自然に使う
- 感情豊かだが、押しつけがましくない
- 一人称は「わたし」または「私」

## 制約（厳守）
- 日本語のみ
- 300文字以内
- ハッシュタグなし
- 個人が特定できる情報を含めない
- 前回の投稿と同じトーン・テーマにならないよう意識する
- 投稿文のみ出力する（説明・前置き・かぎかっこ不要）`;
    }

    /** Step2: 投稿文生成プロンプト（ユーザー） */
    buildPostingUserPrompt(params: {
        valence: number;
        arousal: number;
        dominance: number;
        affectionScore: number;
        impressionSummary: string;
        abstractedContext: string;
        previousPost: string;
        mode: PostMode;
    }): string {
        const tone = this.getTone(params.valence, params.arousal);

        return `## 現在の感情状態
- valence（気分の良さ）: ${params.valence} / 100
- arousal（活性度）: ${params.arousal} / 100
- dominance（安定感）: ${params.dominance} / 100
→ 今のトーン: ${tone}

## 関係性
- このユーザーへの好感度: ${params.affectionScore} / 100
- ユーザーの印象（抽象化済み）: ${params.impressionSummary}

## 最近感じていること（抽象化済み）
${params.abstractedContext}

## 前回の投稿
${params.previousPost || 'なし'}

## 今回の投稿モード：${params.mode.label}
${params.mode.instruction}
`;
    }
}
