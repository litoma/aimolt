
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../core/supabase/supabase.service';
import { GeminiService } from '../core/gemini/gemini.service';
import { BlueskyService } from './bluesky.service';
import { BlueskyPromptService, PostMode } from './bluesky-prompt.service';

// Hardcoded for now as per plan, though ideally should be config
@Injectable()
export class BlueskyPostingService {
    private readonly logger = new Logger(BlueskyPostingService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly gemini: GeminiService,
        private readonly bluesky: BlueskyService,
        private readonly promptService: BlueskyPromptService,
        private readonly configService: ConfigService,
    ) { }

    async execute(): Promise<void> {
        // 環境変数チェック（念のためここでも）
        const identifier = this.configService.get<string>('BLUESKY_IDENTIFIER');
        const password = this.configService.get<string>('BLUESKY_APP_PASSWORD');
        if (!identifier || !password) {
            this.logger.warn('Bluesky credentials missing. Aborting posting execution.');
            return;
        }

        const blueskyGenerationConfig = {
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
            maxOutputTokens: 200,
        };

        this.logger.log('Bluesky posting started');

        try {
            // ① ユーザーIDを動的に取得（1ユーザー前提）
            const { data: userData, error: userError } = await this.supabase.getClient()
                .from('relationships')
                .select('user_id')
                .limit(1)
                .single();

            if (userError || !userData) {
                this.logger.warn('No user found in relationships table to generate post for.');
                return;
            }

            const userId = userData.user_id;

            // ② DBからデータ収集
            const [emotions, relationship, lastPost] =
                await Promise.all([
                    this.fetchEmotions(userId),
                    this.fetchRelationship(userId),
                    this.fetchLastPost(),
                ]);

            // ③ 投稿モード選択（ハイブリッド検索クエリに使うため先に行う）
            const mode = this.promptService.selectMode(lastPost?.mode_id);

            // ハイブリッドコンテキスト取得（直近 + ベクトル検索）
            const { conversations, transcripts } = await this.fetchHybridContext(
                userId,
                mode,
                lastPost?.content ?? '',
            );

            // ② Step1: プライバシー抽象化
            const rawConversations = conversations
                .map(c => `User: ${c.user_message}\nMol: ${c.bot_response}`)
                .join('\n---\n');
            const rawTranscripts = transcripts.map(t => t.text).join('\n---\n');

            const abstractionSystemPrompt = this.promptService.getAbstractionSystemPrompt();
            const abstractionUserPrompt = this.promptService.buildAbstractionUserPrompt(
                rawConversations,
                rawTranscripts
            );

            const abstractionResult = await this.gemini.generateText(abstractionSystemPrompt, abstractionUserPrompt, undefined, blueskyGenerationConfig);
            const abstractedContext = this.parseAbstractionResult(abstractionResult);

            // （投稿モード選択はハイブリッドコンテキスト取得の前に移動済み）

            // ④ Step2: 投稿文生成
            const postingSystemPrompt = this.promptService.getPostingSystemPrompt();
            const postingUserPrompt = this.promptService.buildPostingUserPrompt({
                valence: emotions.valence,
                arousal: emotions.arousal,
                dominance: emotions.dominance,
                affectionScore: relationship.affection_score,
                impressionSummary: this.abstractImpression(relationship.impression_summary),
                abstractedContext,
                previousPost: lastPost?.content ?? '',
                mode,
            });

            const postContent = await this.gemini.generateText(postingSystemPrompt, postingUserPrompt, undefined, blueskyGenerationConfig);

            // ⑤ 300文字チェック（超過した場合は再生成1回まで）
            const finalContent = postContent.length <= 300
                ? postContent
                : await this.retryGeneration(postingSystemPrompt, postingUserPrompt, blueskyGenerationConfig);

            // ⑥ Blueskyに投稿
            await this.bluesky.post(finalContent);

            // ⑦ postsテーブルに記録
            const nextScheduledAt = this.calcNextSchedule(); // 1〜23時間後
            const { error: insertError } = await this.supabase.getClient().from('posts').insert({
                content: finalContent,
                next_scheduled_at: nextScheduledAt.toISOString(),
                mode_id: mode.id,
            });

            if (insertError) {
                this.logger.error(`Failed to save post to DB: ${insertError.message}`);
            } else {
                this.logger.log(`Post saved. Next at: ${nextScheduledAt.toISOString()}`);
            }
        } catch (error) {
            this.logger.error('Error in Bluesky posting execution', error);
        }
    }

    // --- Private helpers ---

    // --- Private helpers ---

    private async fetchEmotions(userId: string) {
        const { data } = await this.supabase.getClient()
            .from('emotions')
            .select('valence, arousal, dominance')
            .eq('user_id', userId)
            .single();
        return data ?? { valence: 50, arousal: 50, dominance: 50 };
    }

    private async fetchRelationship(userId: string) {
        const { data } = await this.supabase.getClient()
            .from('relationships')
            .select('impression_summary, affection_score')
            .eq('user_id', userId)
            .single();
        return data ?? { impression_summary: '', affection_score: 0 };
    }

    private async fetchRecentConversations(userId: string, limit: number) {
        const { data } = await this.supabase.getClient()
            .from('conversations')
            .select('id, user_message, bot_response')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return data ?? [];
    }

    private async fetchRecentTranscripts(userId: string, limit: number) {
        const { data } = await this.supabase.getClient()
            .from('transcripts')
            .select('id, text')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        return data ?? [];
    }

    /**
     * ベクトル検索用クエリ文字列を組み立てる
     * 「モードの意図 + 前回投稿」を埋め込みのクエリにする
     */
    private buildSearchQuery(mode: PostMode, previousPost: string): string {
        return [mode.instruction, previousPost]
            .filter(Boolean)
            .join('\n')
            .slice(0, 500);
    }

    /**
     * 直近データ + ベクトル検索のハイブリッドでコンテキストを収集
     * ベクトル検索が失敗した場合は直近データのみにフォールバック
     */
    private async fetchHybridContext(
        userId: string,
        mode: PostMode,
        previousPost: string,
    ): Promise<{
        conversations: { id: string; user_message: string; bot_response: string }[];
        transcripts: { id: string; text: string }[];
    }> {
        // --- 直近データ（固定） ---
        const [recentConv, recentTrans] = await Promise.all([
            this.fetchRecentConversations(userId, 2),
            this.fetchRecentTranscripts(userId, 2),
        ]);

        try {
            const recentConvIds = new Set(recentConv.map(c => c.id));
            const recentTransIds = new Set(recentTrans.map(t => t.id));

            // --- ベクトル検索 ---
            const queryText = this.buildSearchQuery(mode, previousPost);
            const queryEmbedding = await this.gemini.embedText(queryText);
            const embeddingLiteral = `[${queryEmbedding.join(',')}]`;

            const [vectorConv, vectorTrans] = await Promise.all([
                this.supabase.getClient().rpc('match_conversations', {
                    query_embedding: embeddingLiteral,
                    match_threshold: 0.6,
                    match_count: 4,
                }),
                this.supabase.getClient().rpc('match_transcripts', {
                    query_embedding: embeddingLiteral,
                    match_threshold: 0.6,
                    match_count: 5,
                }),
            ]);

            // 直近と重複するものを除外
            const extraConv = (vectorConv.data ?? [])
                .filter(c => !recentConvIds.has(c.id))
                .slice(0, 2);

            const extraTrans = (vectorTrans.data ?? [])
                .filter(t => !recentTransIds.has(t.id))
                .slice(0, 3);

            return {
                conversations: [...recentConv, ...extraConv],
                transcripts: [...recentTrans, ...extraTrans],
            };
        } catch (error) {
            this.logger.warn('Vector search failed, falling back to recent data only.', error);
            return { conversations: recentConv, transcripts: recentTrans };
        }
    }

    private async fetchLastPost() {
        const { data } = await this.supabase.getClient()
            .from('posts')
            .select('content, next_scheduled_at, mode_id')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        return data;
    }

    /** 抽象化結果をJSONパースして箇条書き文字列に変換 */
    private parseAbstractionResult(raw: string): string {
        try {
            // Remove code blocks if present
            const cleanRaw = raw.replace(/```json|```/g, '').trim();
            const json = JSON.parse(cleanRaw);
            return (json as { theme: string; summary: string }[])
                .map(item => `- ${item.theme}: ${item.summary}`)
                .join('\n');
        } catch {
            return raw.slice(0, 500); // パース失敗時はそのまま使う
        }
    }

    /** impression_summaryから固有名詞を除いた要約を返す（簡易版） */
    private abstractImpression(summary: string): string {
        // 必要に応じてGeminiで再抽象化してもよい
        return summary
            .replace(/[A-Za-z]+さん/g, 'あるユーザー')
            .slice(0, 100);
    }

    /** 300文字超の場合1回だけ再生成 */
    private async retryGeneration(systemPrompt: string, userPrompt: string, generationConfig?: object): Promise<string> {
        const retryUserPrompt = userPrompt + '\n\n【重要】前回の出力が長すぎました。必ず300文字以内で出力してください。';
        const result = await this.gemini.generateText(systemPrompt, retryUserPrompt, undefined, generationConfig);
        return result.slice(0, 300); // それでも超過したら強制カット
    }

    /** 次の投稿時刻：1〜23時間後のランダム */
    private calcNextSchedule(): Date {
        const hours = Math.floor(Math.random() * 23) + 1; // 1〜23
        const next = new Date();
        next.setHours(next.getHours() + hours);
        return next;
    }
}
