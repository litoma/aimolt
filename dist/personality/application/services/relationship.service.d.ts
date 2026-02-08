import { IRelationshipRepository } from '../../domain/repositories/relationship.repository.interface';
import { Relationship } from '../../domain/entities/relationship.entity';
export interface InteractionImpact {
    affection: number;
    trust: number;
    comfort: number;
    isMeaningful: boolean;
}
export declare class RelationshipService {
    private readonly relationshipRepository;
    constructor(relationshipRepository: IRelationshipRepository);
    getRelationship(userId: string): Promise<Relationship>;
    createInitialRelationship(userId: string): Promise<Relationship>;
    updateRelationship(userId: string, interactionData: any): Promise<Relationship>;
    private calculateImpact;
    private determineStage;
    private clamp;
}
