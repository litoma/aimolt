import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { VADService } from '../../../personality/application/services/vad.service';
import { RelationshipService } from '../../../personality/application/services/relationship.service';
import { AnalysisService } from '../../../personality/application/services/analysis.service';
import { MemoryService } from '../../../personality/application/services/memory.service';
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

    async handleLike(message: Message, userId: string): Promise<void> {
        const userMessage = message.content;
        if (!userMessage) {
            await message.reply('メッセージが空か無効です！😅');
            return;
        }

        try {
            // 1. Parallel Processing: Save Msg, Analyze, Get Context, Get Memories
            // 1. Parallel Processing: Analyze, Get Context, Get Memories
            const [analysis, history, memories] = await Promise.all([
                this.analysisService.analyzeMessage(userId, userMessage), // Analyzed in memory
                this.getRecentContext(userId, parseInt(this.configService.get<string>('CONVERSATION_LIMIT'), 10) || 100),
                this.memoryService.getRelevantMemories(userId)
            ]);

            // 2. Process Memory (Async, fire & forget or await if critical)
            this.memoryService.processMemory(analysis).catch(e => console.error('Memory process error:', e));

            // 3. Prepare Prompt
            const systemInstruction = this.promptService.getSystemPrompt();
            const baseLikePrompt = this.promptService.getLikePrompt();

            let contextBlock = '';
            if (history.length > 0) {
                contextBlock += '\n\n【直近の会話履歴】\n' + history.map(h => `${h.role === 'user' ? 'ユーザー' : 'AImolt'}: ${h.content}`).join('\n');
            }
            if (memories) {
                contextBlock += '\n\n【ユーザーに関する記憶】\n' + memories;
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

            // 6. Save Conversation (Combined)
            await this.saveConversation(userId, userMessage, replyText, analysis);

            // 7. Update Personality (VAD & Relationship)
            this.updatePersonality(userId, userMessage, analysis).catch(err => console.error('Personality update error:', err));

        } catch (error) {
            console.error('Error in LikeService:', error);
            await message.reply('うわっ、なんかミスっちゃったみたい！🙈');
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
                memory_type: isMemory ? 'fact' : null, // Simple heuristic for now
                access_count: 0
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
