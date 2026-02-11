export class Relationship {
    user_id: string;
    impression_summary: string;
    mentor_focus: string;
    understanding_score: number;
    affection_score: number;
    // stage: 'Observer' | 'Junior Mentor' | 'Trusted Partner' | 'Life Coach'; // TBD if needed in DB or computed

    created_at: Date;
    updated_at: Date;

    constructor(partial: Partial<Relationship>) {
        Object.assign(this, partial);

        // Set defaults
        this.understanding_score = this.understanding_score ?? 0;
        this.affection_score = this.affection_score ?? 0;
        this.impression_summary = this.impression_summary ?? '';
        this.mentor_focus = this.mentor_focus ?? '';
    }

    static createDefault(userId: string): Relationship {
        return new Relationship({
            user_id: userId,
        });
    }
}
