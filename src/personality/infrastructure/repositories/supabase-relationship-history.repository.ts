import { Injectable } from '@nestjs/common';
import { IRelationshipHistoryRepository } from '../../domain/repositories/relationship-history.repository.interface';
import { RelationshipHistory } from '../../domain/entities/relationship-history.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';

@Injectable()
export class SupabaseRelationshipHistoryRepository implements IRelationshipHistoryRepository {
    constructor(private readonly supabaseService: SupabaseService) { }

    private get client() {
        return this.supabaseService.getClient();
    }

    async create(history: RelationshipHistory): Promise<void> {
        const { id, created_at, ...payload } = history;

        const { error } = await this.client
            .from('relationship_history')
            .insert([payload]);

        if (error) {
            console.error('Error creating relationship history:', error);
            throw error;
        }
    }
}
