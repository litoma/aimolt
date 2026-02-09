export class UserMemory {
    id?: string;
    user_id: string;
    content: string;
    source_message_id?: string;
    importance_score: number;
    emotional_weight: number;
    keywords: string[];
    access_count?: number;
    last_accessed?: Date;
    created_at?: Date;
    expires_at?: Date;

    constructor(partial: Partial<UserMemory>) {
        Object.assign(this, partial);
    }
}
