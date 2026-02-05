const { supabase } = require('../utils/supabase');

class MemoryManager {
  constructor() {
    this.memoryCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10分キャッシュ
    this.maxMemoriesPerUser = 100;
  }

  async saveImportantMemory(userId, content, type = 'important_event', keywords = [], importanceScore = 5, emotionalWeight = 0) {
    try {
      const memory = {
        user_id: userId,
        memory_type: type,
        content: content.substring(0, 1000), // 長すぎる場合は切り詰め
        keywords: keywords.length > 0 ? keywords : this.extractKeywords(content),
        importance_score: Math.max(1, Math.min(10, importanceScore)),
        emotional_weight: Math.max(-10, Math.min(10, emotionalWeight))
      };

      const { data, error } = await supabase
        .from('user_memories')
        .insert([memory])
        .select()
        .single();

      if (error) throw error;

      this.clearUserCache(userId);
      await this.cleanupOldMemories(userId);

      return data;
    } catch (error) {
      console.error('Error saving memory:', error);
      return null;
    }
  }

  async getRelevantMemories(userId, context = '', limit = 5) {
    try {
      const cacheKey = `${userId}_${context.substring(0, 50)}`;
      const cached = this.memoryCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.memories;
      }

      let memories;
      if (context) {
        memories = await this.searchMemoriesWithContext(userId, context, limit);
      } else {
        memories = await this.getRecentImportantMemories(userId, limit);
      }

      // 非同期でアクセス情報を更新（エラーは無視）
      this.updateAccessCounts(memories.map(m => m.id)).catch(err => console.error(err));

      this.memoryCache.set(cacheKey, {
        memories,
        timestamp: Date.now()
      });

      return memories;
    } catch (error) {
      console.error('Error getting relevant memories:', error);
      return [];
    }
  }

  async searchMemoriesWithContext(userId, context, limit) {
    const contextKeywords = this.extractKeywords(context);

    if (contextKeywords.length === 0) {
      return await this.getRecentImportantMemories(userId, limit);
    }

    // クライアント側でフィルタリングとソートを行うため、有効なメモリを全取得
    const { data: allMemories, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .is('expires_at', null); // 期限切れでないもの（単純化のためNULLのみチェック） 
    // Note: expires_at > NOW のような比較はAPIでも可能だが、expires_atが設定されているケースが少ないならこれで十分

    if (error || !allMemories) return [];

    // スコアリングとソート
    const scoredMemories = allMemories.map(memory => {
      let matchCount = 0;
      if (memory.keywords) {
        matchCount = memory.keywords.filter(k => contextKeywords.includes(k)).length;
      }
      return { ...memory, matchCount };
    });

    return scoredMemories
      .sort((a, b) => {
        if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
        if (b.importance_score !== a.importance_score) return b.importance_score - a.importance_score;
        return new Date(b.last_accessed) - new Date(a.last_accessed);
      })
      .slice(0, limit);
  }

  async getRecentImportantMemories(userId, limit) {
    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance_score', { ascending: false })
      .order('last_accessed', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting recent important memories:', error);
      return [];
    }
    return data;
  }

  async buildUserProfile(userId) {
    try {
      const memories = await this.getAllUserMemories(userId);

      const profile = {
        userId: userId,
        traits: this.extractTraits(memories),
        preferences: this.extractPreferences(memories),
        interests: this.extractInterests(memories),
        emotionalTendencies: this.analyzeEmotionalTendencies(memories),
        conversationStyle: this.analyzeConversationStyle(memories),
        summary: ''
      };

      profile.summary = this.generateProfileSummary(profile);

      return profile;
    } catch (error) {
      console.error('Error building user profile:', error);
      return this.getDefaultProfile(userId);
    }
  }

  async getAllUserMemories(userId) {
    const { data, error } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', userId)
      .order('importance_score', { ascending: false });

    if (error) {
      console.error('Error getting all user memories:', error);
      return [];
    }
    // expires_at のチェックはJS側で行う（Supabaseのfilterだと複雑なOR条件が面倒なため）
    const now = new Date();
    return data.filter(m => !m.expires_at || new Date(m.expires_at) > now);
  }

  extractTraits(memories) {
    const traits = [];
    const traitPatterns = {
      'friendly': /友好的|優しい|親切|フレンドリー|明るい/gi,
      'curious': /好奇心|興味|質問|学習|知りたい/gi,
      'creative': /創造的|アイデア|作る|デザイン|芸術/gi,
      'analytical': /分析|論理|データ|考察|理論/gi,
      'humorous': /面白い|ジョーク|笑い|ユーモア|冗談/gi,
      'serious': /真面目|真剣|集中|責任|丁寧/gi,
      'adventurous': /冒険|挑戦|新しい|リスク|探検/gi,
      'patient': /忍耐|待つ|ゆっくり|丁寧|慎重/gi
    };

    memories.forEach(memory => {
      Object.entries(traitPatterns).forEach(([trait, pattern]) => {
        if (memory.content.match(pattern)) {
          traits.push({
            trait,
            strength: memory.importance_score,
            source: memory.content.substring(0, 100)
          });
        }
      });
    });

    return this.consolidateTraits(traits);
  }

  extractPreferences(memories) {
    const preferences = [];
    const preferencePatterns = {
      'communication_style': /話し方|コミュニケーション|伝え方/gi,
      'topics': /話題|テーマ|興味|好き|嫌い/gi,
      'response_style': /返事|応答|反応|レスポンス/gi,
      'humor_level': /冗談|ユーモア|真面目|軽い|重い/gi
    };

    memories.forEach(memory => {
      Object.entries(preferencePatterns).forEach(([preference, pattern]) => {
        if (memory.content.match(pattern)) {
          preferences.push({
            category: preference,
            description: memory.content.substring(0, 150),
            importance: memory.importance_score
          });
        }
      });
    });

    return preferences;
  }

  extractInterests(memories) {
    const interests = new Map();

    memories.forEach(memory => {
      memory.keywords.forEach(keyword => {
        if (keyword.length >= 3) {
          const current = interests.get(keyword) || { count: 0, totalImportance: 0 };
          current.count++;
          current.totalImportance += memory.importance_score;
          interests.set(keyword, current);
        }
      });
    });

    return Array.from(interests.entries())
      .map(([keyword, data]) => ({
        topic: keyword,
        frequency: data.count,
        averageImportance: data.totalImportance / data.count
      }))
      .sort((a, b) => (b.frequency * b.averageImportance) - (a.frequency * a.averageImportance))
      .slice(0, 20);
  }

  analyzeEmotionalTendencies(memories) {
    const emotionalData = {
      averageWeight: 0,
      positiveRatio: 0,
      negativeRatio: 0,
      neutralRatio: 0
    };

    if (memories.length === 0) return emotionalData;

    const totalWeight = memories.reduce((sum, m) => sum + m.emotional_weight, 0);
    emotionalData.averageWeight = totalWeight / memories.length;

    const positive = memories.filter(m => m.emotional_weight > 2).length;
    const negative = memories.filter(m => m.emotional_weight < -2).length;
    const neutral = memories.length - positive - negative;

    emotionalData.positiveRatio = positive / memories.length;
    emotionalData.negativeRatio = negative / memories.length;
    emotionalData.neutralRatio = neutral / memories.length;

    return emotionalData;
  }

  analyzeConversationStyle(memories) {
    return {
      averageResponseLength: this.calculateAverageResponseLength(memories),
      formalityLevel: this.assessFormalityLevel(memories),
      questionFrequency: this.calculateQuestionFrequency(memories),
      emotionExpression: this.assessEmotionExpression(memories)
    };
  }

  generateProfileSummary(profile) {
    const topTraits = profile.traits.slice(0, 3).map(t => t.trait).join('、');
    const topInterests = profile.interests.slice(0, 3).map(i => i.topic).join('、');

    let summary = `このユーザーは${topTraits}な性格的特徴を持ち、`;
    summary += `${topInterests}などに興味を示しています。`;

    if (profile.emotionalTendencies.positiveRatio > 0.6) {
      summary += '一般的にポジティブな傾向があります。';
    } else if (profile.emotionalTendencies.negativeRatio > 0.4) {
      summary += 'やや慎重で感情的な深さを持っています。';
    }

    return summary;
  }

  async updateMemory(memoryId, updates) {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = [memoryId, ...Object.values(updates)];

      const result = await pgPool.query(
        `UPDATE user_memories 
         SET ${setClause}, last_accessed = NOW()
         WHERE id = $1 
         RETURNING *`,
        values
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating memory:', error);
      return null;
    }
  }

  async updateAccessCounts(memoryIds) {
    if (memoryIds.length === 0) return;

    try {
      await pgPool.query(
        `UPDATE user_memories 
         SET access_count = access_count + 1, last_accessed = NOW()
         WHERE id = ANY($1)`,
        [memoryIds]
      );
    } catch (error) {
      console.error('Error updating access counts:', error);
    }
  }

  async cleanupOldMemories(userId) {
    try {
      const countResult = await pgPool.query(
        'SELECT COUNT(*) FROM user_memories WHERE user_id = $1',
        [userId]
      );

      const memoryCount = parseInt(countResult.rows[0].count);

      if (memoryCount > this.maxMemoriesPerUser) {
        const excessCount = memoryCount - this.maxMemoriesPerUser;
        await pgPool.query(
          `DELETE FROM user_memories 
           WHERE id IN (
             SELECT id FROM user_memories 
             WHERE user_id = $1 
             ORDER BY importance_score ASC, last_accessed ASC 
             LIMIT $2
           )`,
          [userId, excessCount]
        );
      }

      await pgPool.query(
        'DELETE FROM user_memories WHERE expires_at IS NOT NULL AND expires_at < NOW()'
      );
    } catch (error) {
      console.error('Error cleaning up old memories:', error);
    }
  }

  extractKeywords(text) {
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const stopWords = new Set([
      'は', 'が', 'を', 'に', 'で', 'と', 'の', 'だ', 'である', 'です', 'ます',
      'した', 'して', 'ある', 'いる', 'なる', 'する', 'この', 'その', 'あの'
    ]);

    return words
      .filter(word => word.length >= 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 10);
  }

  consolidateTraits(traits) {
    const consolidated = new Map();

    traits.forEach(trait => {
      const existing = consolidated.get(trait.trait) || {
        trait: trait.trait,
        totalStrength: 0,
        count: 0,
        sources: []
      };

      existing.totalStrength += trait.strength;
      existing.count++;
      existing.sources.push(trait.source);
      consolidated.set(trait.trait, existing);
    });

    return Array.from(consolidated.values())
      .map(item => ({
        trait: item.trait,
        strength: item.totalStrength / item.count,
        frequency: item.count,
        examples: item.sources.slice(0, 3)
      }))
      .sort((a, b) => (b.strength * b.frequency) - (a.strength * a.frequency))
      .slice(0, 10);
  }

  calculateAverageResponseLength(memories) {
    if (memories.length === 0) return 0;
    const totalLength = memories.reduce((sum, m) => sum + m.content.length, 0);
    return Math.round(totalLength / memories.length);
  }

  assessFormalityLevel(memories) {
    return 'casual'; // 簡略化実装
  }

  calculateQuestionFrequency(memories) {
    const questionMemories = memories.filter(m =>
      m.content.match(/？|\?|どう|なぜ|なん|教えて|聞きたい/g)
    );
    return memories.length > 0 ? questionMemories.length / memories.length : 0;
  }

  assessEmotionExpression(memories) {
    return 'moderate'; // 簡略化実装
  }

  getDefaultProfile(userId) {
    return {
      userId,
      traits: [],
      preferences: [],
      interests: [],
      emotionalTendencies: {
        averageWeight: 0,
        positiveRatio: 0.5,
        negativeRatio: 0.2,
        neutralRatio: 0.3
      },
      conversationStyle: {
        averageResponseLength: 50,
        formalityLevel: 'casual',
        questionFrequency: 0.2,
        emotionExpression: 'moderate'
      },
      summary: '新しいユーザーです。まだ十分な情報が蓄積されていません。'
    };
  }

  clearUserCache(userId) {
    const keysToDelete = [];
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(userId + '_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.memoryCache.delete(key));
  }

  clearCache() {
    this.memoryCache.clear();
  }
}

const memoryManager = new MemoryManager();

module.exports = {
  MemoryManager,
  memoryManager
};