import { ConversationAnalysis } from '../entities/conversation-analysis.entity';

export const IConversationAnalysisRepository = Symbol('IConversationAnalysisRepository');

export interface IConversationAnalysisRepository {
    create(analysis: ConversationAnalysis): Promise<ConversationAnalysis>;
    findRecentByUserId(userId: string, limit: number): Promise<ConversationAnalysis[]>;
}
