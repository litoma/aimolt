"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalityModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../core/core.module");
const vad_service_1 = require("./application/services/vad.service");
const relationship_service_1 = require("./application/services/relationship.service");
const analysis_service_1 = require("./application/services/analysis.service");
const memory_service_1 = require("./application/services/memory.service");
const supabase_emotion_repository_1 = require("./infrastructure/repositories/supabase-emotion.repository");
const supabase_relationship_repository_1 = require("./infrastructure/repositories/supabase-relationship.repository");
const supabase_user_memory_repository_1 = require("./infrastructure/repositories/supabase-user-memory.repository");
const emotion_repository_interface_1 = require("./domain/repositories/emotion.repository.interface");
const relationship_repository_interface_1 = require("./domain/repositories/relationship.repository.interface");
const user_memory_repository_interface_1 = require("./domain/repositories/user-memory.repository.interface");
const personality_gateway_1 = require("./interface/personality.gateway");
const discord_module_1 = require("../discord/discord.module");
let PersonalityModule = class PersonalityModule {
};
exports.PersonalityModule = PersonalityModule;
exports.PersonalityModule = PersonalityModule = __decorate([
    (0, common_1.Module)({
        imports: [core_module_1.CoreModule, discord_module_1.DiscordModule],
        providers: [
            personality_gateway_1.PersonalityGateway,
            vad_service_1.VADService,
            relationship_service_1.RelationshipService,
            analysis_service_1.AnalysisService,
            memory_service_1.MemoryService,
            {
                provide: emotion_repository_interface_1.IEmotionRepository,
                useClass: supabase_emotion_repository_1.SupabaseEmotionRepository,
            },
            {
                provide: relationship_repository_interface_1.IRelationshipRepositoryToken,
                useClass: supabase_relationship_repository_1.SupabaseRelationshipRepository,
            },
            {
                provide: user_memory_repository_interface_1.IUserMemoryRepository,
                useClass: supabase_user_memory_repository_1.SupabaseUserMemoryRepository,
            },
        ],
        exports: [vad_service_1.VADService, relationship_service_1.RelationshipService, analysis_service_1.AnalysisService, memory_service_1.MemoryService],
    })
], PersonalityModule);
//# sourceMappingURL=personality.module.js.map