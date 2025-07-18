const { emotionManager } = require('./emotion');
const { memoryManager } = require('./memory');
const { conversationAnalyzer } = require('./analyzer');
const { dynamicPromptGenerator } = require('./generator');

class PersonalityManager {
  constructor() {
    this.isEnabled = true;
    this.processingQueue = new Map(); // ユーザーごとの処理キュー
  }

  async getPersonalizedPrompt(userId, basePrompt, options = {}) {
    try {
      if (!this.isEnabled) {
        return basePrompt;
      }

      const {
        message = '',
        reactionType = null,
        analysisData = null,
        includeProfile = false
      } = options;

      // 分析データがない場合は簡易分析を実行
      let analysis = analysisData;
      if (!analysis && message) {
        analysis = await conversationAnalyzer.analyzeMessage(userId, message);
      }

      // 動的プロンプト生成
      const context = {
        type: reactionType ? 'reaction' : 'conversation',
        reactionType,
        message,
        analysisData: analysis,
        includeProfile
      };

      const personalizedPrompt = await dynamicPromptGenerator.generateDynamicPrompt(
        userId, 
        basePrompt, 
        context
      );

      return personalizedPrompt;
    } catch (error) {
      console.error('Error getting personalized prompt:', error);
      return basePrompt;
    }
  }

  async updatePersonalityFromConversation(userId, userMessage, botResponse, messageId = null) {
    try {
      if (!this.isEnabled) {
        return;
      }

      // 重複処理を防ぐためのキュー管理
      const queueKey = `${userId}_${Date.now()}`;
      if (this.processingQueue.has(userId)) {
        console.log(`Skipping duplicate processing for user ${userId}`);
        return;
      }

      this.processingQueue.set(userId, queueKey);

      try {
        // 1. 会話分析
        const analysisData = await conversationAnalyzer.analyzeMessage(userId, userMessage, messageId);

        // 2. 感情状態更新
        await emotionManager.updateEmotion(userId, analysisData);

        // 3. 重要な記憶の保存判定と実行
        await this.processMemoryStorage(userId, userMessage, botResponse, analysisData);

        console.log(`Personality updated for user ${userId}`);
      } finally {
        this.processingQueue.delete(userId);
      }
    } catch (error) {
      console.error('Error updating personality:', error);
      this.processingQueue.delete(userId);
    }
  }

  async processMemoryStorage(userId, userMessage, botResponse, analysisData) {
    try {
      // 重要度スコアに基づいて記憶として保存するかを判定
      const shouldSaveAsMemory = this.shouldSaveAsMemory(analysisData);
      
      if (shouldSaveAsMemory) {
        // 記憶タイプを決定
        const memoryType = this.determineMemoryType(analysisData);
        
        // 記憶内容を生成
        const memoryContent = this.generateMemoryContent(userMessage, botResponse, analysisData);
        
        // 感情的重みを計算
        const emotionalWeight = this.calculateEmotionalWeight(analysisData);
        
        // 記憶として保存
        await memoryManager.saveImportantMemory(
          userId,
          memoryContent,
          memoryType,
          analysisData.keywords,
          analysisData.importance_score,
          emotionalWeight
        );

        console.log(`Memory saved for user ${userId}: ${memoryType}`);
      }
    } catch (error) {
      console.error('Error processing memory storage:', error);
    }
  }

  shouldSaveAsMemory(analysisData) {
    // 重要度スコア7以上は必ず保存
    if (analysisData.importance_score >= 7) {
      return true;
    }

    // 感情的に強い内容は保存
    if (analysisData.emotion_detected && 
        ['joy', 'sadness', 'anger', 'love', 'gratitude'].includes(analysisData.emotion_detected)) {
      return true;
    }

    // 質問や相談は保存
    if (analysisData.user_message.match(/質問|聞きたい|教えて|相談|悩み|困った/gi)) {
      return true;
    }

    // 個人的な情報は保存
    if (analysisData.user_message.match(/私は|僕は|自分は|好き|嫌い|趣味|仕事|学校/gi)) {
      return true;
    }

    return false;
  }

  determineMemoryType(analysisData) {
    const message = analysisData.user_message;

    // 個人的な特徴や性格
    if (message.match(/私は|僕は|自分は.*な人|性格|特徴/gi)) {
      return 'trait';
    }

    // 好みや嗜好
    if (message.match(/好き|嫌い|苦手|得意|趣味|興味/gi)) {
      return 'preference';
    }

    // 重要な出来事
    if (analysisData.importance_score >= 8) {
      return 'important_event';
    }

    // 事実や情報
    if (message.match(/です|である|ます|だった|でした/gi)) {
      return 'fact';
    }

    return 'important_event';
  }

  generateMemoryContent(userMessage, botResponse, analysisData) {
    const timestamp = new Date().toLocaleDateString('ja-JP');
    let content = `[${timestamp}] `;

    // 感情やトーンの情報を含める
    if (analysisData.emotion_detected && analysisData.emotion_detected !== 'neutral') {
      content += `【${analysisData.emotion_detected}】`;
    }

    // メッセージの要約（長い場合）
    if (userMessage.length > 200) {
      content += userMessage.substring(0, 200) + '...';
    } else {
      content += userMessage;
    }

    // 文脈情報があれば追加
    if (analysisData.topic_category && analysisData.topic_category !== 'general') {
      content += ` (カテゴリ: ${analysisData.topic_category})`;
    }

    return content;
  }

  calculateEmotionalWeight(analysisData) {
    let weight = 0;

    // 感情に基づく重み
    const emotionWeights = {
      'joy': 5,
      'love': 7,
      'gratitude': 6,
      'excitement': 4,
      'sadness': -4,
      'anger': -6,
      'fear': -5,
      'surprise': 2
    };

    if (analysisData.emotion_detected && emotionWeights[analysisData.emotion_detected]) {
      weight += emotionWeights[analysisData.emotion_detected];
    }

    // センチメントに基づく重み
    if (analysisData.sentiment === 'positive') {
      weight += 2;
    } else if (analysisData.sentiment === 'negative') {
      weight -= 2;
    }

    return Math.max(-10, Math.min(10, weight));
  }

  async getPersonalitySnapshot(userId) {
    try {
      const [emotion, recentMemories, userProfile, recentAnalysis] = await Promise.all([
        emotionManager.getCurrentEmotion(userId),
        memoryManager.getRelevantMemories(userId, '', 5),
        memoryManager.buildUserProfile(userId),
        conversationAnalyzer.getRecentAnalysis(userId, 5)
      ]);

      return {
        userId,
        emotion: {
          energy: emotion.energy_level,
          intimacy: emotion.intimacy_level,
          interest: emotion.interest_level,
          mood: emotion.mood_type,
          conversationCount: emotion.conversation_count,
          description: emotionManager.getEmotionDescription(emotion)
        },
        recentMemories: recentMemories.map(m => ({
          type: m.memory_type,
          content: m.content.substring(0, 100),
          importance: m.importance_score,
          created: m.created_at
        })),
        profile: {
          summary: userProfile.summary,
          topTraits: userProfile.traits.slice(0, 3),
          topInterests: userProfile.interests.slice(0, 5),
          emotionalTendencies: userProfile.emotionalTendencies
        },
        recentActivity: recentAnalysis.map(a => ({
          sentiment: a.sentiment,
          emotion: a.emotion_detected,
          topic: a.topic_category,
          importance: a.importance_score,
          analyzed: a.analyzed_at
        })),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting personality snapshot:', error);
      return null;
    }
  }

  // システム制御メソッド
  enable() {
    this.isEnabled = true;
    console.log('Personality system enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('Personality system disabled');
  }

  isSystemEnabled() {
    return this.isEnabled;
  }

  // キャッシュクリア
  clearUserCache(userId) {
    emotionManager.clearCache(userId);
    memoryManager.clearUserCache(userId);
    dynamicPromptGenerator.clearCache(userId);
    this.processingQueue.delete(userId);
  }

  clearAllCache() {
    emotionManager.clearCache();
    memoryManager.clearCache();
    dynamicPromptGenerator.clearCache();
    this.processingQueue.clear();
  }

  // 統計情報取得
  async getSystemStats() {
    try {
      const { Pool } = require('pg');
      const pgPool = new Pool({
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        database: process.env.POSTGRES_DB || 'aimolt',
      });

      const [emotionsResult, memoriesResult, analysisResult] = await Promise.all([
        pgPool.query('SELECT COUNT(*) as count FROM emotion_states'),
        pgPool.query('SELECT COUNT(*) as count FROM user_memories'),
        pgPool.query('SELECT COUNT(*) as count FROM conversation_analysis')
      ]);

      return {
        totalUsers: parseInt(emotionsResult.rows[0].count),
        totalMemories: parseInt(memoriesResult.rows[0].count),
        totalAnalyses: parseInt(analysisResult.rows[0].count),
        systemEnabled: this.isEnabled,
        activeProcessing: this.processingQueue.size
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return null;
    }
  }

  // デバッグ用メソッド
  async debugUser(userId) {
    try {
      const snapshot = await this.getPersonalitySnapshot(userId);
      const debugInfo = await dynamicPromptGenerator.debugGenerateModifiers(userId, {
        message: 'テストメッセージ',
        includeProfile: true
      });

      return {
        snapshot,
        debugInfo,
        cacheStatus: {
          emotionCached: emotionManager.emotionCache.has(userId),
          memoryCached: Array.from(memoryManager.memoryCache.keys()).filter(k => k.startsWith(userId + '_')).length,
          generatorCached: Array.from(dynamicPromptGenerator.modifierCache.keys()).filter(k => k.startsWith(userId + '_')).length
        }
      };
    } catch (error) {
      console.error('Error in debug mode:', error);
      return null;
    }
  }
}

// シングルトンインスタンス
const personalityManager = new PersonalityManager();

module.exports = {
  PersonalityManager,
  personalityManager
};