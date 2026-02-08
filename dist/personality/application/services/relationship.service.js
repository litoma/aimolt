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
const relationship_history_repository_interface_1 = require("../../domain/repositories/relationship-history.repository.interface");
const relationship_entity_1 = require("../../domain/entities/relationship.entity");
const relationship_history_entity_1 = require("../../domain/entities/relationship-history.entity");
let RelationshipService = class RelationshipService {
    constructor(relationshipRepository, historyRepository) {
        this.relationshipRepository = relationshipRepository;
        this.historyRepository = historyRepository;
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
        const previousStage = relationship.relationship_stage;
        const impact = this.calculateImpact(interactionData, relationship);
        const oldValues = { ...relationship };
        relationship.affection_level = this.clamp(relationship.affection_level + impact.affection, 0, 100);
        relationship.trust_level = this.clamp(relationship.trust_level + impact.trust, 0, 100);
        relationship.comfort_level = this.clamp(relationship.comfort_level + impact.comfort, 0, 100);
        relationship.total_conversations += 1;
        if (impact.isMeaningful) {
            relationship.meaningful_interactions += 1;
        }
        relationship.last_interaction = new Date();
        relationship.relationship_stage = this.determineStage(relationship);
        const updated = await this.relationshipRepository.update(relationship);
        await this.logChanges(userId, oldValues, relationship, interactionData.userMessage || 'Interaction');
        return updated;
    }
    calculateImpact(data, current) {
        const sentiment = data.sentiment || 'neutral';
        const sentimentScore = data.sentimentScore || 0;
        const analysis = data.analysis;
        const vad = data.vad;
        let impact = { affection: 0, trust: 0, comfort: 1, isMeaningful: false };
        if (sentiment === 'positive')
            impact.affection += 1;
        if (sentiment === 'negative')
            impact.affection -= 1;
        if (analysis?.emotion_detected === 'gratitude')
            impact.affection += 2;
        if (analysis?.emotion_detected === 'love')
            impact.affection += 3;
        if (analysis?.user_message?.match(/秘密|相談|悩み/))
            impact.trust += 2;
        if (data.isLongTermUser)
            impact.trust += 0.5;
        if (current.total_conversations > 10)
            impact.comfort += 0.5;
        if (analysis?.emotion_detected === 'joy')
            impact.comfort += 1;
        if (vad) {
            if (vad.valence > 60)
                impact.affection += 1;
            if (vad.arousal > 60)
                impact.isMeaningful = true;
        }
        if (Math.abs(sentimentScore) > 0.6 || analysis?.importance_score >= 7) {
            impact.isMeaningful = true;
        }
        return impact;
    }
    determineStage(r) {
        const score = (r.affection_level + r.trust_level + r.comfort_level) / 3;
        if (score >= 80 && r.meaningful_interactions >= 20)
            return 'close_friend';
        if (score >= 50 && r.meaningful_interactions >= 10)
            return 'friend';
        if (score >= 20 || r.total_conversations >= 5)
            return 'acquaintance';
        return 'stranger';
    }
    async logChanges(userId, oldRel, newRel, message) {
        const changes = {};
        if (oldRel.affection_level !== newRel.affection_level) {
            await this.historyRepository.create(new relationship_history_entity_1.RelationshipHistory({
                user_id: userId,
                event_type: 'affection_change',
                new_value: newRel.affection_level.toString(),
                trigger_message: message
            }));
        }
        if (oldRel.trust_level !== newRel.trust_level) {
            await this.historyRepository.create(new relationship_history_entity_1.RelationshipHistory({
                user_id: userId,
                event_type: 'trust_change',
                new_value: newRel.trust_level.toString(),
                trigger_message: message
            }));
        }
        if (oldRel.relationship_stage !== newRel.relationship_stage) {
            await this.historyRepository.create(new relationship_history_entity_1.RelationshipHistory({
                user_id: userId,
                event_type: 'stage_change',
                new_value: newRel.relationship_stage,
                trigger_message: message
            }));
        }
    }
    clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
};
exports.RelationshipService = RelationshipService;
exports.RelationshipService = RelationshipService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(relationship_repository_interface_1.IRelationshipRepositoryToken)),
    __param(1, (0, common_1.Inject)(relationship_history_repository_interface_1.IRelationshipHistoryRepository)),
    __metadata("design:paramtypes", [Object, Object])
], RelationshipService);
//# sourceMappingURL=relationship.service.js.map