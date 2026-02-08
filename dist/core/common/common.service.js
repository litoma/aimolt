"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonService = void 0;
const common_1 = require("@nestjs/common");
let CommonService = class CommonService {
    async retry(fn, maxRetries = 3, baseDelay = 1000, maxDelay = 10000, operationName = 'Operation') {
        let retries = 0;
        while (true) {
            try {
                return await fn();
            }
            catch (error) {
                if (retries >= maxRetries) {
                    console.error(`❌ ${operationName} failed after ${retries + 1} attempts: ${error.message}`);
                    throw error;
                }
                const delay = Math.min(baseDelay * Math.pow(2, retries), maxDelay);
                console.warn(`🔄 ${operationName} failed. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                retries++;
            }
        }
    }
};
exports.CommonService = CommonService;
exports.CommonService = CommonService = __decorate([
    (0, common_1.Injectable)()
], CommonService);
//# sourceMappingURL=common.service.js.map