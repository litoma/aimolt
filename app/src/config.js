// Gemini AI Model Configuration
const GEMINI_MODELS = {
    // 高速・軽量モデル
    FAST: 'gemini-3-flash',

    // 高精度モデル
    HIGH_ACCURACY: 'gemini-3-flash',

    // 実験的モデル（最新機能など）
    EXPERIMENTAL: 'gemini-3-flash',

    // 3.0系プレビュー
    PREVIEW_3: 'gemini-3-flash',

    // 2.5系Flash
    FLASH_2_5: 'gemini-3-flash'
};

const DEFAULT_MODEL = GEMINI_MODELS.FAST;

module.exports = {
    GEMINI_MODELS,
    DEFAULT_MODEL
};
