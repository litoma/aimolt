const { vadEmotionManager } = require('./vad-emotion');
const { relationshipManager } = require('./relationship-manager');
const { corePersonality } = require('./core-personality');
const { adaptiveResponseEngine } = require('./adaptive-response');

class PersonalityManagerV2 {
  constructor() {
    this.isEnabled = true;
    this.processingQueue = new Map(); // ユーザーごとの処理キュー
    this.systemVersion = 'v2.0';
  }

  // メイン機能：個人化されたプロンプト生成
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

      // VAD分析データがない場合は生成
      let analysis = analysisData;
      let vadData = null;

      if (!analysis && message) {
        // 簡易VAD分析を実行
        vadData = vadEmotionManager.calculateVAD(message);
        analysis = {
          user_message: message,
          sentiment: vadData.valence > 60 ? 'positive' : (vadData.valence < 40 ? 'negative' : 'neutral'),
          emotion_detected: vadEmotionManager.mapVADToEmotion(vadData),
          importance_score: this.calculateQuickImportanceScore(message),
          keywords: this.extractQuickKeywords(message)
        };
      } else if (analysis && !vadData) {
        vadData = vadEmotionManager.calculateVAD(analysis.user_message || message);
      }

      // 適応的プロンプト生成
      const context = {
        type: reactionType ? 'reaction' : 'conversation',
        reactionType,
        message,
        analysisData: analysis,
        includeProfile,
        vadData
      };

      const personalizedPrompt = await adaptiveResponseEngine.generateAdaptivePrompt(
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

  // メイン機能：会話から人格状態の更新
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
        // 1. VAD分析
        const vadData = vadEmotionManager.calculateVAD(userMessage);

        // 2. 分析データ生成
        const analysisData = {
          user_message: userMessage,
          sentiment: vadData.valence > 60 ? 'positive' : (vadData.valence < 40 ? 'negative' : 'neutral'),
          emotion_detected: vadEmotionManager.mapVADToEmotion(vadData),
          importance_score: this.calculateQuickImportanceScore(userMessage),
          keywords: this.extractQuickKeywords(userMessage)
        };

        // 3. 並行してシステム更新
        await Promise.all([
          // VAD感情状態更新
          vadEmotionManager.updateEmotion(userId, analysisData, vadData),

          // 関係性更新
          relationshipManager.updateRelationship(userId, {
            userMessage,
            botResponse,
            userId
          }, analysisData, vadData)
        ]);

        console.log(`Personality v2.0 updated for user ${userId} (VAD: ${vadData.valence}/${vadData.arousal}/${vadData.dominance})`);
      } finally {
        this.processingQueue.delete(userId);
      }
    } catch (error) {
      console.error('Error updating personality v2:', error);
      this.processingQueue.delete(userId);
    }
  }

  // 包括的な人格スナップショット生成
  async getPersonalitySnapshot(userId) {
    try {
      const [emotion, relationship, coreTraits, responseStyle] = await Promise.all([
        vadEmotionManager.getCurrentEmotion(userId),
        relationshipManager.getRelationship(userId),
        corePersonality.getTraits(),
        adaptiveResponseEngine.calculateResponseStyle(
          await relationshipManager.getRelationship(userId),
          await vadEmotionManager.getCurrentEmotion(userId),
          await corePersonality.getTraits(),
          {}
        )
      ]);

      return {
        userId,
        systemVersion: this.systemVersion,

        // VAD感情状態
        emotion: {
          valence: emotion.valence || 50,
          arousal: emotion.arousal || 50,
          dominance: emotion.dominance || 50,
          vadEmotion: vadEmotionManager.mapVADToEmotion({
            valence: emotion.valence || 50,
            arousal: emotion.arousal || 50,
            dominance: emotion.dominance || 50
          }),

          // 後方互換性
          energy: emotion.energy_level,
          intimacy: emotion.intimacy_level,
          interest: emotion.interest_level,
          mood: emotion.mood_type,
          conversationCount: emotion.conversation_count,
          description: vadEmotionManager.getEmotionDescription(emotion)
        },

        // 関係性情報
        relationship: {
          stage: relationship.relationship_stage,
          affection: relationship.affection_level,
          trust: relationship.trust_level,
          comfort: relationship.comfort_level,
          conversationCount: relationship.conversation_count,
          meaningfulInteractions: relationship.meaningful_interactions,
          formality: relationship.preferred_formality,
          knownInterests: relationship.known_interests,
          positiveTrigers: relationship.positive_triggers
        },

        // コア人格特性
        corePersonality: {
          openness: coreTraits.openness,
          conscientiousness: coreTraits.conscientiousness,
          extraversion: coreTraits.extraversion,
          agreeableness: coreTraits.agreeableness,
          neuroticism: coreTraits.neuroticism,
          humor_level: coreTraits.humor_level,
          curiosity: coreTraits.curiosity,
          supportiveness: coreTraits.supportiveness
        },

        // 現在の応答スタイル
        currentResponseStyle: responseStyle,

        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Error getting personality snapshot v2:', error);
      return null;
    }
  }

  // システム統計情報
  async getSystemStats() {
    try {
      const { supabase } = require('../utils/supabase');

      const { count: emotionsCount, error: emotionsError } = await supabase
        .from('emotion_states')
        .select('*', { count: 'exact', head: true });

      const { count: relationshipsCount, error: relationshipsError } = await supabase
        .from('user_relationships')
        .select('*', { count: 'exact', head: true });

      const { count: conversationsCount, error: conversationsError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      // Supabase JSクライアントでは複雑なGROUP BYを直接行いにくいため、
      // 必要なカラムだけ取得してJS側で集計する（データ量が多い場合はRPCを検討すべき）
      const { data: relationshipData } = await supabase
        .from('user_relationships')
        .select('relationship_stage');

      const relationshipDistributionMap = {};
      if (relationshipData) {
        relationshipData.forEach(item => {
          relationshipDistributionMap[item.relationship_stage] = (relationshipDistributionMap[item.relationship_stage] || 0) + 1;
        });
      }

      const relationshipDistribution = Object.entries(relationshipDistributionMap)
        .map(([stage, count]) => ({ relationship_stage: stage, count }))
        .sort((a, b) => b.count - a.count);

      const { data: vadData } = await supabase
        .from('emotion_states')
        .select('valence, arousal, dominance')
        .not('valence', 'is', null);

      let vadAverages = { avg_valence: 50, avg_arousal: 50, avg_dominance: 50 };
      if (vadData && vadData.length > 0) {
        const sum = vadData.reduce((acc, curr) => ({
          valence: acc.valence + (curr.valence || 0),
          arousal: acc.arousal + (curr.arousal || 0),
          dominance: acc.dominance + (curr.dominance || 0)
        }), { valence: 0, arousal: 0, dominance: 0 });

        vadAverages = {
          avg_valence: Math.round(sum.valence / vadData.length),
          avg_arousal: Math.round(sum.arousal / vadData.length),
          avg_dominance: Math.round(sum.dominance / vadData.length)
        };
      }

      if (emotionsError) console.error('Emotions count error:', emotionsError);

      return {
        systemVersion: this.systemVersion,
        totalUsers: emotionsCount || 0,
        totalRelationships: relationshipsCount || 0,
        totalConversations: conversationsCount || 0,
        systemEnabled: this.isEnabled,
        activeProcessing: this.processingQueue.size,

        relationshipDistribution: relationshipDistribution,
        vadAverages: vadAverages,

        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting system stats v2:', error);
      return null;
    }
  }

  // ユーティリティメソッド
  calculateQuickImportanceScore(message) {
    let score = 1;

    if (message.length > 100) score += 2;
    if (message.length > 200) score += 2;

    if (message.match(/質問|聞きたい|教えて|どうして|なぜ|わからない/gi)) score += 3;
    if (message.match(/ありがと|感謝|助かる|おかげ/gi)) score += 2;
    if (message.match(/悩み|相談|困った|辛い|悲しい/gi)) score += 4;
    if (message.match(/！|!|\?|？/g)) score += 1;
    if (message.match(/すごい|最高|素晴らしい|やばい|マジ/gi)) score += 2;

    return Math.min(score, 10);
  }

  extractQuickKeywords(message) {
    const text = message.toLowerCase();
    const stopWords = new Set([
      'は', 'が', 'を', 'に', 'で', 'と', 'の', 'だ', 'である', 'です', 'ます',
      'した', 'して', 'ある', 'いる', 'なる', 'する', 'この', 'その', 'あの',
      'それ', 'これ', 'あれ', 'どの', 'なに', 'なん', 'どこ', 'いつ', 'だれ'
    ]);

    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    return words
      .filter(word => word.length >= 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 5);
  }

  // システム制御メソッド
  enable() {
    this.isEnabled = true;
    console.log('Personality system v2.0 enabled');
  }

  disable() {
    this.isEnabled = false;
    console.log('Personality system v2.0 disabled');
  }

  isSystemEnabled() {
    return this.isEnabled;
  }

  // キャッシュクリア
  clearUserCache(userId) {
    vadEmotionManager.clearCache(userId);
    relationshipManager.clearCache(userId);
    adaptiveResponseEngine.clearCache(userId);
    this.processingQueue.delete(userId);
  }

  clearAllCache() {
    vadEmotionManager.clearCache();
    relationshipManager.clearCache();
    corePersonality.clearCache();
    adaptiveResponseEngine.clearCache();
    this.processingQueue.clear();
  }

  // デバッグ用メソッド
  async debugUser(userId) {
    try {
      const snapshot = await this.getPersonalitySnapshot(userId);
      const [emotion, relationship] = await Promise.all([
        vadEmotionManager.getCurrentEmotion(userId),
        relationshipManager.getRelationship(userId)
      ]);

      return {
        snapshot,
        rawData: {
          emotion,
          relationship
        },
        cacheStatus: {
          emotionCached: vadEmotionManager.emotionCache.has(userId),
          relationshipCached: relationshipManager.relationshipCache.has(userId),
          responseEngineCached: Array.from(adaptiveResponseEngine.responseCache.keys())
            .filter(k => k.startsWith(userId + '_')).length
        },
        systemInfo: {
          version: this.systemVersion,
          enabled: this.isEnabled,
          processingQueue: this.processingQueue.size
        }
      };
    } catch (error) {
      console.error('Error in debug mode v2:', error);
      return null;
    }
  }

  // 後方互換性のためのメソッド
  async getPersonalizedPromptLegacy(userId, basePrompt, context = {}) {
    // 旧システムとの互換性を保つ
    return await this.getPersonalizedPrompt(userId, basePrompt, context);
  }

  async updatePersonalityFromConversationLegacy(userId, userMessage, botResponse, messageId = null) {
    // 旧システムとの互換性を保つ
    return await this.updatePersonalityFromConversation(userId, userMessage, botResponse, messageId);
  }

  async getPersonalitySnapshotLegacy(userId) {
    // 旧システムとの互換性を保つ
    const snapshot = await this.getPersonalitySnapshot(userId);
    if (!snapshot) return null;

    // 旧形式に変換
    return {
      userId: snapshot.userId,
      emotion: {
        energy: snapshot.emotion.energy,
        intimacy: snapshot.emotion.intimacy,
        interest: snapshot.emotion.interest,
        mood: snapshot.emotion.mood,
        conversationCount: snapshot.emotion.conversationCount,
        description: snapshot.emotion.description
      },
      recentMemories: [], // v2では関係性データに統合
      profile: {
        summary: `VADモデルベースの人格システム v${this.systemVersion}`,
        topTraits: [
          { trait: 'openness', strength: snapshot.corePersonality.openness },
          { trait: 'extraversion', strength: snapshot.corePersonality.extraversion },
          { trait: 'agreeableness', strength: snapshot.corePersonality.agreeableness }
        ],
        topInterests: snapshot.relationship.knownInterests.slice(0, 5).map(interest => ({ topic: interest })),
        emotionalTendencies: {
          positiveRatio: snapshot.emotion.valence / 100,
          negativeRatio: (100 - snapshot.emotion.valence) / 100,
          neutralRatio: 0.3
        }
      },
      recentActivity: [],
      lastUpdated: snapshot.lastUpdated
    };
  }
}

// シングルトンインスタンス
const personalityManagerV2 = new PersonalityManagerV2();

module.exports = {
  PersonalityManagerV2,
  personalityManagerV2
};