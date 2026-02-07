import { Injectable } from '@nestjs/common';
import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class SupabaseRelationshipRepository implements IRelationshipRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async findByUserId(userId: string): Promise<Relationship | null> {
        const { data, error } = await this.client
            .from('user_relationships')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching relationship:', error);
            throw error;
        }

        if (!data) return null;

        // Map DB columns to Entity properties
        const entity = new Relationship(data);
        if (data.conversation_count !== undefined) {
            entity.total_conversations = data.conversation_count;
        }
        return entity;
    }

    async create(relationship: Relationship): Promise<Relationship> {
        const payload = this.toDbPayload(relationship);

        const { data, error } = await this.client
            .from('user_relationships')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Error creating relationship:', error);
            throw error;
        }

        return this.toEntity(data);
    }

    async update(relationship: Relationship): Promise<Relationship> {
        const payload = this.toDbPayload(relationship);
        const { user_id, ...updates } = payload;

        const { data, error } = await this.client
            .from('user_relationships')
            .update(updates)
            .eq('user_id', user_id)
            .select()
            .single();

        if (error) {
            console.error('Error updating relationship:', error);
            throw error;
        }

        return this.toEntity(data);
    }

    private toDbPayload(relationship: Relationship): any {
        const { total_conversations, ...rest } = relationship;
        return {
            ...rest,
            conversation_count: total_conversations, // Map property to column
        };
    }

    private toEntity(data: any): Relationship {
        const entity = new Relationship(data);
        if (data.conversation_count !== undefined) {
            entity.total_conversations = data.conversation_count;
        }
        return entity;
    }
}
