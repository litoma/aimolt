import { UserMemory } from '../entities/user-memory.entity';

export const IUserMemoryRepository = Symbol('IUserMemoryRepository');

export interface IUserMemoryRepository {
    create(memory: UserMemory): Promise<UserMemory>;
    findByUserId(userId: string, limit: number): Promise<UserMemory[]>;
}
