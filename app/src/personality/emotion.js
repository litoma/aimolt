const { Pool } = require('pg');

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'aimolt',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

class EmotionManager {
  constructor() {
    this.emotionCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5分キャッシュ
  }

  async getCurrentEmotion(userId) {
    try {
      const cacheKey = userId;
      const cached = this.emotionCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.emotion;
      }

      const result = await pgPool.query(
        'SELECT * FROM emotion_states WHERE user_id = $1',
        [userId]
      );

      let emotion;
      if (result.rows.length === 0) {
        emotion = await this.createInitialEmotion(userId);
      } else {
        emotion = result.rows[0];
        emotion = await this.applyTimeDecay(emotion);
      }

      this.emotionCache.set(cacheKey, {
        emotion,
        timestamp: Date.now()
      });

      return emotion;
    } catch (error) {
      console.error('Error getting current emotion:', error);
      return this.getDefaultEmotion(userId);
    }
  }

  async createInitialEmotion(userId) {
    try {
      const defaultEmotion = {
        user_id: userId,
        energy_level: 50,
        intimacy_level: 0,
        interest_level: 50,
        mood_type: 'neutral',
        conversation_count: 0
      };

      const result = await pgPool.query(
        `INSERT INTO emotion_states 
         (user_id, energy_level, intimacy_level, interest_level, mood_type, conversation_count)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, defaultEmotion.energy_level, defaultEmotion.intimacy_level, 
         defaultEmotion.interest_level, defaultEmotion.mood_type, defaultEmotion.conversation_count]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating initial emotion:', error);
      return this.getDefaultEmotion(userId);
    }
  }

  async updateEmotion(userId, analysisData) {
    try {
      const currentEmotion = await this.getCurrentEmotion(userId);
      const newEmotion = this.calculateEmotionUpdate(currentEmotion, analysisData);

      const result = await pgPool.query(
        `UPDATE emotion_states 
         SET energy_level = $2, intimacy_level = $3, interest_level = $4, 
             mood_type = $5, conversation_count = conversation_count + 1, 
             last_interaction = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId, newEmotion.energy_level, newEmotion.intimacy_level, 
         newEmotion.interest_level, newEmotion.mood_type]
      );

      this.emotionCache.delete(userId);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating emotion:', error);
      return null;
    }
  }

  calculateEmotionUpdate(currentEmotion, analysisData) {
    const newEmotion = { ...currentEmotion };

    const sentimentImpact = this.getSentimentImpact(analysisData.sentiment);
    const emotionImpact = this.getEmotionImpact(analysisData.emotion_detected);

    newEmotion.energy_level = this.adjustValue(
      currentEmotion.energy_level, 
      sentimentImpact.energy + emotionImpact.energy, 
      0, 100
    );

    newEmotion.intimacy_level = this.adjustValue(
      currentEmotion.intimacy_level, 
      Math.min(2, analysisData.importance_score / 5), // 重要な会話ほど親密度上昇
      0, 100
    );

    newEmotion.interest_level = this.adjustValue(
      currentEmotion.interest_level, 
      sentimentImpact.interest + (analysisData.importance_score - 5), 
      0, 100
    );

    newEmotion.mood_type = this.determineMoodType(newEmotion, analysisData);

    return newEmotion;
  }

  getSentimentImpact(sentiment) {
    switch (sentiment) {
      case 'positive':
        return { energy: 5, interest: 3 };
      case 'negative':
        return { energy: -3, interest: -1 };
      default:
        return { energy: 0, interest: 0 };
    }
  }

  getEmotionImpact(emotion) {
    const emotionMap = {
      'joy': { energy: 8, interest: 5 },
      'excitement': { energy: 10, interest: 7 },
      'curiosity': { energy: 3, interest: 8 },
      'sadness': { energy: -5, interest: -2 },
      'anger': { energy: -8, interest: -5 },
      'surprise': { energy: 5, interest: 6 },
      'fear': { energy: -10, interest: -8 },
      'love': { energy: 7, interest: 4 },
      'gratitude': { energy: 4, interest: 3 }
    };

    return emotionMap[emotion] || { energy: 0, interest: 0 };
  }

  determineMoodType(emotion, analysisData) {
    if (emotion.energy_level >= 80 && emotion.interest_level >= 70) {
      return 'excited';
    } else if (emotion.energy_level >= 60) {
      return 'happy';
    } else if (emotion.energy_level <= 30) {
      return 'tired';
    } else if (analysisData.emotion_detected === 'sadness') {
      return 'melancholy';
    } else if (emotion.interest_level >= 70) {
      return 'curious';
    } else {
      return 'neutral';
    }
  }

  adjustValue(current, change, min, max) {
    const newValue = current + change;
    return Math.max(min, Math.min(max, Math.round(newValue)));
  }

  async applyTimeDecay(emotion) {
    const now = new Date();
    const lastInteraction = new Date(emotion.last_interaction);
    const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);

    if (hoursSinceLastInteraction < 1) {
      return emotion;
    }

    const decayAmount = Math.min(hoursSinceLastInteraction / 24 * 10, 20);
    
    emotion.energy_level = this.adjustValue(emotion.energy_level, -decayAmount, 30, 100);
    emotion.interest_level = this.adjustValue(emotion.interest_level, -decayAmount/2, 30, 100);

    if (hoursSinceLastInteraction > 24) {
      emotion.mood_type = 'neutral';
    }

    return emotion;
  }

  getDefaultEmotion(userId) {
    return {
      user_id: userId,
      energy_level: 50,
      intimacy_level: 0,
      interest_level: 50,
      mood_type: 'neutral',
      conversation_count: 0,
      last_interaction: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  getEmotionDescription(emotion) {
    const descriptions = {
      'excited': '今日はとても元気で、新しいことに興味津々です！',
      'happy': '気分が良くて、楽しい話をしたい気分です',
      'curious': '色々なことに興味を持っていて、質問したくなります',
      'tired': 'ちょっと疲れ気味ですが、話を聞くのは好きです',
      'melancholy': '少し物思いにふけっている感じです',
      'neutral': '普通の調子で、どんな話でも大丈夫です'
    };

    return descriptions[emotion.mood_type] || descriptions['neutral'];
  }

  async getEmotionStats(userId) {
    try {
      const emotion = await this.getCurrentEmotion(userId);
      return {
        energy: emotion.energy_level,
        intimacy: emotion.intimacy_level,
        interest: emotion.interest_level,
        mood: emotion.mood_type,
        conversationCount: emotion.conversation_count,
        description: this.getEmotionDescription(emotion)
      };
    } catch (error) {
      console.error('Error getting emotion stats:', error);
      return null;
    }
  }

  clearCache(userId = null) {
    if (userId) {
      this.emotionCache.delete(userId);
    } else {
      this.emotionCache.clear();
    }
  }
}

const emotionManager = new EmotionManager();

module.exports = {
  EmotionManager,
  emotionManager
};