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
            sentiment: this.analyzeSentiment(message),
            emotion_detected: this.detectEmotion(message),
            topic_category: this.categorizeMessage(message),
            keywords: this.extractKeywords(message),
            importance_score: this.calculateImportanceScore(message),
            confidence_score: 0.75 // Default confidence
        });
    }

    async generateAdvice(transcriptText: string): Promise<string> {
        // 1. Vector Search for related past knowledge
        const relatedKnowledge = await this.searchRelatedKnowledge(transcriptText);
        const knowledgeContext = relatedKnowledge.length > 0
            ? `\n\n【過去の関連情報】\n${relatedKnowledge.join('\n---\n')}`
            : '';

        // 2. Tavily Search for external information
        // Use a summarized query or keywords for Tavily if transcript is too long, 
        // but for now let's try extracting entities/keywords first.
        const keywords = this.extractKeywords(transcriptText).join(' ');
        const searchResults = await this.tavilyService.search(keywords || transcriptText.slice(0, 100)); // Fallback to start of text
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

    private analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
        const positivePatterns = /楽しい|嬉しい|最高|ありがとう|好き|面白い|すごい/gi;
        const negativePatterns = /悲しい|辛い|最悪|嫌い|つまらない|疲れた|怒っている/gi;

        const positiveMatches = (message.match(positivePatterns) || []).length;
        const negativeMatches = (message.match(negativePatterns) || []).length;

        if (positiveMatches > negativeMatches) return 'positive';
        if (negativeMatches > positiveMatches) return 'negative';
        return 'neutral';
    }

    private detectEmotion(message: string): string {
        const patterns = {
            joy: /嬉しい|楽しい|やった|最高|ハッピー/gi,
            sadness: /悲しい|落ち込む|憂鬱|泣きたい/gi,
            anger: /怒り|むかつく|イライラ/gi,
            fear: /怖い|不安|心配/gi,
            surprise: /びっくり|えっ|まじ|驚き/gi,
            gratitude: /ありがとう|感謝|助かる/gi,
            love: /好き|愛|ラブ/gi,
        };

        for (const [emotion, pattern] of Object.entries(patterns)) {
            if (pattern.test(message)) return emotion;
        }
        return 'neutral';
    }

    private categorizeMessage(message: string): string {
        const categories = {
            coding: /コード|プログラミング|バグ|エラー|実装/gi,
            game: /ゲーム|プレイ|攻略/gi,
            daily: /今日|明日|天気|ご飯|寝る/gi,
            work: /仕事|タスク|会議|残業/gi,
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(message)) return category;
        }
        return 'general';
    }

    private extractKeywords(message: string): string[] {
        // Simple extraction logic: remove common particles and keep meaningful words
        // In production, consider using a proper tokenizer like kuromoji.js
        const stopWords = /^[はがをにへとのでも]|です|ます|した|する/gi;
        return message.split(/\s+/).filter(w => w.length > 2 && !stopWords.test(w)).slice(0, 5);
    }

    private calculateImportanceScore(message: string): number {
        let score = 1;
        if (message.length > 50) score += 2;
        if (message.includes('?')) score += 1;
        if (/重要|緊急|教えて|相談/.test(message)) score += 3;
        return Math.min(score, 10);
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
