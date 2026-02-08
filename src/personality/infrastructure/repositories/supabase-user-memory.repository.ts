import { Injectable } from '@nestjs/common';
import { IUserMemoryRepository } from '../../domain/repositories/user-memory.repository.interface';
import { UserMemory } from '../../domain/entities/user-memory.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class SupabaseUserMemoryRepository implements IUserMemoryRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async create(memory: UserMemory): Promise<UserMemory> {
        const { id, created_at, last_accessed, access_count, ...payload } = memory;

        const { data, error } = await this.client
            .from('user_memories')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating memory:', error);
            throw error;
        }

        return new UserMemory(data);
    }

    async findByUserId(userId: string, limit: number): Promise<UserMemory[]> {
        const { data, error } = await this.client
            .from('user_memories')
            .select('*')
            .eq('user_id', userId)
            .order('importance_score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching memories:', error);
            throw error;
        }

        return (data || []).map(item => new UserMemory(item));
    }
}
