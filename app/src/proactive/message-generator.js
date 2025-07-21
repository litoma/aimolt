const { prompts } = require('../prompt');
const { personalityManagerV2 } = require('../personality/manager-v2');
const AimoltProfileSync = require('../profile-sync');
const { retryGeminiApiCall } = require('../utils/retry');

/**
 * プロアクティブメッセージ生成エンジン
 * 
 * AI（Gemini）を使用して、過去の会話履歴・ユーザープロファイル・
 * v2.0人格システム・話題キーワードを基に自然なプロアクティブメッセージを生成
 */
class MessageGenerator {
  constructor(pgPool, genAI) {
    this.pgPool = pgPool;
    this.genAI = genAI;
    this.profileSync = new AimoltProfileSync();
    
    // 生成統計
    this.stats = {
      generated: 0,
      errors: 0,
      lastGeneration: null,
      averageGenerationTime: 0
    };
  }

  /**
   * プロアクティブメッセージを生成
   * @param {string} userId - ターゲットユーザーID
   * @param {Object} helpers - ProactiveDatabaseHelpers インスタンス
   * @returns {Promise<{success: boolean, message?: string, error?: string, metadata?: Object}>}
   */
  async generateProactiveMessage(userId, helpers) {
    const startTime = Date.now();
    console.log(`🎯 プロアクティブメッセージ生成開始 - User: ${userId}`);

    try {
      // 1. コンテキスト情報の収集
      const context = await this._collectContext(userId, helpers);
      
      // 2. AI プロンプトの構築
      const prompt = await this._buildAIPrompt(context);
      
      // 3. Gemini API でメッセージ生成
      const generatedMessage = await this._generateWithAI(prompt, context);
      
      // 4. 生成後処理
      const processingTime = Date.now() - startTime;
      this._updateStats(processingTime, true);
      
      console.log(`✅ プロアクティブメッセージ生成成功 (${processingTime}ms)`);
      
      return {
        success: true,
        message: generatedMessage.content,
        metadata: {
          generationTime: processingTime,
          context: context.summary,
          aiModel: generatedMessage.model,
          timestamp: new Date()
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this._updateStats(processingTime, false);
      
      console.error(`❌ プロアクティブメッセージ生成失敗 (${processingTime}ms):`, error.message);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          generationTime: processingTime,
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * コンテキスト情報の収集
   * @private
   */
  async _collectContext(userId, helpers) {
    console.log('📊 コンテキスト情報収集中...');
    
    const context = {
      userId,
      timestamp: new Date(),
      conversationHistory: [],
      recentTopics: [],
      userProfile: null,
      personalityState: null,
      proactiveStats: null,
      summary: {}
    };

    try {
      // 会話履歴の取得（直近20件）
      const historyResult = await this.pgPool.query(
        `SELECT user_message, bot_response, created_at, message_type 
         FROM conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 20`,
        [userId]
      );
      
      context.conversationHistory = historyResult.rows.reverse(); // 古い順に並び替え
      context.summary.conversationCount = historyResult.rows.length;

      // 話題キーワードの取得
      context.recentTopics = await helpers.getRecentTopicKeywords(userId, 14); // 過去2週間
      context.summary.topicCount = context.recentTopics.length;

      // プロアクティブ統計の取得
      context.proactiveStats = await helpers.getProactiveStats(userId);
      context.summary.responseRate = context.proactiveStats.responseRate;

      // ユーザープロファイルの取得
      try {
        context.userProfile = await this.profileSync.getProfile();
        context.summary.hasProfile = !!context.userProfile;
      } catch (error) {
        console.warn('⚠️ プロファイル取得失敗:', error.message);
        context.summary.hasProfile = false;
      }

      // v2.0人格システム状態の取得
      try {
        context.personalityState = await personalityManagerV2.getCurrentPersonality(userId);
        context.summary.hasPersonality = !!context.personalityState;
      } catch (error) {
        console.warn('⚠️ 人格システム状態取得失敗:', error.message);
        context.summary.hasPersonality = false;
      }

      console.log('✅ コンテキスト収集完了:', context.summary);
      return context;

    } catch (error) {
      console.error('❌ コンテキスト収集エラー:', error.message);
      throw new Error(`コンテキスト収集失敗: ${error.message}`);
    }
  }

  /**
   * AI プロンプトの構築
   * @private
   */
  async _buildAIPrompt(context) {
    console.log('🧠 AIプロンプト構築中...');

    try {
      // システム指示を取得
      const systemInstruction = await prompts.getSystem();
      
      // ベースプロンプト構築
      let proactivePrompt = await this._buildBasePrompt(context);
      
      // プロファイル拡張
      if (context.userProfile) {
        const profileExtension = this._buildProfileExtension(context.userProfile);
        proactivePrompt += `\n\n${profileExtension}`;
      }
      
      // 人格システム拡張
      if (context.personalityState) {
        const personalityExtension = this._buildPersonalityExtension(context.personalityState);
        proactivePrompt += `\n\n${personalityExtension}`;
      }
      
      // 会話履歴の整形
      const historyContext = this._formatConversationHistory(context.conversationHistory);
      
      // 話題キーワード整形
      const topicsContext = this._formatRecentTopics(context.recentTopics);

      // 最終プロンプト構築
      const finalPrompt = `${proactivePrompt}

## 会話履歴コンテキスト
${historyContext}

## 最近の話題キーワード
${topicsContext}

## プロアクティブメッセージ生成指示
ユーザー（${context.userId}）に自然な形で話しかけるプロアクティブメッセージを生成してください。

要求事項:
1. 過去の会話内容を参考にした親しみやすい話題
2. 最近の話題キーワードを活用（強制ではない）
3. ユーザープロファイルに基づいた個人化（利用可能な場合）
4. 現在の人格状態に合った口調・感情表現
5. 200文字以内で簡潔に
6. 自然な会話の流れになるような内容

メッセージを生成してください:`;

      console.log(`✅ AIプロンプト構築完了 (${finalPrompt.length}文字)`);
      
      return {
        systemInstruction,
        userPrompt: finalPrompt,
        context: context.summary
      };

    } catch (error) {
      console.error('❌ プロンプト構築エラー:', error.message);
      throw new Error(`プロンプト構築失敗: ${error.message}`);
    }
  }

  /**
   * ベースプロンプトの構築
   * @private
   */
  async _buildBasePrompt(context) {
    const basePrompt = `# プロアクティブメッセージ生成

あなたはAImoltという名前のDiscordボットです。ユーザーとの自然な会話を重視し、
親しみやすく、時にユーモラスで、相手のことを気にかける性格です。

現在、ユーザーに対してプロアクティブ（ボット主導）でメッセージを送信するタイミングです。
これまでの会話履歴と関係性を基に、自然で親しみやすいメッセージを生成してください。

## 統計情報
- 過去のプロアクティブ送信: ${context.proactiveStats?.proactiveCount || 0}回
- ユーザー応答率: ${context.proactiveStats?.responseRate || 0}%
- 最近の会話頻度: ${context.summary.conversationCount}件`;

    return basePrompt;
  }

  /**
   * プロファイル拡張の構築
   * @private
   */
  _buildProfileExtension(profile) {
    if (!profile || !profile.bio) return '';

    return `## ユーザープロファイル情報
ユーザーの技術的背景や興味関心:
${profile.bio.substring(0, 300)}...

この情報を参考に、ユーザーの関心に合った話題を選択してください。`;
  }

  /**
   * 人格システム拡張の構築
   * @private
   */
  _buildPersonalityExtension(personalityState) {
    if (!personalityState) return '';

    const { valence, arousal, dominance } = personalityState.vad;
    
    let moodDescription = '';
    if (valence > 0.5) moodDescription += 'ポジティブな気分で ';
    if (valence < -0.5) moodDescription += 'ネガティブな気分で ';
    if (arousal > 0.5) moodDescription += '活発に ';
    if (arousal < -0.5) moodDescription += '落ち着いて ';
    if (dominance > 0.5) moodDescription += '自信を持って ';
    if (dominance < -0.5) moodDescription += '控えめに ';

    return `## 現在の人格状態
VAD感情モデル: V=${valence.toFixed(2)}, A=${arousal.toFixed(2)}, D=${dominance.toFixed(2)}
推奨な口調: ${moodDescription || '自然な調子で'}話しかけてください。

関係性レベル: ${personalityState.relationshipLevel || '不明'}`;
  }

  /**
   * 会話履歴の整形
   * @private
   */
  _formatConversationHistory(history) {
    if (!history || history.length === 0) {
      return '（会話履歴なし）';
    }

    // 直近5件の会話を要約
    const recentHistory = history.slice(-5).map((conv, index) => {
      const timeAgo = this._getTimeAgo(new Date(conv.created_at));
      return `[${timeAgo}] ユーザー: "${conv.user_message.substring(0, 50)}..." → ボット: "${conv.bot_response.substring(0, 50)}..."`;
    });

    return recentHistory.join('\n');
  }

  /**
   * 話題キーワードの整形
   * @private
   */
  _formatRecentTopics(topics) {
    if (!topics || topics.length === 0) {
      return '（最近の話題キーワードなし）';
    }

    return topics.slice(0, 5).map(topic => 
      `"${topic.keyword}" (${topic.count}回)`
    ).join(', ');
  }

  /**
   * AI でメッセージ生成
   * @private
   */
  async _generateWithAI(prompt, context) {
    console.log('🚀 Gemini APIでメッセージ生成中...');

    try {
      // Gemini を使用（環境変数から設定読み込み）
      const model = this.genAI.getGenerativeModel({
        model: process.env.PROACTIVE_AI_MODEL || 'gemini-2.0-flash-exp',
        systemInstruction: prompt.systemInstruction,
        generationConfig: {
          maxOutputTokens: parseInt(process.env.PROACTIVE_MAX_OUTPUT_TOKENS) || 300,
          temperature: parseFloat(process.env.PROACTIVE_TEMPERATURE) || 0.8,
          topP: 0.9
        }
      });

      // リトライ機能付きでAPI呼び出し
      const result = await retryGeminiApiCall(
        async () => await model.generateContent(prompt.userPrompt),
        '🤖 プロアクティブメッセージ生成',
        { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 }
      );

      const generatedText = result.response.text();
      
      // 生成されたテキストの後処理
      const processedMessage = this._postProcessMessage(generatedText);

      console.log(`✅ メッセージ生成完了: "${processedMessage.substring(0, 50)}..."`);

      return {
        content: processedMessage,
        model: 'gemini-2.0-flash-exp',
        originalLength: generatedText.length,
        processedLength: processedMessage.length
      };

    } catch (error) {
      console.error('❌ AI生成エラー:', error.message);
      throw new Error(`AI生成失敗: ${error.message}`);
    }
  }

  /**
   * 生成後メッセージの後処理
   * @private
   */
  _postProcessMessage(text) {
    if (!text) throw new Error('空のメッセージが生成されました');

    // 基本的なクリーンアップ
    let processed = text
      .trim()
      .replace(/^#+\s*/, '') // マークダウンヘッダー削除
      .replace(/```[\s\S]*?```/g, '') // コードブロック削除
      .replace(/\*\*(.*?)\*\*/g, '$1') // 太字マークダウン削除
      .replace(/\*(.*?)\*/g, '$1') // イタリック削除
      .trim();

    // 長すぎる場合は短縮
    if (processed.length > 200) {
      processed = processed.substring(0, 197) + '...';
    }

    // 空の場合はフォールバック
    if (!processed) {
      throw new Error('後処理後にメッセージが空になりました');
    }

    return processed;
  }

  /**
   * 統計の更新
   * @private
   */
  _updateStats(processingTime, success) {
    this.stats.lastGeneration = new Date();
    
    if (success) {
      this.stats.generated++;
      // 移動平均でprocessingTimeを更新
      this.stats.averageGenerationTime = 
        (this.stats.averageGenerationTime * (this.stats.generated - 1) + processingTime) / this.stats.generated;
    } else {
      this.stats.errors++;
    }
  }

  /**
   * 時間差を人間にわかりやすい形で返す
   * @private
   */
  _getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}日前`;
    if (diffHours > 0) return `${diffHours}時間前`;
    return '1時間以内';
  }

  /**
   * 生成統計の取得
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.generated > 0 
        ? ((this.stats.generated / (this.stats.generated + this.stats.errors)) * 100).toFixed(1)
        : '0.0'
    };
  }

  /**
   * 統計のリセット
   */
  resetStats() {
    const oldStats = { ...this.stats };
    this.stats = {
      generated: 0,
      errors: 0,
      lastGeneration: null,
      averageGenerationTime: 0
    };
    return oldStats;
  }
}

module.exports = { MessageGenerator };