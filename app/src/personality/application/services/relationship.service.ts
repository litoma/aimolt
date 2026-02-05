import { Injectable, Inject } from '@nestjs/common';
import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';

@Injectable()
export class RelationshipService {
    constructor(
        @Inject(IRelationshipRepository)
        private readonly relationshipRepository: IRelationshipRepository,
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

    async updateRelationship(userId: string, interactionData: any): Promise<Relationship> {
        const relationship = await this.getRelationship(userId);

        // Logic from relationship-manager.js
        // 1. Calculate impact
        const impact = this.calculateImpact(interactionData);

        // 2. Update levels
        relationship.affection_level = this.clamp(relationship.affection_level + impact.affection, 0, 100);
        relationship.trust_level = this.clamp(relationship.trust_level + impact.trust, 0, 100);
        relationship.comfort_level = this.clamp(relationship.comfort_level + impact.comfort, 0, 100);

        // 3. Update stats
        relationship.total_conversations += 1;
        if (impact.isMeaningful) {
            relationship.meaningful_interactions += 1;
        }
        relationship.last_interaction = new Date();

        // 4. Update Stage
        relationship.relationship_stage = this.determineStage(relationship);

        return await this.relationshipRepository.update(relationship);
    }

    private calculateImpact(data: any) {
        // Simplified logic for porting. Real logic depends on analysis result.
        const sentiment = data.sentiment || 'neutral';
        const sentimentScore = data.sentimentScore || 0;

        let impact = { affection: 0, trust: 0, comfort: 1, isMeaningful: false };

        if (sentiment === 'positive') {
            impact.affection = 2;
            impact.trust = 1;
        } else if (sentiment === 'negative') {
            impact.affection = -1;
        }

        if (Math.abs(sentimentScore) > 0.5) impact.isMeaningful = true;

        return impact;
    }

    private determineStage(r: Relationship): 'stranger' | 'acquaintance' | 'friend' | 'close_friend' {
        const score = (r.affection_level + r.trust_level + r.comfort_level) / 3;
        if (score >= 80 && r.meaningful_interactions >= 20) return 'close_friend';
        if (score >= 50 && r.meaningful_interactions >= 5) return 'friend';
        if (score >= 20) return 'acquaintance';
        return 'stranger';
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }
}
