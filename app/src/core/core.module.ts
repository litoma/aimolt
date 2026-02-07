import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { GeminiService } from './gemini/gemini.service';
import { PromptService } from './prompt/prompt.service';
import { CommonService } from './common/common.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        SupabaseModule,
    ],
    providers: [GeminiService, PromptService, CommonService],
    exports: [SupabaseModule, GeminiService, PromptService, CommonService],
})
export class CoreModule { }
