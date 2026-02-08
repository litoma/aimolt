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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationshipService = void 0;
const common_1 = require("@nestjs/common");
const relationship_repository_interface_1 = require("../../domain/repositories/relationship.repository.interface");
const relationship_entity_1 = require("../../domain/entities/relationship.entity");
let RelationshipService = class RelationshipService {
    constructor(relationshipRepository) {
        this.relationshipRepository = relationshipRepository;
    }
    async getRelationship(userId) {
        let relationship = await this.relationshipRepository.findByUserId(userId);
        if (!relationship) {
            relationship = await this.createInitialRelationship(userId);
        }
        return relationship;
    }
    async createInitialRelationship(userId) {
        const defaultRelationship = relationship_entity_1.Relationship.createDefault(userId);
        return await this.relationshipRepository.create(defaultRelationship);
    }
    async updateRelationship(userId, interactionData) {
        const relationship = await this.getRelationship(userId);
        const impact = this.calculateImpact(interactionData);
        relationship.affection_level = this.clamp(relationship.affection_level + impact.affection, 0, 100);
        relationship.trust_level = this.clamp(relationship.trust_level + impact.trust, 0, 100);
        relationship.comfort_level = this.clamp(relationship.comfort_level + impact.comfort, 0, 100);
        relationship.total_conversations += 1;
        if (impact.isMeaningful) {
            relationship.meaningful_interactions += 1;
        }
        relationship.last_interaction = new Date();
        relationship.relationship_stage = this.determineStage(relationship);
        return await this.relationshipRepository.update(relationship);
    }
    calculateImpact(data) {
        const sentiment = data.sentiment || 'neutral';
        const sentimentScore = data.sentimentScore || 0;
        let impact = { affection: 0, trust: 0, comfort: 1, isMeaningful: false };
        if (sentiment === 'positive') {
            impact.affection = 2;
            impact.trust = 1;
        }
        else if (sentiment === 'negative') {
            impact.affection = -1;
        }
        if (Math.abs(sentimentScore) > 0.5)
            impact.isMeaningful = true;
        return impact;
    }
    determineStage(r) {
        const score = (r.affection_level + r.trust_level + r.comfort_level) / 3;
        if (score >= 80 && r.meaningful_interactions >= 20)
            return 'close_friend';
        if (score >= 50 && r.meaningful_interactions >= 5)
            return 'friend';
        if (score >= 20)
            return 'acquaintance';
        return 'stranger';
    }
    clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
};
exports.RelationshipService = RelationshipService;
exports.RelationshipService = RelationshipService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(relationship_repository_interface_1.IRelationshipRepository)),
    __metadata("design:paramtypes", [Object])
], RelationshipService);
//# sourceMappingURL=relationship.service.js.map