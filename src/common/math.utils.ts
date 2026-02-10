export class MathUtils {
    /**
     * Optimized Cosine Similarity Calculation (SIMD-like unrolling)
     * Reference: https://qiita.com/snamo-suzuki/items/89d1e74bbf7ace90b96d#63-%E3%83%91%E3%83%95%E3%82%A9%E3%83%BC%E3%83%9E%E3%83%B3%E3%82%B9%E6%9C%80%E9%81%A9%E5%8C%96%E7%89%88
     */
    static cosineSimilarity(vecA: number[], vecB: number[]): number {
        const len = vecA.length;
        if (len !== vecB.length) {
            throw new Error(`Vector dimension mismatch: ${len} vs ${vecB.length}`);
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        // Loop unrolling (process 4 items at a time)
        const remainder = len % 4;
        const limit = len - remainder;

        for (let i = 0; i < limit; i += 4) {
            const a0 = vecA[i], a1 = vecA[i + 1], a2 = vecA[i + 2], a3 = vecA[i + 3];
            const b0 = vecB[i], b1 = vecB[i + 1], b2 = vecB[i + 2], b3 = vecB[i + 3];

            dotProduct += a0 * b0 + a1 * b1 + a2 * b2 + a3 * b3;
            normA += a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
            normB += b0 * b0 + b1 * b1 + b2 * b2 + b3 * b3;
        }

        // Process remaining items
        for (let i = limit; i < len; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }
}
