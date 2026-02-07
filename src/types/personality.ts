export interface Emotion {
    user_id: string;
    valence: number;
    arousal: number;
    dominance: number;

    energy_level: number;
    interest_level: number;
    intimacy_level: number;

    mood_type: string;
    conversation_count: number;
    last_interaction: Date;

    created_at?: Date;
    updated_at?: Date;
}

export interface Relationship {
    user_id: string;
    affection_level: number;
    trust_level: number;
    comfort_level: number;

    last_interaction: Date;
    relationship_stage: 'stranger' | 'acquaintance' | 'friend' | 'close_friend';
    known_interests: string[];
    preferred_formality: 'formal' | 'casual' | 'intimate';

    conversation_count: number; // Mapped from total_conversations in schema
    meaningful_interactions: number;

    created_at?: Date;
    updated_at?: Date;
}

export const DefaultEmotion = (userId: string): Emotion => ({
    user_id: userId,
    valence: 50,
    arousal: 50,
    dominance: 50,
    energy_level: 50,
    interest_level: 50,
    intimacy_level: 0,
    mood_type: 'neutral',
    conversation_count: 0,
    last_interaction: new Date(),
});

export const DefaultRelationship = (userId: string): Relationship => ({
    user_id: userId,
    affection_level: 30,
    trust_level: 20,
    comfort_level: 20,
    last_interaction: new Date(),
    relationship_stage: 'stranger',
    known_interests: [],
    preferred_formality: 'formal',
    conversation_count: 0,
    meaningful_interactions: 0,
});
