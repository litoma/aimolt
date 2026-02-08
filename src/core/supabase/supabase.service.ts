import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private supabase: SupabaseClient;

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('SUPABASE_URL or SUPABASE_KEY is not defined in environment variables');
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
        console.log('✅ Supabase client initialized via NestJS');
    }

    getClient(): SupabaseClient {
        return this.supabase;
    }
}
