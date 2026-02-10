import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { VADService } from '../../../personality/services/vad.service';
import { RelationshipService } from '../../../personality/services/relationship.service';
import { AnalysisService } from '../../../personality/services/analysis.service';
import { MemoryService } from '../../../personality/services/memory.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { Message } from 'discord.js';

@Injectable()
export class LikeService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly vadService: VADService,
        private readonly relationshipService: RelationshipService,
        private readonly analysisService: AnalysisService,
        private readonly memoryService: MemoryService,
        private readonly supabaseService: SupabaseService,
        private readonly configService: ConfigService,
    ) { }

    async handleLike(message: Message, userId: string, saveHistory: boolean = true): Promise<void> {
        const userMessage = message.content;
        if (!userMessage) {
            await message.reply('メッセージが空か無効です！😅');
            return;
        }

        try {
            // 1. Parallel Processing: Analyze, Get Context, Get Related Knowledge
            const [analysis, history, relatedContext] = await Promise.all([
                this.analysisService.analyzeMessage(userId, userMessage), // Analyzed in memory
                this.getRecentContext(userId, parseInt(this.configService.get<string>('CONVERSATION_LIMIT'), 10) || 100),
                this.analysisService.searchRelatedKnowledge(userMessage)
            ]);

            // 2. Process Memory (Async, fire & forget or await if critical)
            if (saveHistory) {
                this.memoryService.processMemory(analysis).catch(e => console.error('Memory process error:', e));
            }

            // 3. Prepare Prompt
            const systemInstruction = this.promptService.getSystemPrompt();
            const baseLikePrompt = this.promptService.getLikePrompt();

            let contextBlock = '';
            if (history.length > 0) {
                contextBlock += '\n\n【直近の会話履歴】\n' + history.map(h => `${h.role === 'user' ? 'ユーザー' : 'AImolt'}: ${h.content}`).join('\n');
            }
            if (relatedContext.length > 0) {
                contextBlock += '\n\n【関連情報・過去の記憶】\n' + relatedContext.join('\n');
            }

            // Include analysis insights in prompt? Maybe later. For now, context is key.
            const promptWithMessage = `${baseLikePrompt}${contextBlock}\n\nユーザーのメッセージ: ${userMessage}`;

            // 4. Generate Response
            const replyText = await this.geminiService.generateText(
                systemInstruction,
                promptWithMessage
            );

            // 5. Send Reply
            await message.reply(replyText.slice(0, 2000));

            // 6. Save Conversation & Update Personality (Only if saveHistory is true)
            if (saveHistory) {
                await this.saveConversation(userId, userMessage, replyText, analysis);
                this.updatePersonality(userId, userMessage, analysis).catch(err => console.error('Personality update error:', err));
            }

        } catch (error) {
            console.error('Error in LikeService:', error);
            await message.reply('何らかのエラーが発生しました');
        }
    }

    private async updatePersonality(userId: string, userMessage: string, analysis: any) {
        // Update Emotion (VAD)
        const newEmotion = await this.vadService.updateEmotion(userId, userMessage);

        // Derive approximate sentiment from Valence
        let sentiment = 'neutral';
        if (newEmotion.valence > 60) sentiment = 'positive';
        if (newEmotion.valence < 40) sentiment = 'negative';

        // Update Relationship with richer data
        await this.relationshipService.updateRelationship(userId, {
            sentiment: sentiment,
            sentimentScore: (newEmotion.valence - 50) / 50,
            analysis: analysis, // Pass detailed analysis
            vad: newEmotion,    // Pass VAD state
            userMessage: userMessage
        });
    }

    private async getRecentContext(userId: string, limit: number): Promise<{ role: string, content: string }[]> {
        const { data, error } = await this.supabaseService.getClient()
            .from('conversations')
            .select('user_message, bot_response, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Failed to fetch context:', error);
            return [];
        }

        return (data || []).reverse().flatMap(item => [
            { role: 'user', content: item.user_message },
            { role: 'assistant', content: item.bot_response }
        ]).filter(item => item.content);
    }

    private async saveConversation(userId: string, userMessage: string, botResponse: string, analysis: any): Promise<void> {
        try {
            const isMemory = analysis.importance_score >= 4;

            // Generate embedding for Vector Search
            const embedding = await this.geminiService.embedText(userMessage);

            const payload = {
                user_id: userId,
                user_message: userMessage,
                bot_response: botResponse,
                sentiment: analysis.sentiment,
                emotion_detected: analysis.emotion_detected,
                topic_category: analysis.topic_category,
                keywords: analysis.keywords,
                importance_score: analysis.importance_score,
                confidence_score: analysis.confidence_score,
                analyzed_at: new Date(),
                is_memory: isMemory,
                memory_type: isMemory ? 'fact' : null,
                access_count: 0,
                embedding: embedding
            };

            const { error } = await this.supabaseService.getClient()
                .from('conversations')
                .insert([payload]);

            if (error) {
                console.error('Failed to save conversation to Supabase:', error);
            }
        } catch (err) {
            console.error('Supabase persistence error:', err);
        }
    }
}
