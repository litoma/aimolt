"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractionModule = void 0;
const common_1 = require("@nestjs/common");
const core_module_1 = require("../core/core.module");
const personality_module_1 = require("../personality/personality.module");
const discord_module_1 = require("../discord/discord.module");
const like_service_1 = require("./application/services/like.service");
const memo_service_1 = require("./application/services/memo.service");
const transcription_service_1 = require("./application/services/transcription.service");
const reaction_gateway_1 = require("./interface/reaction.gateway");
let InteractionModule = class InteractionModule {
};
exports.InteractionModule = InteractionModule;
exports.InteractionModule = InteractionModule = __decorate([
    (0, common_1.Module)({
        imports: [core_module_1.CoreModule, personality_module_1.PersonalityModule, discord_module_1.DiscordModule],
        providers: [like_service_1.LikeService, memo_service_1.MemoService, transcription_service_1.TranscriptionService, reaction_gateway_1.ReactionGateway],
        exports: [like_service_1.LikeService, memo_service_1.MemoService, transcription_service_1.TranscriptionService],
    })
], InteractionModule);
//# sourceMappingURL=interaction.module.js.map