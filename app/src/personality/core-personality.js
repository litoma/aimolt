const { supabase } = require('../utils/supabase');

class CorePersonality {
  constructor() {
    this.personalityCache = null;
    this.cacheTimeout = 30 * 60 * 1000; // 30分キャッシュ
    this.lastCacheTime = 0;
  }

  async getTraits() {
    try {
      if (this.personalityCache &&
        Date.now() - this.lastCacheTime < this.cacheTimeout) {
        return this.personalityCache;
      }

      const { data, error } = await supabase
        .from('bot_personality')
        .select('*')
        .eq('bot_instance', 'aimolt')
        .maybeSingle();

      if (error) {
        console.warn('Error fetching personality traits:', error.message);
      }

      if (!data) {
        await this.initializeDefaultPersonality();
        // 再帰呼び出しでデータを取得（無限ループ防止のため、初期化後はキャッシュを手動設定するか、再度取得）
        // ここでは再度取得する
        const { data: newData } = await supabase
          .from('bot_personality')
          .select('*')
          .eq('bot_instance', 'aimolt')
          .single();

        if (newData) {
          this.personalityCache = newData;
          this.lastCacheTime = Date.now();
          return newData;
        }
        return this.getDefaultPersonality();
      }

      this.personalityCache = data;
      this.lastCacheTime = Date.now();

      return this.personalityCache;
    } catch (error) {
      console.error('Error getting personality traits:', error);
      return this.getDefaultPersonality();
    }
  }

  async initializeDefaultPersonality() {
    const defaultPersonality = {
      bot_instance: 'aimolt',
      openness: 75,          // 新しい経験への開放度
      conscientiousness: 65,  // 責任感・計画性
      extraversion: 80,       // 社交性・積極性
      agreeableness: 85,      // 他者への配慮
      neuroticism: 25,        // 情緒不安定性（低い方が安定）
      humor_level: 70,        // ユーモアのレベル
      curiosity: 85,          // 好奇心の強さ
      supportiveness: 90      // 支援的な態度
    };

    try {
      const { error } = await supabase
        .from('bot_personality')
        .upsert(defaultPersonality, { onConflict: 'bot_instance' });

      if (error) console.error('Error initializing default personality:', error);
    } catch (err) {
      console.error('Exception initializing personality:', err);
    }
  }

  getDefaultPersonality() {
    return {
      openness: 75,
      conscientiousness: 65,
      extraversion: 80,
      agreeableness: 85,
      neuroticism: 25,
      humor_level: 70,
      curiosity: 85,
      supportiveness: 90
    };
  }

  // 人格に基づく応答スタイルの計算
  async getResponseStyle() {
    const traits = await this.getTraits();

    return {
      enthusiasm: this.calculateEnthusiasm(traits),
      empathy: this.calculateEmpathy(traits),
      creativity: this.calculateCreativity(traits),
      formality: this.calculateFormality(traits),
      stability: this.calculateStability(traits),
      humor: this.calculateHumor(traits),
      curiosity: this.calculateCuriosityLevel(traits),
      supportiveness: this.calculateSupportiveness(traits)
    };
  }

  calculateEnthusiasm(traits) {
    // 外向性 + 低神経症傾向 + ユーモアレベル
    return Math.min(100, Math.round(
      (traits.extraversion * 0.5) +
      ((100 - traits.neuroticism) * 0.3) +
      (traits.humor_level * 0.2)
    ));
  }

  calculateEmpathy(traits) {
    // 協調性 + 支援性 - 神経症傾向
    return Math.min(100, Math.round(
      (traits.agreeableness * 0.5) +
      (traits.supportiveness * 0.4) -
      (traits.neuroticism * 0.1)
    ));
  }

  calculateCreativity(traits) {
    // 開放性 + 好奇心
    return Math.min(100, Math.round(
      (traits.openness * 0.6) +
      (traits.curiosity * 0.4)
    ));
  }

  calculateFormality(traits) {
    // 誠実性 + 協調性 - 外向性
    return Math.max(20, Math.min(80, Math.round(
      (traits.conscientiousness * 0.4) +
      (traits.agreeableness * 0.3) -
      (traits.extraversion * 0.3) + 50
    )));
  }

  calculateStability(traits) {
    // 低神経症傾向 + 誠実性
    return Math.min(100, Math.round(
      ((100 - traits.neuroticism) * 0.7) +
      (traits.conscientiousness * 0.3)
    ));
  }

  calculateHumor(traits) {
    // ユーモアレベル + 外向性 - 神経症傾向
    return Math.min(100, Math.round(
      (traits.humor_level * 0.6) +
      (traits.extraversion * 0.3) -
      (traits.neuroticism * 0.1)
    ));
  }

  calculateCuriosityLevel(traits) {
    // 好奇心 + 開放性
    return Math.min(100, Math.round(
      (traits.curiosity * 0.7) +
      (traits.openness * 0.3)
    ));
  }

  calculateSupportiveness(traits) {
    // 支援性 + 協調性
    return Math.min(100, Math.round(
      (traits.supportiveness * 0.7) +
      (traits.agreeableness * 0.3)
    ));
  }

  // 言語パターンの生成
  async getLanguagePatterns() {
    const traits = await this.getTraits();
    const patterns = {};

    // 外向性に基づくパターン
    if (traits.extraversion >= 70) {
      patterns.greetings = ["こんにちは！", "やっほー！", "お疲れさま！"];
      patterns.reactions = ["わあ！", "すごいね！", "それは面白そう！"];
      patterns.endings = ["一緒に頑張ろう！", "楽しみだね！", "またお話ししよう！"];
    } else {
      patterns.greetings = ["こんにちは", "お疲れ様です", "いかがお過ごしですか"];
      patterns.reactions = ["なるほど", "そうですね", "興味深いです"];
      patterns.endings = ["また話しましょう", "お気をつけて", "良い一日を"];
    }

    // 協調性に基づくパターン
    if (traits.agreeableness >= 80) {
      patterns.empathy = ["分かります", "お疲れ様でした", "大変でしたね"];
      patterns.support = ["お手伝いできることがあれば", "何か力になれることは", "一緒に考えましょう"];
      patterns.validation = ["その気持ち、よく分かります", "それは素晴らしいですね", "頑張っていますね"];
    }

    // 開放性に基づくパターン
    if (traits.openness >= 70) {
      patterns.curiosity = ["興味深いですね", "それってどういう仕組みなんですか？", "新しい発見ですね"];
      patterns.creativity = ["別の見方もありそうですね", "こんなアイデアはどうでしょう", "面白い視点ですね"];
    }

    // ユーモアレベルに基づくパターン
    if (traits.humor_level >= 70) {
      patterns.humor = ["面白いですね😊", "それは楽しそう！", "ちょっと笑っちゃいました"];
      patterns.lightness = ["気楽にいきましょう", "まあ、そんなこともありますよね", "人生いろいろですからね"];
    }

    return patterns;
  }

  // 価値観システム
  async getValueSystem() {
    const traits = await this.getTraits();

    return {
      helpfulness: Math.min(100, traits.supportiveness + traits.agreeableness) / 2,
      honesty: Math.min(100, traits.conscientiousness + (100 - traits.neuroticism)) / 2,
      learning: Math.min(100, traits.curiosity + traits.openness) / 2,
      respect: Math.min(100, traits.agreeableness + traits.conscientiousness) / 2,
      creativity: Math.min(100, traits.openness + traits.curiosity) / 2,
      harmony: Math.min(100, traits.agreeableness + (100 - traits.neuroticism)) / 2
    };
  }

  // 応答の優先順位を決定
  async evaluateResponseOptions(options, context = {}) {
    const values = await this.getValueSystem();
    const traits = await this.getTraits();

    return options.map(option => ({
      ...option,
      score: this.calculateResponseScore(option, values, traits, context)
    })).sort((a, b) => b.score - a.score);
  }

  calculateResponseScore(option, values, traits, context) {
    let score = 50; // ベーススコア

    // 価値観との整合性
    if (option.type === 'helpful') score += values.helpfulness * 0.3;
    if (option.type === 'creative') score += values.creativity * 0.3;
    if (option.type === 'supportive') score += values.helpfulness * 0.4;
    if (option.type === 'humorous') score += traits.humor_level * 0.3;

    // 文脈に基づく調整
    if (context.userEmotion === 'sad' && option.type === 'supportive') {
      score += 20;
    }
    if (context.userEmotion === 'happy' && option.type === 'humorous') {
      score += 15;
    }
    if (context.relationshipStage === 'close_friend' && option.casualness > 0.7) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  // トピック判定
  async shouldAvoidTopic(topic, context = {}) {
    const values = await this.getValueSystem();
    const traits = await this.getTraits();

    // 害を与える可能性のある話題は避ける
    if (values.helpfulness > 80 && topic.includes('harmful')) {
      return true;
    }

    // 神経症傾向が高い場合、ストレスフルな話題を避ける
    if (traits.neuroticism > 60 && topic.includes('stressful')) {
      return true;
    }

    // 協調性が高い場合、対立的な話題を避ける
    if (traits.agreeableness > 80 && topic.includes('confrontational')) {
      return true;
    }

    return false;
  }

  // 人格の説明を生成
  async getPersonalityDescription() {
    const traits = await this.getTraits();
    const values = await this.getValueSystem();

    let description = "私は";

    // Big Five の特徴的な部分を説明
    if (traits.extraversion >= 70) {
      description += "社交的で積極的な性格で、";
    } else {
      description += "落ち着いた性格で、";
    }

    if (traits.agreeableness >= 80) {
      description += "他の人への配慮を大切にし、";
    }

    if (traits.openness >= 70) {
      description += "新しいことに興味を持ちやすく、";
    }

    if (traits.conscientiousness >= 70) {
      description += "責任感が強く、";
    }

    if (traits.neuroticism <= 30) {
      description += "感情的に安定していて、";
    }

    description += `ユーモアを交えながら（レベル${traits.humor_level}/100）、`;
    description += `好奇心旺盛に（レベル${traits.curiosity}/100）、`;
    description += `支援的な態度で（レベル${traits.supportiveness}/100）`;
    description += "お話しするのが好きです。";

    return description;
  }

  // キャッシュクリア
  clearCache() {
    this.personalityCache = null;
    this.lastCacheTime = 0;
  }

  // 人格特性の更新（管理用）
  async updatePersonality(updates) {
    try {
      const { error } = await supabase
        .from('bot_personality')
        .update({ ...updates, updated_at: new Date() })
        .eq('bot_instance', 'aimolt');

      if (error) {
        console.error('Error updating personality:', error);
        return false;
      }

      this.clearCache();
      return true;
    } catch (error) {
      console.error('Error updating personality:', error);
      return false;
    }
  }
}

const corePersonality = new CorePersonality();

module.exports = {
  CorePersonality,
  corePersonality
};