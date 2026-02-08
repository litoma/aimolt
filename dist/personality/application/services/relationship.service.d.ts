import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { IRelationshipHistoryRepository } from '../../domain/repositories/relationship-history.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';
export interface InteractionImpact {
    affection: number;
    trust: number;
    comfort: number;
    isMeaningful: boolean;
}
export declare class RelationshipService {
    private readonly relationshipRepository;
    private readonly historyRepository;
    constructor(relationshipRepository: IRelationshipRepository, historyRepository: IRelationshipHistoryRepository);
    getRelationship(userId: string): Promise<Relationship>;
    createInitialRelationship(userId: string): Promise<Relationship>;
    updateRelationship(userId: string, interactionData: any): Promise<Relationship>;
    private calculateImpact;
    private determineStage;
    private logChanges;
    private clamp;
}
