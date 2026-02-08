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
exports.SupabaseEmotionRepository = void 0;
const common_1 = require("@nestjs/common");
const emotion_entity_1 = require("../../domain/entities/emotion.entity");
const supabase_service_1 = require("../../../core/supabase/supabase.service");
let SupabaseEmotionRepository = class SupabaseEmotionRepository {
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    get client() {
        return this.supabaseService.getClient();
    }
    async findByUserId(userId) {
        const { data, error } = await this.client
            .from('emotion_states')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) {
            console.error('Error fetching emotion:', error);
            throw error;
        }
        return data ? new emotion_entity_1.Emotion(data) : null;
    }
    async create(emotion) {
        const { data, error } = await this.client
            .from('emotion_states')
            .insert([emotion])
            .select()
            .single();
        if (error) {
            console.error('Error creating emotion:', error);
            throw error;
        }
        return new emotion_entity_1.Emotion(data);
    }
    async update(emotion) {
        const { user_id, ...updates } = emotion;
        const { data, error } = await this.client
            .from('emotion_states')
            .update(updates)
            .eq('user_id', user_id)
            .select()
            .single();
        if (error) {
            console.error('Error updating emotion:', error);
            throw error;
        }
        return new emotion_entity_1.Emotion(data);
    }
};
exports.SupabaseEmotionRepository = SupabaseEmotionRepository;
exports.SupabaseEmotionRepository = SupabaseEmotionRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], SupabaseEmotionRepository);
//# sourceMappingURL=supabase-emotion.repository.js.map