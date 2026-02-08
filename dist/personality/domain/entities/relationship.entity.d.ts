export declare class Relationship {
    user_id: string;
    affection_level: number;
    trust_level: number;
    comfort_level: number;
    last_interaction: Date;
    relationship_stage: 'stranger' | 'acquaintance' | 'friend' | 'close_friend';
    known_interests: string[];
    preferred_formality: 'formal' | 'casual' | 'intimate';
    total_conversations: number;
    meaningful_interactions: number;
    created_at: Date;
    updated_at: Date;
    constructor(partial: Partial<Relationship>);
    static createDefault(userId: string): Relationship;
}
