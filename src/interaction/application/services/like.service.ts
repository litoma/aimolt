import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { PersonalityService } from '../../../personality/services/personality.service';
import { RelationshipService } from '../../../personality/services/relationship.service';
import { ImpressionService } from '../../../personality/services/impression.service';
import { AnalysisService } from '../../../personality/services/analysis.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { Message } from 'discord.js';

@Injectable()
export class LikeService {
    constructor(
        private readonly geminiService: GeminiService,
        private readonly promptService: PromptService,
        private readonly personalityService: PersonalityService,
        private readonly relationshipService: RelationshipService,
        private readonly impressionService: ImpressionService,
        private readonly analysisService: AnalysisService,
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
            // if (saveHistory) {
            //     this.memoryService.processMemory(analysis).catch(e => console.error('Memory process error:', e));
            // }

            // 3. Prepare Prompt
            const systemInstruction = this.promptService.getSystemPrompt();
            const baseLikePrompt = this.promptService.getLikePrompt();

            // Fetch Relationship Data
            const relationship = await this.relationshipService.getRelationship(userId);
            const relationshipContext = `
【ユーザーとの関係性データ (Automation)】
- Impression: ${relationship.impression_summary || 'なし'}
- Mentor Focus: ${relationship.mentor_focus || 'なし'}
- Affection Score: ${relationship.affection_score}
`;

            let contextBlock = '';
            if (history.length > 0) {
                contextBlock += '\n\n【直近の会話履歴】\n' + history.map(h => `${h.role === 'user' ? 'ユーザー' : 'AImolt'}: ${h.content}`).join('\n');
            }
            if (relatedContext.length > 0) {
                contextBlock += '\n\n【関連情報・過去の記憶】\n' + relatedContext.join('\n');
            }

            // Include analysis insights in prompt? Maybe later. For now, context is key.
            const promptWithMessage = `${baseLikePrompt}${relationshipContext}${contextBlock}\n\nユーザーのメッセージ: ${userMessage}`;

            // 4. Generate Response
            const replyText = await this.geminiService.generateText(
                systemInstruction,
                promptWithMessage
            );

            // 5. Send Reply
            await message.reply(replyText.slice(0, 2000));

            // 6. Save Conversation & Update Personality (Only if saveHistory is true)
            if (saveHistory) {
                // Execute in background to stop typing indicator immediately after reply
                this.saveConversation(userId, userMessage, replyText, analysis)
                    .catch(e => console.error('Save conversation error:', e));
                this.updatePersonality(userId, userMessage, analysis)
                    .catch(err => console.error('Personality update error:', err));
            }

        } catch (error) {
            console.error('Error in LikeService:', error);
            await message.reply('何らかのエラーが発生しました');
        }
    }

    private async updatePersonality(userId: string, userMessage: string, analysis: any) {
        // Update Emotion (VAD) using PersonalityService (LLM-based)
        await this.personalityService.processUserMessage(userId, userMessage);

        // Update Relationship (Impression Analysis)
        await this.impressionService.analyzeAndUpdate(userId, 'chat', `User: ${userMessage}\nAnalysis: ${JSON.stringify(analysis)}`);
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
