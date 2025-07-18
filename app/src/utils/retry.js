/**
 * Gemini API リトライ処理ユーティリティ
 * 503 Service Unavailable エラーに対する指数バックオフ付きリトライ機能
 */

/**
 * 指数バックオフ付きリトライ処理
 * @param {Function} fn - 実行する関数
 * @param {Object} options - オプション
 * @param {number} options.maxRetries - 最大リトライ回数 (デフォルト: 3)
 * @param {number} options.baseDelay - 基本待機時間（ミリ秒）(デフォルト: 1000)
 * @param {number} options.maxDelay - 最大待機時間（ミリ秒）(デフォルト: 10000)
 * @param {Function} options.shouldRetry - リトライ判定関数
 * @returns {Promise} 実行結果
 */
async function retryWithExponentialBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => isRetryableError(error)
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 最後の試行または リトライ不可能なエラーの場合は即座に throw
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }
      
      // 指数バックオフ計算
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      
      console.warn(`Gemini API リトライ ${attempt + 1}/${maxRetries} - ${delay}ms 待機中...`, {
        error: error.message,
        attempt: attempt + 1,
        delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * リトライ可能なエラーかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean} リトライ可能かどうか
 */
function isRetryableError(error) {
  // GoogleGenerativeAI のエラーを確認
  if (error.name === 'GoogleGenerativeAIFetchError' || 
      error.constructor.name === 'GoogleGenerativeAIFetchError') {
    
    // 503 Service Unavailable - リトライ可能
    if (error.message.includes('[503 Service Unavailable]') ||
        error.message.includes('overloaded') ||
        error.message.includes('temporarily unavailable')) {
      return true;
    }
    
    // 429 Too Many Requests - リトライ可能
    if (error.message.includes('[429') ||
        error.message.includes('rate limit') ||
        error.message.includes('quota')) {
      return true;
    }
    
    // 500 Internal Server Error - リトライ可能
    if (error.message.includes('[500') ||
        error.message.includes('Internal Server Error')) {
      return true;
    }
    
    // 502 Bad Gateway - リトライ可能
    if (error.message.includes('[502') ||
        error.message.includes('Bad Gateway')) {
      return true;
    }
    
    // 504 Gateway Timeout - リトライ可能
    if (error.message.includes('[504') ||
        error.message.includes('Gateway Timeout')) {
      return true;
    }
  }
  
  // ネットワーク関連のエラー
  if (error.code === 'ECONNRESET' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT') {
    return true;
  }
  
  return false;
}

/**
 * Gemini API 呼び出し用のリトライラッパー
 * @param {Function} apiCall - API呼び出し関数
 * @param {string} operation - 操作名（ログ用）
 * @param {Object} retryOptions - リトライオプション
 * @returns {Promise} API呼び出し結果
 */
async function retryGeminiApiCall(apiCall, operation = 'Gemini API Call', retryOptions = {}) {
  const defaultOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  };
  
  const options = { ...defaultOptions, ...retryOptions };
  
  console.log(`🔄 ${operation} 実行中...`);
  
  try {
    const result = await retryWithExponentialBackoff(apiCall, options);
    console.log(`✅ ${operation} 成功`);
    return result;
  } catch (error) {
    console.error(`❌ ${operation} 失敗 (全${options.maxRetries + 1}回試行後):`, error.message);
    throw error;
  }
}

module.exports = {
  retryWithExponentialBackoff,
  retryGeminiApiCall,
  isRetryableError
};