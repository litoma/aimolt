import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';
export declare class SupabaseRelationshipRepository implements IRelationshipRepository {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    private get client();
    findByUserId(userId: string): Promise<Relationship | null>;
    create(relationship: Relationship): Promise<Relationship>;
    update(relationship: Relationship): Promise<Relationship>;
    private toDbPayload;
    private toEntity;
}
