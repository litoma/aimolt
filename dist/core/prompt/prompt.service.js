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
exports.PromptService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../supabase/supabase.service");
const fs = require("fs");
const path = require("path");
const util_1 = require("util");
const readFileAsync = (0, util_1.promisify)(fs.readFile);
let PromptService = class PromptService {
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
        this.systemPrompt = '';
        this.likePrompt = '';
        this.transcribePrompt = '';
    }
    async onModuleInit() {
        await this.refreshPrompts();
    }
    async refreshPrompts() {
        const { data, error } = await this.supabaseService.getClient()
            .from('prompts')
            .select('prompt_type, content');
        if (!error && data && data.length > 0) {
            data.forEach(p => {
                if (p.prompt_type === 'system')
                    this.systemPrompt = p.content;
                if (p.prompt_type === 'like_reaction')
                    this.likePrompt = p.content;
                if (p.prompt_type === 'transcribe')
                    this.transcribePrompt = p.content;
            });
            console.log('✅ Prompts refreshed from DB');
        }
        else {
            console.warn('⚠️ DB Prompt fetch failed or empty, falling back to files:', error?.message);
            await this.loadFromFiles();
        }
    }
    async loadFromFiles() {
        try {
            const promptDir = path.join(process.cwd(), 'prompt');
            try {
                this.systemPrompt = await readFileAsync(path.join(promptDir, 'system.txt'), 'utf8');
                console.log('📄 Loaded system prompt from file');
            }
            catch (e) {
                console.warn('Failed to load system.txt');
            }
            try {
                this.likePrompt = await readFileAsync(path.join(promptDir, 'like_reaction.txt'), 'utf8');
                console.log('📄 Loaded like prompt from file');
            }
            catch (e) {
            }
            try {
                this.transcribePrompt = await readFileAsync(path.join(promptDir, 'transcribe.txt'), 'utf8');
            }
            catch (e) {
            }
        }
        catch (error) {
            console.error('❌ Failed to load prompts from files:', error);
        }
    }
    getSystemPrompt() {
        return this.systemPrompt || 'You are a helpful assistant.';
    }
    getLikePrompt() {
        return this.likePrompt || 'Generate a positive, short reaction.';
    }
    getTranscribePrompt() {
        return this.transcribePrompt || 'Transcript the audio to Japanese, removing filler words.';
    }
    async getDynamicLikePrompt(userId, message) {
        return this.getLikePrompt();
    }
};
exports.PromptService = PromptService;
exports.PromptService = PromptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], PromptService);
//# sourceMappingURL=prompt.service.js.map