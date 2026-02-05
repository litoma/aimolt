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

        return data ? new Relationship(data) : null;
    }

    async create(relationship: Relationship): Promise<Relationship> {
        const { data, error } = await this.client
            .from('user_relationships')
            .insert([relationship])
            .select()
            .single();

        if (error) {
            console.error('Error creating relationship:', error);
            throw error;
        }

        return new Relationship(data);
    }

    async update(relationship: Relationship): Promise<Relationship> {
        const { user_id, ...updates } = relationship;

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

        return new Relationship(data);
    }
}
