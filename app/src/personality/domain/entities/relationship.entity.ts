export class Relationship {
    user_id: string;
    affection_level: number; // 0-100
    trust_level: number; // 0-100
    comfort_level: number; // 0-100
    interaction_streak: number;
    last_interaction: Date;
    relationship_stage: 'stranger' | 'acquaintance' | 'friend' | 'close_friend';
    known_interests: string[];
    preferred_formality: 'formal' | 'casual' | 'intimate';
    total_conversations: number;
    meaningful_interactions: number;

    created_at: Date;
    updated_at: Date;

    constructor(partial: Partial<Relationship>) {
        Object.assign(this, partial);

        // Set defaults
        this.affection_level = this.affection_level ?? 30;
        this.trust_level = this.trust_level ?? 20;
        this.comfort_level = this.comfort_level ?? 20;
        this.interaction_streak = this.interaction_streak ?? 0;
        this.last_interaction = this.last_interaction ?? new Date();
        this.relationship_stage = this.relationship_stage ?? 'stranger';
        this.known_interests = this.known_interests ?? [];
        this.preferred_formality = this.preferred_formality ?? 'formal';
        this.total_conversations = this.total_conversations ?? 0;
        this.meaningful_interactions = this.meaningful_interactions ?? 0;
    }

    static createDefault(userId: string): Relationship {
        return new Relationship({
            user_id: userId,
        });
    }
}
