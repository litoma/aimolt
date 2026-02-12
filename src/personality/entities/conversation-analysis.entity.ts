export class ConversationAnalysis {
    id?: string;
    user_id: string;
    user_message: string;
    bot_response?: string;
    analyzed_at?: Date;

    constructor(partial: Partial<ConversationAnalysis>) {
        Object.assign(this, partial);
    }
}
