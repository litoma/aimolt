import { Injectable } from '@nestjs/common';
import { UserMemory } from '../entities/user-memory.entity';
import { SupabaseService } from '../../core/supabase/supabase.service';

@Injectable()
export class SupabaseUserMemoryRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async create(memory: UserMemory): Promise<UserMemory> {
        const payload = {
            user_id: memory.user_id,
            user_message: memory.content,
            is_memory: true,
            memory_type: 'fact',
            importance_score: memory.importance_score,
            keywords: memory.keywords,
            access_count: memory.access_count || 0,
            bot_response: null, // Memories are user-centric
            created_at: memory.created_at || new Date()
        };

        const { data, error } = await this.client
            .from('conversations')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating memory (in conversations):', error);
            throw error;
        }

        return this.mapToEntity(data);
    }

    async findByUserId(userId: string, limit: number): Promise<UserMemory[]> {
        const { data, error } = await this.client
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .eq('is_memory', true)
            .order('importance_score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching memories from conversations:', error);
            throw error;
        }

        return (data || []).map(item => this.mapToEntity(item));
    }

    private mapToEntity(data: any): UserMemory {
        return new UserMemory({
            id: data.id,
            user_id: data.user_id,
            content: data.user_message, // Map back to content
            importance_score: data.importance_score,
            keywords: data.keywords,
            access_count: data.access_count,
            created_at: new Date(data.created_at),
            emotional_weight: 0 // Default, or derive from sentiment
        });
    }
}
