"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRelationshipRepository = void 0;
const common_1 = require("@nestjs/common");
const relationship_entity_1 = require("../../domain/entities/relationship.entity");
const supabase_service_1 = require("../../../core/supabase/supabase.service");
let SupabaseRelationshipRepository = class SupabaseRelationshipRepository {
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    get client() {
        return this.supabaseService.getClient();
    }
    async findByUserId(userId) {
        const { data, error } = await this.client
            .from('relationships')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) {
            console.error('Error fetching relationship:', error);
            throw error;
        }
        if (!data)
            return null;
        const entity = new relationship_entity_1.Relationship(data);
        if (data.conversation_count !== undefined) {
            entity.total_conversations = data.conversation_count;
        }
        return entity;
    }
    async create(relationship) {
        const payload = this.toDbPayload(relationship);
        const { data, error } = await this.client
            .from('relationships')
            .insert([payload])
            .select()
            .single();
        if (error) {
            console.error('Error creating relationship:', error);
            throw error;
        }
        return this.toEntity(data);
    }
    async update(relationship) {
        const payload = this.toDbPayload(relationship);
        const { user_id, ...updates } = payload;
        const { data, error } = await this.client
            .from('relationships')
            .update(updates)
            .eq('user_id', user_id)
            .select()
            .single();
        if (error) {
            console.error('Error updating relationship:', error);
            throw error;
        }
        return this.toEntity(data);
    }
    toDbPayload(relationship) {
        const { total_conversations, ...rest } = relationship;
        return {
            ...rest,
            conversation_count: total_conversations,
        };
    }
    toEntity(data) {
        const entity = new relationship_entity_1.Relationship(data);
        if (data.conversation_count !== undefined) {
            entity.total_conversations = data.conversation_count;
        }
        return entity;
    }
};
exports.SupabaseRelationshipRepository = SupabaseRelationshipRepository;
exports.SupabaseRelationshipRepository = SupabaseRelationshipRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SupabaseRelationshipRepository);
//# sourceMappingURL=supabase-relationship.repository.js.map