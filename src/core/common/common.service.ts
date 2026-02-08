import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
    async retry<T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000,
        maxDelay: number = 10000,
        operationName: string = 'Operation'
    ): Promise<T> {
        let retries = 0;
        while (true) {
            try {
                return await fn();
            } catch (error) {
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
}
