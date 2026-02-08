"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Emotion = void 0;
class Emotion {
    constructor(partial) {
        Object.assign(this, partial);
        this.valence = this.valence ?? 50;
        this.arousal = this.arousal ?? 50;
        this.dominance = this.dominance ?? 50;
        this.energy_level = this.energy_level ?? 50;
        this.interest_level = this.interest_level ?? 50;
        this.intimacy_level = this.intimacy_level ?? 0;
        this.mood_type = this.mood_type ?? 'neutral';
        this.conversation_count = this.conversation_count ?? 0;
        this.last_interaction = this.last_interaction ?? new Date();
    }
    static createDefault(userId) {
        return new Emotion({
            user_id: userId,
        });
    }
}
exports.Emotion = Emotion;
//# sourceMappingURL=emotion.entity.js.map