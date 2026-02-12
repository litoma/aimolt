import { Injectable } from '@nestjs/common';
import { GeminiService } from '../../core/gemini/gemini.service';
import { SupabaseService } from '../../core/supabase/supabase.service';
import { TavilyService } from '../../core/search/tavily.service';

import { ConversationAnalysis } from '../entities/conversation-analysis.entity';

@Injectable()
export class AnalysisService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly supabaseService: SupabaseService,
        private readonly tavilyService: TavilyService
    ) { }

    async analyzeMessage(userId: string, message: string): Promise<ConversationAnalysis> {
        return new ConversationAnalysis({
            user_id: userId,
            user_message: message,
        });
    }

    async generateAdvice(transcriptText: string): Promise<string> {
        // 1. Vector Search for related past knowledge
        const relatedKnowledge = await this.searchRelatedKnowledge(transcriptText);
        const knowledgeContext = relatedKnowledge.length > 0
            ? `\n\n【過去の関連情報】\n${relatedKnowledge.join('\n---\n')}`
            : '';

        // 2. Tavily Search for external information
        // Use the first 100 chars as query since keywords extraction is removed
        const searchResults = await this.tavilyService.search(transcriptText.slice(0, 100));
        const webContext = searchResults.length > 0
            ? `\n\n【Web検索結果】\n${searchResults.join('\n---\n')}`
            : '';

        if (!knowledgeContext && !webContext) {
            return '（関連情報が見つかりませんでした。）';
        }

        // 3. Generate Advice using Gemini
        const systemPrompt = `
あなたはユーザーの活動をサポートするAIアシスタントです。
ユーザーの発言（音声文字起こし）に基づいて、過去の記録やWeb検索結果を参照し、有益なアドバイスやフィードバックを提供してください。
アドバイスは簡潔かつ具体的にお願いします。
`;
        const userPrompt = `
ユーザーの発言:
${transcriptText}

${knowledgeContext}

${webContext}

上記を踏まえて、アドバイスを作成してください。
`;

        return this.geminiService.generateText(systemPrompt, userPrompt);
    }


    async searchRelatedKnowledge(query: string): Promise<string[]> {
        const entities = await this.extractEntities(query);
        const searchQueries = [query, ...entities];

        // Multi-query Vector Search
        const results = await Promise.all(
            searchQueries.map(q => this.performVectorSearch(q))
        );

        // Deduplicate & Sort
        const allItems = results.flat();
        const uniqueItems = this.deduplicateResults(allItems)
            .sort((a, b) => b.similarity - a.similarity);

        return uniqueItems.map(item => item.content);
    }

    private async extractEntities(query: string): Promise<string[]> {
        try {
            const systemPrompt = 'ユーザーのメッセージから、検索に有効な「関連エンティティ」「専門用語」「類義語」を最大3つ抽出してください。結果はJSON形式の文字列配列で返してください。例: ["React", "UIライブラリ", "Facebook"]';
            const userPrompt = `メッセージ: ${query}`;
            const result = await this.geminiService.generateText(systemPrompt, userPrompt);
            const cleanResult = result.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanResult);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Entity extraction failed:', e);
            return [];
        }
    }

    private async performVectorSearch(query: string): Promise<any[]> {
        try {
            const embedding = await this.geminiService.embedText(query);

            // Parallel DB queries
            const [convRes, trRes] = await Promise.all([
                this.supabaseService.getClient().rpc('match_conversations', {
                    query_embedding: embedding, match_threshold: 0.5, match_count: 5
                }),
                this.supabaseService.getClient().rpc('match_transcripts', {
                    query_embedding: embedding, match_threshold: 0.5, match_count: 3
                })
            ]);

            const results = [];

            if (convRes.data) {
                results.push(...convRes.data.map((c: any) => ({
                    id: `conv_${c.id}`,
                    content: `User: ${c.user_message}\nAI: ${c.bot_response}`,
                    similarity: c.similarity
                })));
            }

            if (trRes.data) {
                results.push(...trRes.data.map((t: any) => ({
                    id: `tr_${t.id}`,
                    content: `Transcript: ${t.text}`, // Note: text might be long
                    similarity: t.similarity
                })));
            }

            return results;
        } catch (e) {
            console.error('Vector search failed:', e);
            return [];
        }
    }

    private deduplicateResults(items: any[]): any[] {
        const seen = new Set();
        return items.filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
    }
}
