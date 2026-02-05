import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { GeminiService } from './gemini/gemini.service';
import { PromptService } from './prompt/prompt.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            //            envFilePath: '.env', // relative to root (app/) defined in package.json start script or cwd
        }),
        SupabaseModule,
    ],
    providers: [GeminiService, PromptService],
    exports: [SupabaseModule, GeminiService, PromptService],
})
export class CoreModule { }
