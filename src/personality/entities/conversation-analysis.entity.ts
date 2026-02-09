export class ConversationAnalysis {
    id?: string;
    user_id: string;
    message_id?: string;
    user_message: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    emotion_detected: string;
    topic_category: string;
    keywords: string[];
    importance_score: number;
    confidence_score: number;
    analyzed_at?: Date;

    constructor(partial: Partial<ConversationAnalysis>) {
        Object.assign(this, partial);
    }
}
