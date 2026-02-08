import { Emotion } from '../entities/emotion.entity';
export interface IEmotionRepository {
    findByUserId(userId: string): Promise<Emotion | null>;
    create(emotion: Emotion): Promise<Emotion>;
    update(emotion: Emotion): Promise<Emotion>;
}
export declare const IEmotionRepository: unique symbol;
