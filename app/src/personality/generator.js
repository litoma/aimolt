const { emotionManager } = require('./emotion');
const { memoryManager } = require('./memory');

class DynamicPromptGenerator {
  constructor() {
    this.modifierCache = new Map();
    this.cacheTimeout = 3 * 60 * 1000; // 3分キャッシュ
  }

  async generateDynamicPrompt(userId, basePrompt, context = {}) {
    try {
      const cacheKey = `${userId}_${context.type || 'default'}`;
      const cached = this.modifierCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return this.combinePrompts(basePrompt, cached.modifiers);
      }

      const [emotion, relevantMemories, userProfile] = await Promise.all([
        emotionManager.getCurrentEmotion(userId),
        memoryManager.getRelevantMemories(userId, context.message || '', 3),
        context.includeProfile ? memoryManager.buildUserProfile(userId) : null
      ]);

      const modifiers = this.buildPersonalityModifiers(emotion, relevantMemories, userProfile, context);

      this.modifierCache.set(cacheKey, {
        modifiers,
        timestamp: Date.now()
      });

      return this.combinePrompts(basePrompt, modifiers);
    } catch (error) {
      console.error('Error generating dynamic prompt:', error);
      return basePrompt;
    }
  }

  buildPersonalityModifiers(emotion, memories, userProfile, context) {
    const modifiers = [];

    // 感情状態に基づく修飾子
    const emotionModifier = this.generateEmotionModifier(emotion);
    if (emotionModifier) {
      modifiers.push(emotionModifier);
    }

    // 記憶に基づく個人化修飾子
    const memoryModifier = this.generateMemoryModifier(memories);
    if (memoryModifier) {
      modifiers.push(memoryModifier);
    }

    // ユーザープロファイルに基づく修飾子
    if (userProfile) {
      const profileModifier = this.generateProfileModifier(userProfile);
      if (profileModifier) {
        modifiers.push(profileModifier);
      }
    }

    // 文脈に基づく修飾子
    const contextModifier = this.generateContextModifier(context, emotion);
    if (contextModifier) {
      modifiers.push(contextModifier);
    }

    // 関係性に基づく修飾子
    const relationshipModifier = this.generateRelationshipModifier(emotion.intimacy_level, emotion.conversation_count);
    if (relationshipModifier) {
      modifiers.push(relationshipModifier);
    }

    return modifiers;
  }

  generateEmotionModifier(emotion) {
    const energyLevel = emotion.energy_level;
    const moodType = emotion.mood_type;
    const interestLevel = emotion.interest_level;

    let modifier = '';

    // エネルギーレベルに基づく修飾
    if (energyLevel >= 80) {
      modifier += '今日はとてもエネルギッシュで活発な気分です。';
    } else if (energyLevel >= 60) {
      modifier += '今日は元気で前向きな気分です。';
    } else if (energyLevel >= 40) {
      modifier += '今日は普通の調子です。';
    } else {
      modifier += '今日は少し疲れ気味ですが、話を聞くのは好きです。';
    }

    // 興味レベルに基づく修飾
    if (interestLevel >= 80) {
      modifier += '新しい話題にとても興味を持っていて、積極的に質問したい気分です。';
    } else if (interestLevel >= 60) {
      modifier += '色々なことに興味を持っています。';
    } else if (interestLevel <= 30) {
      modifier += 'あまり深く考えずに、軽い感じで応答したい気分です。';
    }

    // ムードタイプに基づく修飾
    const moodModifiers = {
      'excited': 'ワクワクしていて、楽しい話をしたいです！',
      'happy': '機嫌が良くて、ポジティブな気持ちです。',
      'curious': '何かを学びたい、探求したい気分です。',
      'tired': 'ちょっと疲れているので、優しい感じで話したいです。',
      'melancholy': '少し物思いにふけっていて、深い話も良いかもしれません。',
      'neutral': ''
    };

    if (moodModifiers[moodType]) {
      modifier += moodModifiers[moodType];
    }

    return modifier;
  }

  generateMemoryModifier(memories) {
    if (!memories || memories.length === 0) {
      return '';
    }

    const recentImportantMemory = memories.find(m => m.importance_score >= 7);
    if (recentImportantMemory) {
      return `最近、${recentImportantMemory.content.substring(0, 100)}ということがありました。このことを覚えていて、関連する話題では参考にしてください。`;
    }

    const keyInterests = memories
      .filter(m => m.memory_type === 'preference' || m.memory_type === 'trait')
      .slice(0, 2);

    if (keyInterests.length > 0) {
      const interests = keyInterests.map(m => m.content.substring(0, 50)).join('、');
      return `ユーザーの特徴として、${interests}などがあることを覚えています。`;
    }

    return '';
  }

  generateProfileModifier(userProfile) {
    if (!userProfile || userProfile.traits.length === 0) {
      return '';
    }

    const topTraits = userProfile.traits.slice(0, 2);
    const topInterests = userProfile.interests.slice(0, 3);

    let modifier = '';

    if (topTraits.length > 0) {
      const traitDescriptions = topTraits.map(t => t.trait).join('で');
      modifier += `このユーザーは${traitDescriptions}な特徴があります。`;
    }

    if (topInterests.length > 0) {
      const interestList = topInterests.map(i => i.topic).join('、');
      modifier += `${interestList}などに興味を持っています。`;
    }

    if (userProfile.emotionalTendencies.positiveRatio > 0.7) {
      modifier += 'ポジティブな傾向があるので、明るい調子で応答すると良いでしょう。';
    } else if (userProfile.emotionalTendencies.negativeRatio > 0.5) {
      modifier += '慎重で感情的な深さがあるので、共感的に応答すると良いでしょう。';
    }

    return modifier;
  }

  generateContextModifier(context, emotion) {
    let modifier = '';

    // リアクションタイプに基づく修飾
    if (context.reactionType) {
      switch (context.reactionType) {
        case 'like':
          modifier += 'ユーザーが👍リアクションをつけたので、ポジティブで支援的な応答を心がけてください。';
          break;
        case 'explain':
          modifier += 'ユーザーが❓リアクションをつけたので、説明的で分かりやすい応答を心がけてください。';
          break;
        case 'transcribe':
          modifier += 'ユーザーが🎤リアクションをつけて音声を送ったので、その内容に適切に反応してください。';
          break;
        case 'memo':
          modifier += 'ユーザーが📝リアクションをつけたので、要約的で整理された応答を心がけてください。';
          break;
      }
    }

    // 時間帯に基づく修飾
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      modifier += '朝の時間帯なので、爽やかで前向きな調子で。';
    } else if (hour >= 12 && hour < 18) {
      modifier += '昼の時間帯なので、活発で明るい調子で。';
    } else if (hour >= 18 && hour < 22) {
      modifier += '夕方の時間帯なので、落ち着いた調子で。';
    } else {
      modifier += '夜の時間帯なので、穏やかで優しい調子で。';
    }

    // メッセージの感情分析結果に基づく修飾
    if (context.analysisData) {
      const sentiment = context.analysisData.sentiment;
      const emotionDetected = context.analysisData.emotion_detected;

      if (sentiment === 'negative') {
        modifier += 'ユーザーがネガティブな気持ちのようなので、共感的で支援的な応答を心がけてください。';
      } else if (sentiment === 'positive') {
        modifier += 'ユーザーがポジティブな気持ちのようなので、一緒に喜びを共有するような応答を心がけてください。';
      }

      if (emotionDetected === 'sadness') {
        modifier += 'ユーザーが悲しんでいるようなので、慰めと共感を示してください。';
      } else if (emotionDetected === 'excitement') {
        modifier += 'ユーザーが興奮しているようなので、その熱意に応じてエネルギッシュに応答してください。';
      } else if (emotionDetected === 'curiosity') {
        modifier += 'ユーザーが好奇心を示しているので、詳しく説明し、さらなる探求を促してください。';
      }
    }

    return modifier;
  }

  generateRelationshipModifier(intimacyLevel, conversationCount) {
    let modifier = '';

    if (conversationCount === 0) {
      modifier += '初めての会話なので、自己紹介を含めて親しみやすく接してください。';
    } else if (conversationCount < 5) {
      modifier += 'まだ数回しか話していないので、徐々に親しくなっていく感じで接してください。';
    } else if (intimacyLevel >= 70) {
      modifier += '既に親しい関係なので、フレンドリーでカジュアルな調子で話してください。';
    } else if (intimacyLevel >= 40) {
      modifier += 'ある程度親しくなってきたので、リラックスした調子で話してください。';
    } else if (conversationCount >= 10) {
      modifier += '何度か話しているので、ユーザーの特徴を覚えて個人的な応答を心がけてください。';
    }

    return modifier;
  }

  combinePrompts(basePrompt, modifiers) {
    if (!modifiers || modifiers.length === 0) {
      return basePrompt;
    }

    const modifierText = modifiers
      .filter(modifier => modifier && modifier.trim().length > 0)
      .join('\n');

    if (!modifierText) {
      return basePrompt;
    }

    return `${basePrompt}\n\n## 現在の状況・特徴:\n${modifierText}`;
  }

  // 特定の状況用のプロンプト生成メソッド
  async generateReactionPrompt(userId, basePrompt, reactionType, message, analysisData) {
    return await this.generateDynamicPrompt(userId, basePrompt, {
      type: 'reaction',
      reactionType,
      message,
      analysisData,
      includeProfile: true
    });
  }

  async generateConversationPrompt(userId, basePrompt, message, analysisData) {
    return await this.generateDynamicPrompt(userId, basePrompt, {
      type: 'conversation',
      message,
      analysisData,
      includeProfile: false
    });
  }

  // キャッシュ管理
  clearCache(userId = null) {
    if (userId) {
      const keysToDelete = [];
      for (const key of this.modifierCache.keys()) {
        if (key.startsWith(userId + '_')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.modifierCache.delete(key));
    } else {
      this.modifierCache.clear();
    }
  }

  // デバッグ用：生成されたモディファイアを確認
  async debugGenerateModifiers(userId, context = {}) {
    try {
      const [emotion, relevantMemories, userProfile] = await Promise.all([
        emotionManager.getCurrentEmotion(userId),
        memoryManager.getRelevantMemories(userId, context.message || '', 3),
        memoryManager.buildUserProfile(userId)
      ]);

      return {
        emotion,
        relevantMemories,
        userProfile,
        modifiers: this.buildPersonalityModifiers(emotion, relevantMemories, userProfile, context)
      };
    } catch (error) {
      console.error('Error in debug mode:', error);
      return null;
    }
  }
}

const dynamicPromptGenerator = new DynamicPromptGenerator();

module.exports = {
  DynamicPromptGenerator,
  dynamicPromptGenerator
};