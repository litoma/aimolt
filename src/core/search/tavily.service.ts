
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TavilyService {
    private readonly apiKey: string;
    private readonly apiUrl = 'https://api.tavily.com/search';

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('TAVILY_API_KEY');
        if (!this.apiKey) {
            console.warn('TAVILY_API_KEY is not set. Search functionality will be disabled.');
        }
    }

    async search(query: string): Promise<string[]> {
        if (!this.apiKey) {
            return [];
        }

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    api_key: this.apiKey,
                    query: query,
                    search_depth: "basic",
                    include_answer: false,
                    include_raw_content: false,
                    max_results: 3,
                }),
            });

            if (!response.ok) {
                console.error(`Tavily API error: ${response.statusText}`);
                return [];
            }

            const data = await response.json();

            if (!data.results || !Array.isArray(data.results)) {
                return [];
            }

            return data.results.map((result: any) =>
                `Title: ${result.title}\nContent: ${result.content}\nURL: ${result.url}`
            );

        } catch (error) {
            console.error('Failed to search with Tavily:', error);
            return [];
        }
    }
}
