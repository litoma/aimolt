import { Injectable } from '@nestjs/common';
import { IConversationAnalysisRepository } from '../../domain/repositories/conversation-analysis.repository.interface';
import { ConversationAnalysis } from '../../domain/entities/conversation-analysis.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class SupabaseConversationAnalysisRepository implements IConversationAnalysisRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async create(analysis: ConversationAnalysis): Promise<ConversationAnalysis> {
        const { id, analyzed_at, ...payload } = analysis;

        const { data, error } = await this.client
            .from('conversation_analysis')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating analysis:', error);
            throw error;
        }

        return new ConversationAnalysis(data);
    }

    async findRecentByUserId(userId: string, limit: number): Promise<ConversationAnalysis[]> {
        const { data, error } = await this.client
            .from('conversation_analysis')
            .select('*')
            .eq('user_id', userId)
            .order('analyzed_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent analysis:', error);
            throw error;
        }

        return (data || []).map(item => new ConversationAnalysis(item));
    }
}
