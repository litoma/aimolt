export async function retry<T>(
    operation: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000,
    maxDelay: number = 10000,
    operationName: string = "Operation"
): Promise<T> {
    let lastError: Error | unknown;

    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const currentDelay = Math.min(delay * Math.pow(2, i), maxDelay);
            console.warn(
                `[${operationName}] Failed attempt ${i + 1}/${retries}. Retrying in ${currentDelay}ms...`,
                error instanceof Error ? error.message : error
            );
            if (i < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, currentDelay));
            }
        }
    }

    throw lastError;
}
