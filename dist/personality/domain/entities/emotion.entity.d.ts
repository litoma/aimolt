export declare class Emotion {
    user_id: string;
    valence: number;
    arousal: number;
    dominance: number;
    energy_level: number;
    interest_level: number;
    intimacy_level: number;
    mood_type: string;
    last_interaction: Date;
    created_at: Date;
    updated_at: Date;
    constructor(partial: Partial<Emotion>);
    static createDefault(userId: string): Emotion;
}
