import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { GeminiService } from './gemini/gemini.service';
import { PromptService } from './prompt/prompt.service';
import { CommonService } from './common/common.service';
import { TavilyService } from './search/tavily.service';

import { BackupService } from './backup/backup.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        SupabaseModule,
    ],
    providers: [GeminiService, PromptService, CommonService, TavilyService, BackupService],
    exports: [SupabaseModule, GeminiService, PromptService, CommonService, TavilyService, BackupService],
})
export class CoreModule { }
