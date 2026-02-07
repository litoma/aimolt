import { supabase } from "../../supabase.ts";
import { Relationship, DefaultRelationship } from "../../types/personality.ts";

export class RelationshipService {
    async getRelationship(userId: string): Promise<Relationship> {
        const relationship = await this.findByUserId(userId);
        if (!relationship) {
            return this.createInitialRelationship(userId);
        }
        return relationship;
    }

    async createInitialRelationship(userId: string): Promise<Relationship> {
        const defaultRelationship = DefaultRelationship(userId);
        return await this.save(defaultRelationship);
    }

    async updateRelationship(userId: string, interactionData: { sentiment?: string; sentimentScore?: number }): Promise<Relationship> {
        const relationship = await this.getRelationship(userId);

        const impact = this.calculateImpact(interactionData);

        relationship.affection_level = this.clamp(relationship.affection_level + impact.affection, 0, 100);
        relationship.trust_level = this.clamp(relationship.trust_level + impact.trust, 0, 100);
        relationship.comfort_level = this.clamp(relationship.comfort_level + impact.comfort, 0, 100);

        // Mapped property: conversation_count in DB (entity used total_conversations)
        // We use conversation_count in our type interface to match DB
        relationship.conversation_count += 1;

        if (impact.isMeaningful) {
            relationship.meaningful_interactions += 1;
        }
        relationship.last_interaction = new Date();
        relationship.relationship_stage = this.determineStage(relationship);

        return await this.update(relationship);
    }

    // --- Repository Logic ---

    private async findByUserId(userId: string): Promise<Relationship | null> {
        const { data, error } = await supabase
            .from("user_relationships")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) return null;
        return data as Relationship;
    }

    private async save(relationship: Relationship): Promise<Relationship> {
        const { data, error } = await supabase
            .from("user_relationships")
            .insert([relationship])
            .select()
            .single();

        if (error) throw error;
        return data as Relationship;
    }

    private async update(relationship: Relationship): Promise<Relationship> {
        const { data, error } = await supabase
            .from("user_relationships")
            .update(relationship)
            .eq("user_id", relationship.user_id)
            .select()
            .single();

        if (error) throw error;
        return data as Relationship;
    }

    // --- Logic ---

    private calculateImpact(data: { sentiment?: string; sentimentScore?: number }) {
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

export const relationshipService = new RelationshipService();
