import { IEmotionRepository } from '../../domain/repositories/emotion.repository.interface';
import { Emotion } from '../../domain/entities/emotion.entity';
export declare class VADService {
    private readonly emotionRepository;
    constructor(emotionRepository: IEmotionRepository);
    getCurrentEmotion(userId: string): Promise<Emotion>;
    createInitialEmotion(userId: string): Promise<Emotion>;
    updateEmotion(userId: string, message: string): Promise<Emotion>;
    calculateVAD(message: string): {
        valence: number;
        arousal: number;
        dominance: number;
    };
    private calculateValence;
    private calculateArousal;
    private calculateDominance;
}
