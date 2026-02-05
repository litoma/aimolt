const { supabase } = require('../utils/supabase');

class RelationshipManager {
  constructor() {
    this.relationshipCache = new Map();
    this.cacheTimeout = 15 * 60 * 1000; // 15分キャッシュ
  }

  async getRelationship(userId) {
    try {
      const cached = this.relationshipCache.get(userId);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.relationship;
      }

      let relationship = await this.loadFromDatabase(userId);
      if (!relationship) {
        relationship = await this.createInitialRelationship(userId);
      }

      this.relationshipCache.set(userId, {
        relationship,
        timestamp: Date.now()
      });

      return relationship;
    } catch (error) {
      console.error('Error getting relationship:', error);
      return this.getDefaultRelationship(userId);
    }
  }

  async loadFromDatabase(userId) {
    const { data, error } = await supabase
      .from('user_relationships')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createInitialRelationship(userId) {
    try {
      const defaultRelationship = {
        user_id: userId,
        affection_level: 50,
        trust_level: 50,
        respect_level: 70,
        comfort_level: 40,
        relationship_stage: 'stranger',
        conversation_count: 0,
        meaningful_interactions: 0,
        preferred_formality: 'casual',
        communication_pace: 'normal',
        humor_receptivity: 50,
        known_interests: [],
        avoided_topics: [],
        positive_triggers: [],
        negative_triggers: []
      };

      const { data, error } = await supabase
        .from('user_relationships')
        .insert([defaultRelationship])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating initial relationship:', error);
      return this.getDefaultRelationship(userId);
    }
  }

  async updateRelationship(userId, conversationData, analysisData, vadData = null) {
    try {
      const relationship = await this.getRelationship(userId);
      const updates = this.calculateRelationshipChanges(relationship, conversationData, analysisData, vadData);

      if (Object.keys(updates).length > 0) {
        await this.saveRelationshipChanges(userId, updates);
        await this.logRelationshipHistory(userId, updates, conversationData.userMessage);
        this.relationshipCache.delete(userId); // キャッシュ無効化
      }

      return updates;
    } catch (error) {
      console.error('Error updating relationship:', error);
      return {};
    }
  }

  // ... calculation methods kept as is ...

  calculateRelationshipChanges(relationship, conversationData, analysisData, vadData) {
    const updates = {};

    // 好感度の変化
    const affectionChange = this.calculateAffectionChange(analysisData, conversationData, vadData);
    if (affectionChange !== 0) {
      updates.affection_level = Math.max(0, Math.min(100,
        relationship.affection_level + affectionChange));
    }

    // 信頼度の変化
    const trustChange = this.calculateTrustChange(analysisData, conversationData, vadData);
    if (trustChange !== 0) {
      updates.trust_level = Math.max(0, Math.min(100,
        relationship.trust_level + trustChange));
    }

    // 親しみやすさの変化
    const comfortChange = this.calculateComfortChange(analysisData, relationship, vadData);
    if (comfortChange !== 0) {
      updates.comfort_level = Math.max(0, Math.min(100,
        relationship.comfort_level + comfortChange));
    }

    // 興味・関心の更新
    const interestUpdates = this.updateKnownInterests(conversationData.userMessage, relationship);
    if (interestUpdates.known_interests) {
      updates.known_interests = interestUpdates.known_interests;
    }
    if (interestUpdates.positive_triggers) {
      updates.positive_triggers = interestUpdates.positive_triggers;
    }

    // 敬語レベルの分析
    const formalityLevel = this.assessFormalityLevel(conversationData.userMessage);
    if (formalityLevel !== relationship.preferred_formality) {
      updates.preferred_formality = formalityLevel;
    }

    // 関係性段階の変化
    const newStage = this.determineRelationshipStage(
      updates.affection_level || relationship.affection_level,
      updates.trust_level || relationship.trust_level,
      updates.comfort_level || relationship.comfort_level,
      relationship.conversation_count + 1
    );

    if (newStage !== relationship.relationship_stage) {
      updates.relationship_stage = newStage;
    }

    // カウンターの更新
    updates.conversation_count = relationship.conversation_count + 1;

    if (analysisData.importance_score >= 7) {
      updates.meaningful_interactions = relationship.meaningful_interactions + 1;
    }

    updates.last_interaction = new Date();

    return updates;
  }

  calculateAffectionChange(analysisData, conversationData, vadData) {
    let change = 0;

    // VADベースの判定
    if (vadData) {
      if (vadData.valence > 60) change += 2;
      if (vadData.valence < 40) change -= 1;
    } else {
      // フォールバック：従来の感情分析
      if (analysisData.sentiment === 'positive') change += 2;
      if (analysisData.sentiment === 'negative') change -= 1;
    }

    // 感謝表現は大きく好感度上昇
    if (analysisData.emotion_detected === 'gratitude') {
      change += 5;
    }

    // 質問や相談は信頼の表れ
    if (conversationData.userMessage.match(/質問|相談|聞きたい|教えて/gi)) {
      change += 3;
    }

    // 長期間の沈黙後の復帰は好感度微減
    const daysSinceLastInteraction = this.getDaysSinceLastInteraction(conversationData.userId);
    if (daysSinceLastInteraction > 7) {
      change -= 2;
    }

    return Math.max(-10, Math.min(10, change));
  }

  calculateTrustChange(analysisData, conversationData, vadData) {
    let change = 0;

    // 個人的な情報の共有は信頼度上昇
    if (conversationData.userMessage.match(/実は|本当は|秘密|相談|悩み/gi)) {
      change += 4;
    }

    // 一貫した肯定的な交流
    const isPositive = vadData ? (vadData.valence > 60) : (analysisData.sentiment === 'positive');
    if (isPositive && analysisData.importance_score >= 6) {
      change += 2;
    }

    // ネガティブな体験の共有も信頼の表れ
    if (analysisData.emotion_detected === 'sadness' && analysisData.importance_score >= 7) {
      change += 3;
    }

    return Math.max(-5, Math.min(8, change));
  }

  calculateComfortChange(analysisData, relationship, vadData) {
    let change = 0;

    // 会話回数に応じた自然な親近感の増加
    if (relationship.conversation_count > 5) {
      change += 1;
    }

    // ユーモアがある交流
    if (analysisData.emotion_detected === 'joy' ||
      analysisData.user_message.match(/笑|www|ｗ|面白い/gi)) {
      change += 2;
    }

    // VADベースの快適さ判定
    if (vadData && vadData.valence > 70 && vadData.arousal > 50 && vadData.arousal < 80) {
      change += 1; // 適度に楽しい状態
    }

    return Math.max(-3, Math.min(5, change));
  }

  updateKnownInterests(message, relationship) {
    const updates = {};

    // 興味・関心の抽出
    const interestPatterns = /好き.*|趣味.*|興味.*|愛用.*|お気に入り.*/gi;
    const interests = message.match(interestPatterns);

    if (interests) {
      const currentInterests = new Set(relationship.known_interests || []);
      interests.forEach(interest => {
        const cleanInterest = interest.substring(0, 50).trim();
        if (cleanInterest.length > 3) {
          currentInterests.add(cleanInterest);
        }
      });

      if (currentInterests.size > (relationship.known_interests || []).length) {
        updates.known_interests = Array.from(currentInterests).slice(0, 20); // 最大20個
      }
    }

    // ポジティブトリガーの抽出（ポジティブな反応を引き出すキーワード）
    if (message.match(/ありがと|嬉しい|助かる|素晴らしい|最高/gi)) {
      const currentTriggers = new Set(relationship.positive_triggers || []);
      const words = message.match(/\w+/g) || [];
      words.slice(0, 3).forEach(word => {
        if (word.length >= 2) {
          currentTriggers.add(word);
        }
      });

      if (currentTriggers.size > (relationship.positive_triggers || []).length) {
        updates.positive_triggers = Array.from(currentTriggers).slice(0, 15); // 最大15個
      }
    }

    return updates;
  }

  assessFormalityLevel(message) {
    const formalPatterns = /です|ます|である|いたします|いただき|お疲れ様|失礼/gi;
    const casualPatterns = /だよ|だね|〜じゃん|〜かな|ちょっと|なんか/gi;

    const formalCount = (message.match(formalPatterns) || []).length;
    const casualCount = (message.match(casualPatterns) || []).length;

    if (formalCount > casualCount + 1) return 'formal';
    if (casualCount > formalCount + 1) return 'casual';
    return 'polite';
  }

  determineRelationshipStage(affection, trust, comfort, conversationCount) {
    if (affection >= 80 && trust >= 75 && comfort >= 70) {
      return 'close_friend';
    } else if (affection >= 60 && trust >= 55 && conversationCount >= 10) {
      return 'friend';
    } else if (affection >= 40 || conversationCount >= 5) {
      return 'acquaintance';
    } else {
      return 'stranger';
    }
  }

  async saveRelationshipChanges(userId, updates) {
    const { error } = await supabase
      .from('user_relationships')
      .update({ ...updates, updated_at: new Date() })
      .eq('user_id', userId);

    if (error) throw error;
  }

  async logRelationshipHistory(userId, updates, triggerMessage) {
    try {
      const events = [];
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'conversation_count' || key === 'last_interaction') continue;

        events.push({
          user_id: userId,
          event_type: `${key}_change`,
          new_value: value.toString(),
          trigger_message: triggerMessage.substring(0, 200)
        });
      }

      if (events.length > 0) {
        const { error } = await supabase
          .from('relationship_history')
          .insert(events);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error logging relationship history:', error);
    }
  }

  getDaysSinceLastInteraction(userId) {
    // 簡易実装：実際には最後のインタラクション時刻から計算
    return 0;
  }

  getDefaultRelationship(userId) {
    return {
      user_id: userId,
      affection_level: 50,
      trust_level: 50,
      respect_level: 70,
      comfort_level: 40,
      relationship_stage: 'stranger',
      conversation_count: 0,
      meaningful_interactions: 0,
      preferred_formality: 'casual',
      communication_pace: 'normal',
      humor_receptivity: 50,
      known_interests: [],
      avoided_topics: [],
      positive_triggers: [],
      negative_triggers: [],
      first_interaction: new Date(),
      last_interaction: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // 応答スタイル調整のためのメソッド
  getResponseStyle(relationship) {
    const styles = {
      stranger: {
        formality: 0.8,      // 丁寧語
        enthusiasm: 0.6,     // 控えめ
        personalInfo: 0.2,   // 個人的な話は控えめ
        humor: 0.4          // ユーモア控えめ
      },
      acquaintance: {
        formality: 0.6,
        enthusiasm: 0.7,
        personalInfo: 0.5,
        humor: 0.6
      },
      friend: {
        formality: 0.4,
        enthusiasm: 0.8,
        personalInfo: 0.8,
        humor: 0.8
      },
      close_friend: {
        formality: 0.2,      // カジュアル
        enthusiasm: 0.9,     // 積極的
        personalInfo: 0.9,   // 個人的な話もOK
        humor: 0.9          // ユーモア豊富
      }
    };

    return styles[relationship.relationship_stage] || styles.stranger;
  }

  async getRelationshipStats(userId) {
    try {
      const relationship = await this.getRelationship(userId);
      return {
        affection: relationship.affection_level,
        trust: relationship.trust_level,
        respect: relationship.respect_level,
        comfort: relationship.comfort_level,
        stage: relationship.relationship_stage,
        conversationCount: relationship.conversation_count,
        meaningfulInteractions: relationship.meaningful_interactions,
        formality: relationship.preferred_formality,
        knownInterests: relationship.known_interests,
        positiveTrigers: relationship.positive_triggers
      };
    } catch (error) {
      console.error('Error getting relationship stats:', error);
      return null;
    }
  }

  clearCache(userId = null) {
    if (userId) {
      this.relationshipCache.delete(userId);
    } else {
      this.relationshipCache.clear();
    }
  }
}

const relationshipManager = new RelationshipManager();

module.exports = {
  RelationshipManager,
  relationshipManager
};