import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { CommonService } from '../common/common.service';

const mockGenerateContent = jest.fn().mockResolvedValue({
    text: 'mocked text'
});

jest.mock('@google/genai', () => {
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => {
            return {
                models: {
                    generateContent: mockGenerateContent,
                    embedContent: jest.fn(),
                },
                chats: {
                    create: jest.fn(),
                }
            };
        })
    };
});

describe('GeminiService Model Override', () => {
    let service: GeminiService;
    let configService: ConfigService;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            if (key === 'GEMINI_API_KEY') return 'test-key';
            if (key === 'GEMINI_AI_MODEL') return 'default-model';
            return null;
        }),
    };

    const mockCommonService = {
        retry: jest.fn(async (fn: () => Promise<any>) => {
            return await fn();
        })
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GeminiService,
                {
                    provide: ConfigService,
                    useValue: mockConfigService,
                },
                {
                    provide: CommonService,
                    useValue: mockCommonService,
                }
            ],
        }).compile();

        service = module.get<GeminiService>(GeminiService);
        configService = module.get<ConfigService>(ConfigService);
    });

    it('should use default GEMINI_AI_MODEL when modelOverride is not provided', async () => {
        await service.generateText('system prompt', 'user prompt');

        expect(mockGenerateContent).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'default-model',
                config: expect.objectContaining({
                    systemInstruction: 'system prompt',
                })
            })
        );
    });
});
