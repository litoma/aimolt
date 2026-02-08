"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_module_1 = require("./supabase/supabase.module");
const gemini_service_1 = require("./gemini/gemini.service");
const prompt_service_1 = require("./prompt/prompt.service");
const common_service_1 = require("./common/common.service");
let CoreModule = class CoreModule {
};
exports.CoreModule = CoreModule;
exports.CoreModule = CoreModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            supabase_module_1.SupabaseModule,
        ],
        providers: [gemini_service_1.GeminiService, prompt_service_1.PromptService, common_service_1.CommonService],
        exports: [supabase_module_1.SupabaseModule, gemini_service_1.GeminiService, prompt_service_1.PromptService, common_service_1.CommonService],
    })
], CoreModule);
//# sourceMappingURL=core.module.js.map