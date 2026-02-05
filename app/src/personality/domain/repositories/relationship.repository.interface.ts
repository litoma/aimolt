import { Relationship } from '../entities/relationship.entity';

export interface IRelationshipRepository {
    findByUserId(userId: string): Promise<Relationship | null>;
    create(relationship: Relationship): Promise<Relationship>;
    update(relationship: Relationship): Promise<Relationship>;
}

export const IRelationshipRepository = Symbol('IRelationshipRepository');
