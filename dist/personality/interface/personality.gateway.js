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
exports.PersonalityGateway = void 0;
const common_1 = require("@nestjs/common");
const discord_service_1 = require("../../discord/discord.service");
const vad_service_1 = require("../services/vad.service");
const relationship_service_1 = require("../services/relationship.service");
const discord_js_1 = require("discord.js");
let PersonalityGateway = class PersonalityGateway {
    constructor(discordService, vadService, relationshipService) {
        this.discordService = discordService;
        this.vadService = vadService;
        this.relationshipService = relationshipService;
    }
    onModuleInit() {
        if (!this.discordService.client) {
            console.error('[PersonlityGateway] Discord Client not found!');
            return;
        }
        this.discordService.client.on('messageCreate', (message) => this.handleMessage(message));
        console.log('[PersonalityGateway] Subscribed to messageCreate events');
    }
    async handleMessage(message) {
        console.log(`[DEBUG] PersonalityGateway saw message: ${message.content}`);
        if (message.author.bot)
            return;
        if (message.content.startsWith('!personality status')) {
            console.log('[DEBUG] Matched !personality status command');
            await this.handleStatus(message);
        }
    }
    async handleStatus(message) {
        const targetUser = message.mentions.users.first() || message.author;
        const targetUserId = targetUser.id;
        const stopTyping = this.discordService.startTyping(message.channel);
        try {
            const [emotion, relationship] = await Promise.all([
                this.vadService.getCurrentEmotion(targetUserId),
                this.relationshipService.getRelationship(targetUserId),
            ]);
            const embed = new discord_js_1.EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`Personality Status: ${targetUser.username}`)
                .addFields({
                name: '🎭 Emotion (VAD)',
                value: `Valence: ${emotion.valence}\nArousal: ${emotion.arousal}\nDominance: ${emotion.dominance}\nMood: ${emotion.mood_type}`,
                inline: true
            }, {
                name: '🤝 Relationship',
                value: `Stage: ${relationship.relationship_stage}\nAffection: ${relationship.affection_level}\nTrust: ${relationship.trust_level}`,
                inline: true
            })
                .setTimestamp();
            await message.reply({ embeds: [embed] });
        }
        catch (error) {
            console.error('Error handling personality status:', error);
            await message.reply('❌ An error occurred while fetching user status.');
        }
        finally {
            stopTyping();
        }
    }
};
exports.PersonalityGateway = PersonalityGateway;
exports.PersonalityGateway = PersonalityGateway = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [discord_service_1.DiscordService,
        vad_service_1.VADService,
        relationship_service_1.RelationshipService])
], PersonalityGateway);
//# sourceMappingURL=personality.gateway.js.map