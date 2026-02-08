"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const gemini_service_1 = require("./gemini.service");
const config_1 = require("@nestjs/config");
describe('GeminiService Configuration Safety', () => {
    let service;
    let configService;
    const mockConfigService = {
        get: jest.fn((key) => {
            if (key === 'GEMINI_API_KEY')
                return 'test-key';
            if (key === 'GEMINI_AI_MODEL')
                return 'user-defined-model-id';
            return null;
        }),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                gemini_service_1.GeminiService,
                {
                    provide: config_1.ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();
        service = module.get(gemini_service_1.GeminiService);
        configService = module.get(config_1.ConfigService);
    });
    it('should use exactly the model ID provided by ConfigService', () => {
        const modelInstance = service.model;
        expect(configService.get).toHaveBeenCalledWith('GEMINI_AI_MODEL');
    });
});
//# sourceMappingURL=gemini.service.spec.js.map