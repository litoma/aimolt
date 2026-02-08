export declare class CommonService {
    retry<T>(fn: () => Promise<T>, maxRetries?: number, baseDelay?: number, maxDelay?: number, operationName?: string): Promise<T>;
}
