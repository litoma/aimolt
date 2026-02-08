import { RelationshipHistory } from '../entities/relationship-history.entity';

export const IRelationshipHistoryRepository = Symbol('IRelationshipHistoryRepository');

export interface IRelationshipHistoryRepository {
    create(history: RelationshipHistory): Promise<void>;
}
