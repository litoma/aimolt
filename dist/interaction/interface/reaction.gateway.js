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
exports.ReactionGateway = void 0;
const common_1 = require("@nestjs/common");
const discord_service_1 = require("../../discord/discord.service");
const like_service_1 = require("../application/services/like.service");
const memo_service_1 = require("../application/services/memo.service");
const transcription_service_1 = require("../application/services/transcription.service");
let ReactionGateway = class ReactionGateway {
    constructor(discordService, likeService, memoService, transcriptionService) {
        this.discordService = discordService;
        this.likeService = likeService;
        this.memoService = memoService;
        this.transcriptionService = transcriptionService;
    }
    onModuleInit() {
        if (!this.discordService.client) {
            console.error('[ReactionGateway] Discord Client not found!');
            return;
        }
        this.discordService.client.on('messageReactionAdd', (reaction, user) => this.handleReaction(reaction, user));
        console.log('[ReactionGateway] Subscribed to messageReactionAdd events');
    }
    async handleReaction(reaction, user) {
        if (user.bot)
            return;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            }
            catch (error) {
                console.error('Something went wrong when fetching the message:', error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            }
            catch (error) {
                console.error('Something went wrong when fetching the user:', error);
                return;
            }
        }
        const fullUser = user;
        const fullReaction = reaction;
        const stopTyping = this.discordService.startTyping(fullReaction.message.channel);
        try {
            if (fullReaction.emoji.name === '👍') {
                const message = await fullReaction.message.fetch();
                if (!message.author.bot) {
                    await this.likeService.handleLike(message, fullUser.id);
                }
            }
            if (fullReaction.emoji.name === '📝') {
                const message = await fullReaction.message.fetch();
                await this.memoService.handleMemo(message, fullUser.id);
            }
            if (fullReaction.emoji.name === '🎤') {
                const message = await fullReaction.message.fetch();
                await this.transcriptionService.handleTranscription(message, fullUser.id);
            }
        }
        catch (error) {
            console.error('[ReactionGateway] Error processing reaction:', error);
        }
        finally {
            stopTyping();
        }
    }
};
exports.ReactionGateway = ReactionGateway;
exports.ReactionGateway = ReactionGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [discord_service_1.DiscordService,
        like_service_1.LikeService,
        memo_service_1.MemoService,
        transcription_service_1.TranscriptionService])
], ReactionGateway);
//# sourceMappingURL=reaction.gateway.js.map