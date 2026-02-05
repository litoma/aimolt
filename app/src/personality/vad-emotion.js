const { supabase } = require('../utils/supabase');

class VADEmotionManager {
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

      const { data, error } = await supabase
        .from('emotion_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      let emotion;
      if (!data) {
        emotion = await this.createInitialEmotion(userId);
      } else {
        emotion = data;
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
        energy_level: 50,     // 後方互換性
        intimacy_level: 0,    // 後方互換性
        interest_level: 50,   // 後方互換性
        mood_type: 'neutral',
        conversation_count: 0,
        valence: 50,          // VAD - 快・不快
        arousal: 50,          // VAD - 覚醒度
        dominance: 50         // VAD - 支配感
      };

      const { data, error } = await supabase
        .from('emotion_states')
        .insert([defaultEmotion])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating initial emotion:', error);
      return this.getDefaultEmotion(userId);
    }
  }

  async updateEmotion(userId, analysisData, vadValues = null) {
    try {
      const currentEmotion = await this.getCurrentEmotion(userId);

      // VAD値が直接提供されていない場合は計算
      if (!vadValues) {
        vadValues = this.calculateVAD(analysisData.user_message || '');
      }

      const newEmotion = this.calculateEmotionUpdate(currentEmotion, analysisData, vadValues);

      const updates = {
        energy_level: newEmotion.energy_level,
        intimacy_level: newEmotion.intimacy_level,
        interest_level: newEmotion.interest_level,
        mood_type: newEmotion.mood_type,
        conversation_count: currentEmotion.conversation_count + 1,
        last_interaction: new Date(),
        valence: newEmotion.valence,
        arousal: newEmotion.arousal,
        dominance: newEmotion.dominance
      };

      const { data, error } = await supabase
        .from('emotion_states')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      this.emotionCache.delete(userId);
      return data;
    } catch (error) {
      console.error('Error updating emotion:', error);
      return null;
    }
  }

  calculateVAD(message) {
    return {
      valence: this.calculateValence(message),
      arousal: this.calculateArousal(message),
      dominance: this.calculateDominance(message)
    };
  }

  calculateValence(message) {
    const positivePatterns = [
      /嬉しい|楽しい|好き|最高|ありがと|幸せ|喜び|素晴らしい|良い|面白い/gi,
      /やった|成功|達成|完了|クリア|解決|できた|よかった|安心/gi,
      /笑|www|ｗ|爆笑|へー|すごい|さすが|いいね|オッケー|OK/gi
    ];

    const negativePatterns = [
      /悲しい|つらい|辛い|嫌|ダメ|最悪|ひどい|むかつく|腹立つ|怒り/gi,
      /疲れた|しんどい|きつい|大変|困った|難しい|無理|失敗|負け/gi,
      /心配|不安|怖い|恐い|びっくり|驚き|ショック|がっかり/gi
    ];

    let score = 50; // ニュートラルベース

    positivePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 8;
    });

    negativePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 8;
    });

    return Math.max(0, Math.min(100, score));
  }

  calculateArousal(message) {
    const highArousalPatterns = [
      /！|!|やった|すごい|びっくり|急いで|興奮|テンション|盛り上がる/gi,
      /熱い|燃える|アツい|ワクワク|ドキドキ|はやく|今すぐ/gi
    ];

    const lowArousalPatterns = [
      /疲れた|眠い|ゆっくり|落ち着く|静か|穏やか|のんびり|リラックス/gi
    ];

    let score = 50;

    highArousalPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 10;
    });

    lowArousalPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 8;
    });

    // メッセージの長さと句読点も覚醒度に影響
    if (message.length > 100) score += 5;
    const exclamationCount = (message.match(/！|!/g) || []).length;
    score += exclamationCount * 3;

    return Math.max(0, Math.min(100, score));
  }

  calculateDominance(message) {
    const highDominancePatterns = [
      /決める|指示|命令|やってください|しなければ|すべき|必要|重要/gi,
      /私が|僕が|確信|絶対|間違いない|当然|明らか|決定/gi
    ];

    const lowDominancePatterns = [
      /お願い|助けて|わからない|困った|どうしよう|教えて|聞きたい/gi,
      /すみません|申し訳|恐縮|もしよろしければ|できれば/gi
    ];

    let score = 50;

    highDominancePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 12;
    });

    lowDominancePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 10;
    });

    return Math.max(0, Math.min(100, score));
  }

  calculateEmotionUpdate(currentEmotion, analysisData, vadValues) {
    const newEmotion = { ...currentEmotion };

    // VAD値を直接更新
    newEmotion.valence = this.smoothUpdate(currentEmotion.valence || 50, vadValues.valence, 0.3);
    newEmotion.arousal = this.smoothUpdate(currentEmotion.arousal || 50, vadValues.arousal, 0.3);
    newEmotion.dominance = this.smoothUpdate(currentEmotion.dominance || 50, vadValues.dominance, 0.3);

    // 後方互換性のために旧システムの値も更新
    newEmotion.energy_level = this.smoothUpdate(
      currentEmotion.energy_level,
      this.mapArousalToEnergy(newEmotion.arousal, newEmotion.valence),
      0.2
    );

    newEmotion.interest_level = this.smoothUpdate(
      currentEmotion.interest_level,
      this.mapToInterest(newEmotion.arousal, analysisData.importance_score || 5),
      0.2
    );

    // ムードタイプを決定
    newEmotion.mood_type = this.determineVADMood(newEmotion.valence, newEmotion.arousal, newEmotion.dominance);

    return newEmotion;
  }

  smoothUpdate(current, target, factor) {
    const change = (target - current) * factor;
    return Math.max(0, Math.min(100, Math.round(current + change)));
  }

  mapArousalToEnergy(arousal, valence) {
    // 覚醒度が高く、快感情なら高エネルギー
    return Math.round((arousal * 0.7) + (valence * 0.3));
  }

  mapToInterest(arousal, importanceScore) {
    // 覚醒度と重要度スコアから興味度を算出
    return Math.round((arousal * 0.6) + (importanceScore * 8));
  }

  determineVADMood(valence, arousal, dominance) {
    if (valence >= 70 && arousal >= 70 && dominance >= 60) return 'excited';
    if (valence >= 70 && arousal >= 50) return 'happy';
    if (valence >= 60 && arousal <= 40) return 'serenity';
    if (valence <= 30 && arousal >= 70 && dominance >= 60) return 'angry';
    if (valence <= 30 && arousal >= 70 && dominance <= 40) return 'fearful';
    if (valence <= 30 && arousal <= 40) return 'melancholy';
    if (valence >= 40 && valence <= 60 && arousal >= 70) return 'surprised';
    if (valence <= 35 && arousal >= 50 && dominance >= 50) return 'disgusted';
    if (valence >= 60 && arousal <= 50 && dominance <= 50) return 'trusting';
    if (valence >= 55 && arousal >= 60 && dominance >= 45) return 'anticipating';

    return 'neutral';
  }

  mapVADToEmotion(vad) {
    return this.determineVADMood(vad.valence, vad.arousal, vad.dominance);
  }

  async applyTimeDecay(emotion) {
    const now = new Date();
    const lastInteraction = new Date(emotion.last_interaction);
    const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);

    if (hoursSinceLastInteraction < 1) {
      return emotion;
    }

    // VAD値の時間減衰
    const decayAmount = Math.min(hoursSinceLastInteraction / 24 * 5, 10);

    emotion.valence = this.adjustValue(emotion.valence, 0, 40, 60); // 中性に戻る
    emotion.arousal = this.adjustValue(emotion.arousal, -decayAmount, 30, 70);
    emotion.dominance = this.adjustValue(emotion.dominance, 0, 40, 60);

    // 後方互換性
    emotion.energy_level = this.adjustValue(emotion.energy_level, -decayAmount, 30, 100);
    emotion.interest_level = this.adjustValue(emotion.interest_level, -decayAmount / 2, 30, 100);

    if (hoursSinceLastInteraction > 24) {
      emotion.mood_type = 'neutral';
    }

    return emotion;
  }

  adjustValue(current, change, min, max) {
    const newValue = current + change;
    return Math.max(min, Math.min(max, Math.round(newValue)));
  }

  getDefaultEmotion(userId) {
    return {
      user_id: userId,
      energy_level: 50,
      intimacy_level: 0,
      interest_level: 50,
      mood_type: 'neutral',
      conversation_count: 0,
      valence: 50,
      arousal: 50,
      dominance: 50,
      last_interaction: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  getEmotionDescription(emotion) {
    const vadMood = this.determineVADMood(emotion.valence || 50, emotion.arousal || 50, emotion.dominance || 50);

    const descriptions = {
      'excited': '今日はとても元気で興奮していて、新しいことに積極的です！',
      'happy': '気分が良くて、楽しい話をしたい気分です',
      'serenity': '穏やかで落ち着いた気持ちです',
      'angry': 'ちょっとイライラしているかもしれません',
      'fearful': '少し不安や心配を感じています',
      'melancholy': '少し物思いにふけっている感じです',
      'surprised': '驚きや新鮮さを感じています',
      'disgusted': 'あまり良くない気分です',
      'trusting': '安心感と信頼感を持っています',
      'anticipating': '何かを期待してワクワクしています',
      'neutral': '普通の調子で、どんな話でも大丈夫です'
    };

    return descriptions[vadMood] || descriptions['neutral'];
  }

  async getEmotionStats(userId) {
    try {
      const emotion = await this.getCurrentEmotion(userId);
      return {
        // VAD値
        valence: emotion.valence || 50,
        arousal: emotion.arousal || 50,
        dominance: emotion.dominance || 50,

        // 後方互換性
        energy: emotion.energy_level,
        intimacy: emotion.intimacy_level,
        interest: emotion.interest_level,

        mood: emotion.mood_type,
        conversationCount: emotion.conversation_count,
        description: this.getEmotionDescription(emotion),

        // VADベースの感情
        vadEmotion: this.mapVADToEmotion({
          valence: emotion.valence || 50,
          arousal: emotion.arousal || 50,
          dominance: emotion.dominance || 50
        })
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

const vadEmotionManager = new VADEmotionManager();

module.exports = {
  VADEmotionManager,
  vadEmotionManager
};