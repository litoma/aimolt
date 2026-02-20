import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { CommonService } from '../common/common.service';

// Mock Google Generative AI
const mockGenerateContent = jest.fn().mockResolvedValue({
    response: { text: () => 'mocked text' }
});

const mockGetGenerativeModel = jest.fn().mockReturnValue({
    generateContent: mockGenerateContent,
    startChat: jest.fn(),
    embedContent: jest.fn(),
});

jest.mock('@google/generative-ai', () => {
    return {
        GoogleGenerativeAI: jest.fn().mockImplementation(() => {
            return {
                getGenerativeModel: mockGetGenerativeModel,
            };
        }),
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

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'default-model',
                systemInstruction: 'system prompt',
            })
        );
    });

    it('should use overridden model when modelOverride is provided', async () => {
        await service.generateText('system prompt', 'user prompt', 'override-model');

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
            expect.objectContaining({
                model: 'override-model',
                systemInstruction: 'system prompt',
            })
        );
    });
});
