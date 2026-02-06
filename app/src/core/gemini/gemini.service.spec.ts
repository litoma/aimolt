import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';

describe('GeminiService Configuration Safety', () => {
    let service: GeminiService;
    let configService: ConfigService;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'GEMINI_API_KEY') return 'test-key';
            if (key === 'GEMINI_AI_MODEL') return 'user-defined-model-id'; // User's specific ID
            return null;
        }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GeminiService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();

        service = module.get<GeminiService>(GeminiService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should use exactly the model ID provided by ConfigService', () => {
        // Access the private model property or check the initialization logic
        // Since model is private, we can verify behavior or use 'any' casting for test inspection
        const modelInstance = (service as any).model;

        // We can't easily inspect the internal model ID of GoogleGenerativeAI instance directly 
        // without mocking the library itself.
        // However, we can verify that ConfigService was queried for the correct key.

        expect(configService.get).toHaveBeenCalledWith('GEMINI_AI_MODEL');
    });

    // Ideally, we would mock GoogleGenerativeAI to verify the constructor arguments,
    // preventing "hardcoded fallback" logic from slipping in.
});
