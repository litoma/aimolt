"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relationship = void 0;
class Relationship {
    constructor(partial) {
        Object.assign(this, partial);
        this.affection_level = this.affection_level ?? 50;
        this.trust_level = this.trust_level ?? 50;
        this.comfort_level = this.comfort_level ?? 50;
        this.last_interaction = this.last_interaction ?? new Date();
        this.relationship_stage = this.relationship_stage ?? 'stranger';
        this.known_interests = this.known_interests ?? [];
        this.preferred_formality = this.preferred_formality ?? 'formal';
        this.total_conversations = this.total_conversations ?? 0;
        this.meaningful_interactions = this.meaningful_interactions ?? 0;
    }
    static createDefault(userId) {
        return new Relationship({
            user_id: userId,
        });
    }
}
exports.Relationship = Relationship;
//# sourceMappingURL=relationship.entity.js.map