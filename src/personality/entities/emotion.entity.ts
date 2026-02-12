export class Emotion {
    user_id: string;
    valence: number; // 0-100
    arousal: number; // 0-100
    dominance: number; // 0-100


    updated_at: Date;

    constructor(partial: Partial<Emotion>) {
        Object.assign(this, partial);

        // Set defaults if not provided
        this.valence = this.valence ?? 50;
        this.arousal = this.arousal ?? 50;
        this.dominance = this.dominance ?? 50;
    }

    static createDefault(userId: string): Emotion {
        return new Emotion({
            user_id: userId,
        });
    }
}
