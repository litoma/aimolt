import { Injectable, Inject } from '@nestjs/common';
import { IUserMemoryRepository } from '../../domain/repositories/user-memory.repository.interface';
import { UserMemory } from '../../domain/entities/user-memory.entity';
import { ConversationAnalysis } from '../../domain/entities/conversation-analysis.entity';

@Injectable()
export class MemoryService {
    constructor(
        @Inject(IUserMemoryRepository)
        private readonly memoryRepository: IUserMemoryRepository,
    ) { }

    async processMemory(analysis: ConversationAnalysis): Promise<void> {
        // Only store important memories
        if (analysis.importance_score < 4) return;

        // Check if message implies a user preference or fact
        if (this.isWorthRemembering(analysis.user_message)) {
            const memory = new UserMemory({
                user_id: analysis.user_id,
                content: analysis.user_message, // Ideally, extract the core fact
                importance_score: analysis.importance_score,
                emotional_weight: analysis.sentiment === 'positive' ? 1 : analysis.sentiment === 'negative' ? -1 : 0,
                keywords: analysis.keywords,
                source_message_id: analysis.message_id
            });

            await this.memoryRepository.create(memory);
        }
    }

    private isWorthRemembering(message: string): boolean {
        // Simple heuristic: declarative statements about self or strong opinions
        return /私は|俺は|僕は|が好き|が嫌い|したい|なりたい|思う/.test(message);
    }

    async getRelevantMemories(userId: string): Promise<string> {
        const memories = await this.memoryRepository.findByUserId(userId, 5);
        if (memories.length === 0) return '';

        return memories.map(m => `- ${m.content}`).join('\n');
    }
}
