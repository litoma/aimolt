import { Injectable, Inject } from '@nestjs/common';
import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { IRelationshipHistoryRepository } from '../../domain/repositories/relationship-history.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';
import { RelationshipHistory } from '../../domain/entities/relationship-history.entity';

export interface InteractionImpact {
    affection: number;
    trust: number;
    comfort: number;
    isMeaningful: boolean;
}

@Injectable()
export class RelationshipService {
    constructor(
        @Inject(IRelationshipRepository)
        private readonly relationshipRepository: IRelationshipRepository,
        @Inject(IRelationshipHistoryRepository)
        private readonly historyRepository: IRelationshipHistoryRepository,
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
        const previousStage = relationship.relationship_stage;

        // 1. Calculate impact
        const impact = this.calculateImpact(interactionData, relationship);

        // 2. Update levels
        const oldValues = { ...relationship };
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

        // 5. Save changes
        const updated = await this.relationshipRepository.update(relationship);

        // 6. Log History
        await this.logChanges(userId, oldValues, relationship, interactionData.userMessage || 'Interaction');

        return updated;
    }

    private calculateImpact(data: any, current: Relationship): InteractionImpact {
        const sentiment = data.sentiment || 'neutral';
        const sentimentScore = data.sentimentScore || 0;
        const analysis = data.analysis; // Passed from LikeService
        const vad = data.vad; // Passed from LikeService

        let impact = { affection: 0, trust: 0, comfort: 1, isMeaningful: false };

        // Logic restored from legacy relationship-manager.js

        // Affection
        if (sentiment === 'positive') impact.affection += 1;
        if (sentiment === 'negative') impact.affection -= 1;
        if (analysis?.emotion_detected === 'gratitude') impact.affection += 2;
        if (analysis?.emotion_detected === 'love') impact.affection += 3;

        // Trust
        if (analysis?.user_message?.match(/秘密|相談|悩み/)) impact.trust += 2;
        if (data.isLongTermUser) impact.trust += 0.5; // Hypothetical parameter

        // Comfort
        if (current.total_conversations > 10) impact.comfort += 0.5;
        if (analysis?.emotion_detected === 'joy') impact.comfort += 1;

        // VAD Influence
        if (vad) {
            if (vad.valence > 60) impact.affection += 1;
            if (vad.arousal > 60) impact.isMeaningful = true; // High energy interaction
        }

        // Meaningful check
        if (Math.abs(sentimentScore) > 0.6 || analysis?.importance_score >= 7) {
            impact.isMeaningful = true;
        }

        return impact;
    }

    private determineStage(r: Relationship): 'stranger' | 'acquaintance' | 'friend' | 'close_friend' {
        const score = (r.affection_level + r.trust_level + r.comfort_level) / 3;

        if (score >= 80 && r.meaningful_interactions >= 20) return 'close_friend';
        if (score >= 50 && r.meaningful_interactions >= 10) return 'friend';
        if (score >= 20 || r.total_conversations >= 5) return 'acquaintance';
        return 'stranger';
    }

    private async logChanges(userId: string, oldRel: Relationship, newRel: Relationship, message: string) {
        const changes: Partial<RelationshipHistory> = {};

        if (oldRel.affection_level !== newRel.affection_level) {
            await this.historyRepository.create(new RelationshipHistory({
                user_id: userId,
                event_type: 'affection_change',
                new_value: newRel.affection_level.toString(),
                trigger_message: message
            }));
        }
        if (oldRel.trust_level !== newRel.trust_level) {
            await this.historyRepository.create(new RelationshipHistory({
                user_id: userId,
                event_type: 'trust_change',
                new_value: newRel.trust_level.toString(),
                trigger_message: message
            }));
        }
        if (oldRel.relationship_stage !== newRel.relationship_stage) {
            await this.historyRepository.create(new RelationshipHistory({
                user_id: userId,
                event_type: 'stage_change',
                new_value: newRel.relationship_stage,
                trigger_message: message
            }));
        }
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }
}
