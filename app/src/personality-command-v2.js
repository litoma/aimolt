/**
 * 人格システム v2.0 管理コマンド
 * VAD感情モデル + 関係性管理システム対応
 */

const { Pool } = require('pg');

const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'aimolt',
});

class PersonalityCommandV2 {
  
  /**
   * !personality status コマンドの処理
   */
  async handleStatusCommand(message, targetUserId, targetUser) {
    try {
      const [emotion, relationship, botPersonality] = await Promise.all([
        this.getEmotionState(targetUserId),
        this.getRelationship(targetUserId),
        this.getBotPersonality()
      ]);

      const embed = {
        title: `🧠 ${targetUser.displayName || targetUser.username} の人格プロファイル`,
        color: this.getEmbedColor(emotion, relationship),
        fields: [],
        footer: { text: 'AImolt 動的人格システム v2.0' },
        timestamp: new Date().toISOString()
      };

      // VAD感情状態
      if (emotion) {
        const emotionField = this.buildEmotionField(emotion);
        embed.fields.push(emotionField);
      }

      // 関係性情報
      if (relationship) {
        const relationshipField = this.buildRelationshipField(relationship);
        embed.fields.push(relationshipField);
      }

      // ボットの基本人格
      if (botPersonality) {
        const personalityField = this.buildBotPersonalityField(botPersonality);
        embed.fields.push(personalityField);
      }

      // 統計情報
      const statsField = await this.buildStatsField(targetUserId);
      embed.fields.push(statsField);

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in personality status:', error);
      await message.reply('❌ 人格状態の取得中にエラーが発生しました。');
    }
  }

  /**
   * !personality stats コマンドの処理
   */
  async handleStatsCommand(message) {
    try {
      const [systemStats, relationshipDistribution, emotionAverages] = await Promise.all([
        this.getSystemStats(),
        this.getRelationshipDistribution(),
        this.getEmotionAverages()
      ]);

      const embed = {
        title: '📊 人格システム全体統計',
        color: 0x3498db,
        fields: [
          {
            name: '🔧 システム統計',
            value: [
              `👥 総ユーザー数: ${systemStats.totalUsers}人`,
              `💬 総会話数: ${systemStats.totalConversations}回`,
              `🧠 記憶データ: ${systemStats.totalMemories}件`,
              `📈 分析データ: ${systemStats.totalAnalyses}件`
            ].join('\n'),
            inline: true
          },
          {
            name: '🤝 関係性分布',
            value: relationshipDistribution.map(r => 
              `${this.getRelationshipEmoji(r.relationship_stage)} ${r.relationship_stage}: ${r.count}人`
            ).join('\n'),
            inline: true
          },
          {
            name: '😊 平均感情状態 (VAD)',
            value: [
              `😄 快適度 (Valence): ${emotionAverages.avg_valence}/100`,
              `⚡ 覚醒度 (Arousal): ${emotionAverages.avg_arousal}/100`,
              `💪 主導性 (Dominance): ${emotionAverages.avg_dominance}/100`
            ].join('\n'),
            inline: false
          }
        ],
        footer: { text: 'リアルタイム統計データ' },
        timestamp: new Date().toISOString()
      };

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in personality stats:', error);
      await message.reply('❌ システム統計の取得中にエラーが発生しました。');
    }
  }

  /**
   * !personality debug コマンドの処理
   */
  async handleDebugCommand(message, targetUserId, targetUser) {
    try {
      const [emotion, relationship, conversations, interests] = await Promise.all([
        this.getEmotionState(targetUserId),
        this.getRelationship(targetUserId),
        this.getRecentConversations(targetUserId),
        this.getKnownInterests(targetUserId)
      ]);

      const embed = {
        title: `🔍 ${targetUser.displayName || targetUser.username} のデバッグ情報`,
        color: 0xe74c3c,
        fields: [
          {
            name: '🎭 詳細感情状態',
            value: emotion ? [
              `Valence: ${emotion.valence}/100 ${this.getValenceEmoji(emotion.valence)}`,
              `Arousal: ${emotion.arousal}/100 ${this.getArousalEmoji(emotion.arousal)}`,
              `Dominance: ${emotion.dominance}/100 ${this.getDominanceEmoji(emotion.dominance)}`,
              `推定感情: ${this.mapVADToEmotion(emotion)}`,
              `最終更新: ${this.formatDate(emotion.last_interaction)}`
            ].join('\n') : 'データなし',
            inline: true
          },
          {
            name: '🤝 関係性詳細',
            value: relationship ? [
              `好感度: ${relationship.affection_level}/100`,
              `信頼度: ${relationship.trust_level}/100`,
              `親密度: ${relationship.comfort_level}/100`,
              `会話数: ${relationship.conversation_count}回`,
              `重要な会話: ${relationship.meaningful_interactions}回`,
              `敬語レベル: ${relationship.preferred_formality}`
            ].join('\n') : 'データなし',
            inline: true
          }
        ],
        footer: { text: 'デバッグ用詳細情報' },
        timestamp: new Date().toISOString()
      };

      // 興味・関心の追加
      if (interests && interests.length > 0) {
        embed.fields.push({
          name: '🎯 把握している興味・関心',
          value: interests.slice(0, 5).join('\n'),
          inline: false
        });
      }

      // 最近の会話パターン
      if (conversations && conversations.length > 0) {
        const recentPattern = this.analyzeRecentPattern(conversations);
        embed.fields.push({
          name: '📈 最近の会話パターン',
          value: recentPattern,
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in personality debug:', error);
      await message.reply('❌ デバッグ情報の取得中にエラーが発生しました。');
    }
  }

  // データ取得メソッド
  async getEmotionState(userId) {
    const result = await pgPool.query(
      'SELECT * FROM emotion_states WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async getRelationship(userId) {
    const result = await pgPool.query(
      'SELECT * FROM user_relationships WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  async getBotPersonality() {
    const result = await pgPool.query(
      'SELECT * FROM bot_personality WHERE bot_instance = $1',
      ['aimolt']
    );
    return result.rows[0] || null;
  }

  async getSystemStats() {
    const [users, conversations, memories, analyses] = await Promise.all([
      pgPool.query('SELECT COUNT(DISTINCT user_id) as count FROM user_relationships'),
      pgPool.query('SELECT COUNT(*) as count FROM conversations'),
      pgPool.query('SELECT COUNT(*) as count FROM user_memories'),
      pgPool.query('SELECT COUNT(*) as count FROM conversation_analysis')
    ]);

    return {
      totalUsers: parseInt(users.rows[0].count),
      totalConversations: parseInt(conversations.rows[0].count),
      totalMemories: parseInt(memories.rows[0].count),
      totalAnalyses: parseInt(analyses.rows[0].count)
    };
  }

  async getRelationshipDistribution() {
    const result = await pgPool.query(`
      SELECT relationship_stage, COUNT(*) as count 
      FROM user_relationships 
      GROUP BY relationship_stage 
      ORDER BY count DESC
    `);
    return result.rows;
  }

  async getEmotionAverages() {
    const result = await pgPool.query(`
      SELECT 
        ROUND(AVG(valence)) as avg_valence,
        ROUND(AVG(arousal)) as avg_arousal,
        ROUND(AVG(dominance)) as avg_dominance
      FROM emotion_states
    `);
    return result.rows[0] || { avg_valence: 50, avg_arousal: 50, avg_dominance: 50 };
  }

  async getRecentConversations(userId) {
    const result = await pgPool.query(`
      SELECT user_message, created_at 
      FROM conversations 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 5
    `, [userId]);
    return result.rows;
  }

  async getKnownInterests(userId) {
    const result = await pgPool.query(
      'SELECT known_interests FROM user_relationships WHERE user_id = $1',
      [userId]
    );
    return result.rows[0]?.known_interests || [];
  }

  // 表示用ヘルパーメソッド
  buildEmotionField(emotion) {
    const emotionName = this.mapVADToEmotion(emotion);
    return {
      name: '🎭 感情状態 (VAD)',
      value: [
        `${this.getEmotionEmoji(emotionName)} **${emotionName}**`,
        `😄 快適度: ${emotion.valence}/100 ${this.getProgressBar(emotion.valence)}`,
        `⚡ 覚醒度: ${emotion.arousal}/100 ${this.getProgressBar(emotion.arousal)}`,
        `💪 主導性: ${emotion.dominance}/100 ${this.getProgressBar(emotion.dominance)}`,
        `💬 会話回数: ${emotion.conversation_count}回`
      ].join('\n'),
      inline: true
    };
  }

  buildRelationshipField(relationship) {
    return {
      name: '🤝 関係性',
      value: [
        `${this.getRelationshipEmoji(relationship.relationship_stage)} **${relationship.relationship_stage}**`,
        `💖 好感度: ${relationship.affection_level}/100`,
        `🤝 信頼度: ${relationship.trust_level}/100`,
        `😊 親密度: ${relationship.comfort_level}/100`,
        `💬 重要な会話: ${relationship.meaningful_interactions}回`,
        `🗣️ 話し方: ${relationship.preferred_formality}`
      ].join('\n'),
      inline: true
    };
  }

  buildBotPersonalityField(personality) {
    return {
      name: '🤖 ボットの基本人格 (Big Five)',
      value: [
        `🔍 開放性: ${personality.openness}/100`,
        `📋 誠実性: ${personality.conscientiousness}/100`,
        `👥 外向性: ${personality.extraversion}/100`,
        `🤗 協調性: ${personality.agreeableness}/100`,
        `😰 神経症傾向: ${personality.neuroticism}/100`,
        `😄 ユーモア: ${personality.humor_level}/100`
      ].join('\n'),
      inline: false
    };
  }

  async buildStatsField(userId) {
    const firstConversation = await pgPool.query(
      'SELECT created_at FROM conversations WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId]
    );

    let daysSinceFirst = 0;
    if (firstConversation.rows.length > 0) {
      const diffMs = Date.now() - new Date(firstConversation.rows[0].created_at).getTime();
      daysSinceFirst = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      name: '📊 統計情報',
      value: [
        `📅 関係開始: ${daysSinceFirst}日前`,
        `🔄 最終更新: ${this.formatDate(new Date())}`,
        `🧠 システム: v2.0 (VAD + 関係性)`
      ].join('\n'),
      inline: false
    };
  }

  // ユーティリティメソッド
  mapVADToEmotion(vad) {
    const { valence, arousal, dominance } = vad;
    
    if (valence >= 70 && arousal >= 70 && dominance >= 60) return 'excitement';
    if (valence >= 70 && arousal >= 50) return 'joy';
    if (valence >= 60 && arousal <= 40) return 'serenity';
    if (valence <= 30 && arousal >= 70 && dominance >= 60) return 'anger';
    if (valence <= 30 && arousal >= 70 && dominance <= 40) return 'fear';
    if (valence <= 30 && arousal <= 40) return 'sadness';
    if (valence >= 40 && valence <= 60 && arousal >= 70) return 'surprise';
    if (valence <= 35 && arousal >= 50 && dominance >= 50) return 'disgust';
    if (valence >= 60 && arousal <= 50 && dominance <= 50) return 'trust';
    if (valence >= 55 && arousal >= 60 && dominance >= 45) return 'anticipation';
    
    return 'neutral';
  }

  getEmotionEmoji(emotion) {
    const emojis = {
      excitement: '🎉', joy: '😊', serenity: '😌',
      anger: '😠', fear: '😨', sadness: '😢',
      surprise: '😲', disgust: '🤢', trust: '🤗',
      anticipation: '🤔', neutral: '😐'
    };
    return emojis[emotion] || '😐';
  }

  getRelationshipEmoji(stage) {
    const emojis = {
      stranger: '👋', acquaintance: '🙂', 
      friend: '😊', close_friend: '🥰'
    };
    return emojis[stage] || '👋';
  }

  getValenceEmoji(valence) {
    if (valence >= 80) return '😄';
    if (valence >= 60) return '🙂';
    if (valence >= 40) return '😐';
    if (valence >= 20) return '☹️';
    return '😢';
  }

  getArousalEmoji(arousal) {
    if (arousal >= 80) return '⚡';
    if (arousal >= 60) return '🔥';
    if (arousal >= 40) return '📊';
    return '😴';
  }

  getDominanceEmoji(dominance) {
    if (dominance >= 80) return '💪';
    if (dominance >= 60) return '👑';
    if (dominance >= 40) return '🤝';
    return '🤗';
  }

  getProgressBar(value) {
    const bars = Math.round(value / 10);
    const filled = '█'.repeat(Math.max(0, bars));
    const empty = '░'.repeat(Math.max(0, 10 - bars));
    return `${filled}${empty}`;
  }

  getEmbedColor(emotion, relationship) {
    if (!emotion) return 0x95a5a6;
    
    if (emotion.valence >= 70) return 0x2ecc71; // Green
    if (emotion.valence <= 30) return 0xe74c3c; // Red
    return 0x3498db; // Blue
  }

  formatDate(date) {
    return new Date(date).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  analyzeRecentPattern(conversations) {
    if (conversations.length === 0) return 'データなし';
    
    const avgLength = conversations.reduce((sum, c) => sum + c.user_message.length, 0) / conversations.length;
    const hasQuestions = conversations.some(c => c.user_message.includes('?') || c.user_message.includes('？'));
    const recentDays = Math.ceil((Date.now() - new Date(conversations[0].created_at).getTime()) / (1000 * 60 * 60 * 24));
    
    return [
      `平均メッセージ長: ${Math.round(avgLength)}文字`,
      `質問含有: ${hasQuestions ? 'あり' : 'なし'}`,
      `最新会話: ${recentDays}日前`
    ].join('\n');
  }
}

module.exports = { PersonalityCommandV2 };