import { Injectable } from '@nestjs/common';
import { SupabaseRelationshipRepository } from '../repositories/supabase-relationship.repository';
import { Relationship } from '../entities/relationship.entity';

export interface InteractionImpact {
    affection: number;
    trust: number;
    comfort: number;
    isMeaningful: boolean;
}

@Injectable()
export class RelationshipService {
    constructor(
        private readonly relationshipRepository: SupabaseRelationshipRepository,
    ) { }

    async getRelationship(userId: string): Promise<Relationship> {
        let relationship = await this.relationshipRepository.findByUserId(userId);
        if (!relationship) {
            relationship = await this.createInitialRelationship(userId);
        }
        return relationship;
    }

    async createInitialRelationship(userId: string): Promise<Relationship> {
        const defaultRelationship = Relationship.createDefault(userId);
        return await this.relationshipRepository.create(defaultRelationship);
    }

    async updateRelationship(userId: string, updates: Partial<Relationship>): Promise<Relationship> {
        const relationship = await this.getRelationship(userId);
        Object.assign(relationship, updates);
        relationship.updated_at = new Date();
        return await this.relationshipRepository.update(relationship);
    }


    async updateAffectionScore(userId: string, delta: number): Promise<Relationship> {
        const relationship = await this.getRelationship(userId);
        relationship.affection_score = this.clamp(relationship.affection_score + delta, -100, 100);
        relationship.updated_at = new Date();
        return await this.relationshipRepository.update(relationship);
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }
}
