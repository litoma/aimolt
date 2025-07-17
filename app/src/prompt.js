const fs = require('fs').promises;
const path = require('path');

/**
 * プロンプト管理クラス
 * app/prompt/ ディレクトリ内のプロンプトファイルを一元管理
 */
class PromptManager {
  constructor() {
    this.promptCache = new Map();
    this.promptDir = path.join(__dirname, '../prompt');
  }

  /**
   * プロンプトファイルを読み込む
   * @param {string} filename - プロンプトファイル名（拡張子なし）
   * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
   * @returns {Promise<string>} プロンプト内容
   */
  async loadPrompt(filename, useCache = true) {
    const cacheKey = filename;
    
    // キャッシュから取得
    if (useCache && this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey);
    }

    try {
      const filePath = path.join(this.promptDir, `${filename}.txt`);
      const content = await fs.readFile(filePath, 'utf8');
      const trimmedContent = content.trim();
      
      // キャッシュに保存
      if (useCache) {
        this.promptCache.set(cacheKey, trimmedContent);
      }
      
      return trimmedContent;
    } catch (error) {
      throw new Error(`Failed to load prompt '${filename}': ${error.message}`);
    }
  }

  /**
   * プロンプトキャッシュをクリア
   * @param {string} filename - クリアする特定のファイル名（省略時は全クリア）
   */
  clearCache(filename = null) {
    if (filename) {
      this.promptCache.delete(filename);
    } else {
      this.promptCache.clear();
    }
  }

  /**
   * 利用可能なプロンプトファイル一覧を取得
   * @returns {Promise<string[]>} プロンプトファイル名のリスト
   */
  async getAvailablePrompts() {
    try {
      const files = await fs.readdir(this.promptDir);
      return files
        .filter(file => file.endsWith('.txt'))
        .map(file => file.replace('.txt', ''));
    } catch (error) {
      console.error('Error reading prompt directory:', error.message);
      return [];
    }
  }

  /**
   * プロンプトが存在するかチェック
   * @param {string} filename - プロンプトファイル名（拡張子なし）
   * @returns {Promise<boolean>} 存在するかどうか
   */
  async promptExists(filename) {
    try {
      const filePath = path.join(this.promptDir, `${filename}.txt`);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// シングルトンインスタンスを作成
const promptManager = new PromptManager();

/**
 * プロンプト取得の便利関数
 */
const prompts = {
  /**
   * システム指示を取得
   */
  async getSystem() {
    return await promptManager.loadPrompt('system');
  },

  /**
   * 👍リアクション用プロンプトを取得
   */
  async getLike() {
    return await promptManager.loadPrompt('like');
  },

  /**
   * ❓リアクション用プロンプトを取得
   */
  async getExplain() {
    return await promptManager.loadPrompt('explain');
  },

  /**
   * 音声文字起こし用プロンプトを取得
   */
  async getTranscribe() {
    return await promptManager.loadPrompt('transcribe');
  },

  /**
   * 📝メモ用プロンプトを取得
   */
  async getMemo() {
    return await promptManager.loadPrompt('memo');
  },

  /**
   * カスタムプロンプトを取得
   * @param {string} filename - プロンプトファイル名（拡張子なし）
   */
  async getCustomPrompt(filename) {
    return await promptManager.loadPrompt(filename);
  }
};

module.exports = {
  PromptManager,
  promptManager,
  prompts
};
