export class Emotion {
    user_id: string;
    valence: number; // 0-100
    arousal: number; // 0-100
    dominance: number; // 0-100

    // Backwards compatibility / Simplified metrics
    energy_level: number;
    interest_level: number;
    intimacy_level: number;

    mood_type: string;
    conversation_count: number;
    last_interaction: Date;

    created_at: Date;
    updated_at: Date;

    constructor(partial: Partial<Emotion>) {
        Object.assign(this, partial);

        // Set defaults if not provided
        this.valence = this.valence ?? 50;
        this.arousal = this.arousal ?? 50;
        this.dominance = this.dominance ?? 50;
        this.energy_level = this.energy_level ?? 50;
        this.interest_level = this.interest_level ?? 50;
        this.intimacy_level = this.intimacy_level ?? 0;
        this.mood_type = this.mood_type ?? 'neutral';
        this.conversation_count = this.conversation_count ?? 0;
        this.last_interaction = this.last_interaction ?? new Date();
    }

    static createDefault(userId: string): Emotion {
        return new Emotion({
            user_id: userId,
        });
    }
}
