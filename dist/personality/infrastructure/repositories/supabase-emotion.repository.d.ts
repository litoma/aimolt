import { IEmotionRepository } from '../../domain/repositories/emotion.repository.interface';
import { Emotion } from '../../domain/entities/emotion.entity';
import { SupabaseService } from '../../../core/supabase/supabase.service';
export declare class SupabaseEmotionRepository implements IEmotionRepository {
    private readonly supabaseService;
    constructor(supabaseService: SupabaseService);
    private get client();
    findByUserId(userId: string): Promise<Emotion | null>;
    create(emotion: Emotion): Promise<Emotion>;
    update(emotion: Emotion): Promise<Emotion>;
}
