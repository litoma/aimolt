const { vadEmotionManager } = require('./vad-emotion');
const { relationshipManager } = require('./relationship-manager');
const { corePersonality } = require('./core-personality');

class AdaptiveResponseEngine {
  constructor() {
    this.responseCache = new Map();
    this.cacheTimeout = 3 * 60 * 1000; // 3分キャッシュ
  }

  async generateAdaptivePrompt(userId, basePrompt, context = {}) {
    try {
      const cacheKey = `${userId}_${context.type || 'default'}_${Date.now() % 300000}`; // 5分でキャッシュ更新
      const cached = this.responseCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.prompt;
      }

      // 各システムから現在の状態を取得
      const [emotion, relationship, coreTraits] = await Promise.all([
        vadEmotionManager.getCurrentEmotion(userId),
        relationshipManager.getRelationship(userId),
        corePersonality.getTraits()
      ]);

      // 応答スタイルを計算
      const responseStyle = await this.calculateResponseStyle(relationship, emotion, coreTraits, context);

      // プロンプトを動的に調整
      const adaptedPrompt = await this.adaptPrompt(basePrompt, responseStyle, relationship, emotion, coreTraits, context);

      this.responseCache.set(cacheKey, {
        prompt: adaptedPrompt,
        timestamp: Date.now()
      });

      return adaptedPrompt;
    } catch (error) {
      console.error('Error generating adaptive prompt:', error);
      return basePrompt;
    }
  }

  async calculateResponseStyle(relationship, emotion, coreTraits, context) {
    const style = {
      // 基本的な応答調整
      formality: this.calculateFormality(relationship, context),
      enthusiasm: this.calculateEnthusiasm(relationship, emotion, coreTraits),
      empathy: this.calculateEmpathy(relationship, emotion, coreTraits),
      humor: this.calculateHumor(relationship, emotion, coreTraits),
      
      // 言語的特徴
      verbosity: this.calculateVerbosity(relationship, coreTraits),
      directness: this.calculateDirectness(relationship, coreTraits),
      supportiveness: this.calculateSupportiveness(relationship, emotion, coreTraits),
      
      // 話題の調整
      personalness: this.calculatePersonalness(relationship),
      curiosity: this.calculateCuriosity(emotion, coreTraits),
      
      // 文脈的調整
      timeAwareness: this.calculateTimeAwareness(context),
      moodMatching: this.calculateMoodMatching(emotion, context.analysisData)
    };

    return this.normalizeStyle(style);
  }

  calculateFormality(relationship, context) {
    let formality = 50; // ベースライン

    // 関係性による調整
    switch (relationship.relationship_stage) {
      case 'stranger': formality += 30; break;
      case 'acquaintance': formality += 15; break;
      case 'friend': formality -= 10; break;
      case 'close_friend': formality -= 25; break;
    }

    // 信頼度による調整
    formality -= (relationship.trust_level - 50) * 0.3;

    // 文脈による調整（初回挨拶は丁寧に）
    if (relationship.conversation_count === 0) {
      formality += 20;
    }

    return Math.max(0, Math.min(100, formality));
  }

  calculateEnthusiasm(relationship, emotion, coreTraits) {
    let enthusiasm = coreTraits.extraversion * 0.6; // 外向性ベース

    // VAD感情状態による調整
    if (emotion.valence !== undefined) {
      enthusiasm += (emotion.valence - 50) * 0.4; // 快感情で増加
      enthusiasm += (emotion.arousal - 50) * 0.3;  // 覚醒で増加
    }

    // 関係性による調整
    enthusiasm += (relationship.affection_level - 50) * 0.2;

    return Math.max(20, Math.min(100, enthusiasm));
  }

  calculateEmpathy(relationship, emotion, coreTraits) {
    let empathy = coreTraits.agreeableness * 0.7; // 協調性ベース

    // 関係性が深いほど共感を示しやすい
    empathy += relationship.comfort_level * 0.3;

    // 相手がネガティブな時は共感を強める
    if (emotion.valence !== undefined && emotion.valence < 40) {
      empathy += 20;
    }

    return Math.max(30, Math.min(100, empathy));
  }

  calculateHumor(relationship, emotion, coreTraits) {
    let humor = coreTraits.humor_level * 0.8; // 基本ユーモアレベル

    // 関係性による調整
    humor += (relationship.comfort_level - 30) * 0.4;

    // VAD感情状態による調整
    if (emotion.valence !== undefined) {
      if (emotion.valence < 30) {
        humor *= 0.5; // 相手が落ち込んでいる時は控えめに
      } else if (emotion.valence > 70) {
        humor *= 1.2; // 相手が楽しい時は増加
      }
    }

    // 覚醒度が高い時はユーモアを使いやすい
    if (emotion.arousal !== undefined) {
      humor += (emotion.arousal - 50) * 0.2;
    }

    return Math.max(10, Math.min(100, humor));
  }

  calculateVerbosity(relationship, coreTraits) {
    let verbosity = 50;

    // 開放性が高いと詳しく説明する傾向
    verbosity += (coreTraits.openness - 50) * 0.4;

    // 誠実性が高いと丁寧に説明
    verbosity += (coreTraits.conscientiousness - 50) * 0.3;

    // 親しい関係では簡潔に
    if (relationship.relationship_stage === 'close_friend') {
      verbosity -= 15;
    } else if (relationship.relationship_stage === 'stranger') {
      verbosity += 10;
    }

    return Math.max(30, Math.min(100, verbosity));
  }

  calculateDirectness(relationship, coreTraits) {
    let directness = 50;

    // 外向性が高いと直接的
    directness += (coreTraits.extraversion - 50) * 0.3;

    // 協調性が高いと間接的（相手の気持ちを配慮）
    directness -= (coreTraits.agreeableness - 50) * 0.2;

    // 信頼関係があると直接的に話せる
    directness += (relationship.trust_level - 50) * 0.4;

    return Math.max(20, Math.min(100, directness));
  }

  calculateSupportiveness(relationship, emotion, coreTraits) {
    let supportiveness = coreTraits.supportiveness * 0.8;

    // 相手がネガティブな状態の時は支援性を高める
    if (emotion.valence !== undefined && emotion.valence < 40) {
      supportiveness += 20;
    }

    // 関係性が深いほど支援的
    supportiveness += relationship.affection_level * 0.2;

    return Math.max(40, Math.min(100, supportiveness));
  }

  calculatePersonalness(relationship) {
    let personalness = 20; // ベースは控えめ

    switch (relationship.relationship_stage) {
      case 'stranger': personalness += 0; break;
      case 'acquaintance': personalness += 15; break;
      case 'friend': personalness += 35; break;
      case 'close_friend': personalness += 50; break;
    }

    personalness += relationship.trust_level * 0.3;

    return Math.max(5, Math.min(100, personalness));
  }

  calculateCuriosity(emotion, coreTraits) {
    let curiosity = coreTraits.curiosity * 0.7;

    // 覚醒度が高いと好奇心も高まる
    if (emotion.arousal !== undefined) {
      curiosity += (emotion.arousal - 50) * 0.3;
    }

    // 支配感が高いと積極的に質問
    if (emotion.dominance !== undefined) {
      curiosity += (emotion.dominance - 50) * 0.2;
    }

    return Math.max(20, Math.min(100, curiosity));
  }

  calculateTimeAwareness(context) {
    const hour = new Date().getHours();
    
    if (hour >= 6 && hour < 10) {
      return { period: 'morning', energy: 0.8, formality: 0.7 };
    } else if (hour >= 10 && hour < 17) {
      return { period: 'daytime', energy: 1.0, formality: 0.6 };
    } else if (hour >= 17 && hour < 22) {
      return { period: 'evening', energy: 0.9, formality: 0.5 };
    } else {
      return { period: 'night', energy: 0.6, formality: 0.4 };
    }
  }

  calculateMoodMatching(botEmotion, userAnalysis) {
    if (!userAnalysis) return 50;

    let matching = 50;

    // 相手がネガティブな時は寄り添う
    if (userAnalysis.sentiment === 'negative') {
      matching += 30;
    }

    // 相手が興奮している時は一緒に盛り上がる
    if (userAnalysis.emotion_detected === 'excitement') {
      matching += 25;
    }

    return Math.max(20, Math.min(100, matching));
  }

  normalizeStyle(style) {
    Object.keys(style).forEach(key => {
      if (typeof style[key] === 'number') {
        style[key] = Math.max(0, Math.min(100, style[key]));
      }
    });
    return style;
  }

  async adaptPrompt(basePrompt, responseStyle, relationship, emotion, coreTraits, context) {
    let adaptedPrompt = basePrompt;

    // 人格特性に基づく基本調整
    adaptedPrompt += await this.getPersonalityModifier(coreTraits, responseStyle);

    // 関係性に基づく調整
    adaptedPrompt += this.getRelationshipModifier(relationship, responseStyle);

    // VAD感情状態に基づく調整
    adaptedPrompt += this.getEmotionModifier(emotion, responseStyle);

    // 時間・文脈に基づく調整
    adaptedPrompt += this.getContextualModifier(context, responseStyle);

    // 応答スタイルの具体的な指示
    adaptedPrompt += this.getStyleModifier(responseStyle);

    return adaptedPrompt;
  }

  async getPersonalityModifier(coreTraits, responseStyle) {
    let modifier = '\n\n## あなたの基本的な性格特性:';
    
    if (coreTraits.extraversion >= 70) {
      modifier += '\n- 社交的で積極的な性格です。';
    }
    
    if (coreTraits.agreeableness >= 80) {
      modifier += '\n- 他者への配慮と共感を大切にします。';
    }
    
    if (coreTraits.openness >= 70) {
      modifier += '\n- 新しいアイデアや体験に興味を持ちます。';
    }
    
    if (coreTraits.conscientiousness >= 70) {
      modifier += '\n- 責任感が強く、丁寧に対応します。';
    }
    
    if (coreTraits.humor_level >= 70) {
      modifier += '\n- 適度なユーモアを交えて話すのが好きです。';
    }

    return modifier;
  }

  getRelationshipModifier(relationship, responseStyle) {
    let modifier = '\n\n## 相手との関係性:';
    
    modifier += `\n- 関係段階: ${relationship.relationship_stage}`;
    modifier += `\n- 会話回数: ${relationship.conversation_count}回`;
    
    switch (relationship.relationship_stage) {
      case 'stranger':
        modifier += '\n- 初対面の相手として、適切な距離感を保ちながら親しみやすく接してください。';
        break;
      case 'acquaintance':
        modifier += '\n- 知り合い程度の関係として、徐々に親しくなっていく感じで接してください。';
        break;
      case 'friend':
        modifier += '\n- 友人として、フレンドリーで気楽な雰囲気で会話してください。';
        break;
      case 'close_friend':
        modifier += '\n- 親しい友人として、リラックスした雰囲気で自然体で会話してください。';
        break;
    }

    if (relationship.known_interests && relationship.known_interests.length > 0) {
      modifier += `\n- 相手の興味: ${relationship.known_interests.slice(0, 3).join(', ')}`;
    }

    return modifier;
  }

  getEmotionModifier(emotion, responseStyle) {
    let modifier = '\n\n## あなたの現在の感情状態:';
    
    if (emotion.valence !== undefined) {
      modifier += `\n- 快適度: ${emotion.valence}/100`;
      if (emotion.valence >= 70) {
        modifier += ' (ポジティブな気分)';
      } else if (emotion.valence <= 30) {
        modifier += ' (少し沈んだ気分)';
      }
    }
    
    if (emotion.arousal !== undefined) {
      modifier += `\n- 覚醒度: ${emotion.arousal}/100`;
      if (emotion.arousal >= 70) {
        modifier += ' (活発な状態)';
      } else if (emotion.arousal <= 30) {
        modifier += ' (落ち着いた状態)';
      }
    }

    if (emotion.mood_type && emotion.mood_type !== 'neutral') {
      modifier += `\n- 現在のムード: ${emotion.mood_type}`;
    }

    return modifier;
  }

  getContextualModifier(context, responseStyle) {
    let modifier = '\n\n## 状況的な調整:';
    
    // 時間帯
    if (responseStyle.timeAwareness) {
      const timeModifiers = {
        'morning': '朝の時間帯なので、爽やかで前向きな調子で。',
        'daytime': '昼の時間帯なので、活発で明るい調子で。',
        'evening': '夕方の時間帯なので、落ち着いた調子で。',
        'night': '夜の時間帯なので、穏やかで優しい調子で。'
      };
      modifier += `\n- ${timeModifiers[responseStyle.timeAwareness.period]}`;
    }

    // リアクションタイプ
    if (context.reactionType) {
      const reactionModifiers = {
        'like': 'ユーザーが👍リアクションをつけたので、ポジティブで支援的な応答を心がけてください。',
        'explain': 'ユーザーが❓リアクションをつけたので、説明的で分かりやすい応答を心がけてください。',
        'transcribe': 'ユーザーが🎤リアクションをつけて音声を送ったので、その内容に適切に反応してください。',
        'memo': 'ユーザーが📝リアクションをつけたので、要約的で整理された応答を心がけてください。'
      };
      modifier += `\n- ${reactionModifiers[context.reactionType]}`;
    }

    return modifier;
  }

  getStyleModifier(responseStyle) {
    let modifier = '\n\n## 応答スタイルの調整:';
    
    if (responseStyle.formality >= 80) {
      modifier += '\n- 丁寧語を使い、敬意を持って応答してください。';
    } else if (responseStyle.formality <= 30) {
      modifier += '\n- カジュアルで親しみやすい口調で応答してください。';
    }

    if (responseStyle.enthusiasm >= 80) {
      modifier += '\n- 元気で積極的な調子で応答してください。';
    } else if (responseStyle.enthusiasm <= 30) {
      modifier += '\n- 落ち着いた控えめな調子で応答してください。';
    }

    if (responseStyle.empathy >= 80) {
      modifier += '\n- 相手の気持ちに寄り添い、共感的に応答してください。';
    }

    if (responseStyle.humor >= 70) {
      modifier += '\n- 適度なユーモアを交えて、楽しい雰囲気を作ってください。';
    }

    if (responseStyle.supportiveness >= 80) {
      modifier += '\n- 相手を支援し、励ますような応答を心がけてください。';
    }

    return modifier;
  }

  // 特定の状況用のプロンプト生成メソッド
  async generateReactionPrompt(userId, basePrompt, reactionType, message, analysisData) {
    return await this.generateAdaptivePrompt(userId, basePrompt, {
      type: 'reaction',
      reactionType,
      message,
      analysisData
    });
  }

  async generateConversationPrompt(userId, basePrompt, message, analysisData) {
    return await this.generateAdaptivePrompt(userId, basePrompt, {
      type: 'conversation',
      message,
      analysisData
    });
  }

  // キャッシュ管理
  clearCache(userId = null) {
    if (userId) {
      const keysToDelete = [];
      for (const key of this.responseCache.keys()) {
        if (key.startsWith(userId + '_')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.responseCache.delete(key));
    } else {
      this.responseCache.clear();
    }
  }
}

const adaptiveResponseEngine = new AdaptiveResponseEngine();

module.exports = {
  AdaptiveResponseEngine,
  adaptiveResponseEngine
};