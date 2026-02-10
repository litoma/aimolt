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
exports.DiscordService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const discord_js_1 = require("discord.js");
let DiscordService = class DiscordService {
    constructor(configService) {
        this.configService = configService;
        this.client = new discord_js_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.GuildMessageReactions,
            ],
            partials: [
                discord_js_1.Partials.Message,
                discord_js_1.Partials.Channel,
                discord_js_1.Partials.Reaction,
            ],
        });
    }
    async onModuleInit() {
        const token = this.configService.get('DISCORD_TOKEN');
        if (!token) {
            throw new Error('DISCORD_TOKEN is not defined');
        }
        this.client.on('ready', () => {
            console.log(`Logged in as ${this.client.user?.tag}! (NestJS)`);
        });
        this.client.on('messageCreate', (message) => {
            console.log(`[DEBUG] DiscordService received message: ${message.content} from ${message.author.tag}`);
        });
        await this.client.login(token);
    }
    async onModuleDestroy() {
        await this.client.destroy();
    }
    startTyping(channel) {
        if (channel.sendTyping) {
            channel.sendTyping().catch(console.error);
        }
        const interval = setInterval(() => {
            if (channel.sendTyping) {
                channel.sendTyping().catch(console.error);
            }
        }, 9000);
        return () => clearInterval(interval);
    }
};
exports.DiscordService = DiscordService;
exports.DiscordService = DiscordService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DiscordService);
//# sourceMappingURL=discord.service.js.map