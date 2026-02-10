import { ConfigService } from '@nestjs/config';
import { GeminiService } from '../../../core/gemini/gemini.service';
import { PromptService } from '../../../core/prompt/prompt.service';
import { VADService } from '../../../personality/services/vad.service';
import { RelationshipService } from '../../../personality/services/relationship.service';
import { AnalysisService } from '../../../personality/services/analysis.service';
import { MemoryService } from '../../../personality/services/memory.service';
import { SupabaseService } from '../../../core/supabase/supabase.service';
import { Message } from 'discord.js';
export declare class LikeService {
    private readonly geminiService;
    private readonly promptService;
    private readonly vadService;
    private readonly relationshipService;
    private readonly analysisService;
    private readonly memoryService;
    private readonly supabaseService;
    private readonly configService;
    constructor(geminiService: GeminiService, promptService: PromptService, vadService: VADService, relationshipService: RelationshipService, analysisService: AnalysisService, memoryService: MemoryService, supabaseService: SupabaseService, configService: ConfigService);
    handleLike(message: Message, userId: string, saveHistory?: boolean): Promise<void>;
    private updatePersonality;
    private getRecentContext;
    private saveConversation;
}
