import { Injectable } from '@nestjs/common';
import { IEmotionRepository } from '../../domain/repositories/emotion.repository.interface';
import { Emotion } from '../../domain/entities/emotion.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class SupabaseEmotionRepository implements IEmotionRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async findByUserId(userId: string): Promise<Emotion | null> {
        const { data, error } = await this.client
            .from('emotion_states')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching emotion:', error);
            throw error;
        }

        return data ? new Emotion(data) : null;
    }

    async create(emotion: Emotion): Promise<Emotion> {
        const { data, error } = await this.client
            .from('emotion_states')
            .insert([emotion])
            .select()
            .single();

        if (error) {
            console.error('Error creating emotion:', error);
            throw error;
        }

        return new Emotion(data);
    }

    async update(emotion: Emotion): Promise<Emotion> {
        // Exclude updated_at from being manually set if handled by DB triggers, but okay to pass
        // We should strictly update fields.
        const { user_id, ...updates } = emotion;

        const { data, error } = await this.client
            .from('emotion_states')
            .update(updates)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) {
            console.error('Error updating emotion:', error);
            throw error;
        }

        return new Emotion(data);
    }
}
