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
      // エンハンスド会話履歴の取得
      context.conversationHistory = await this._collectEnhancedConversationHistory(userId);
      context.summary.conversationCount = context.conversationHistory.length;

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
        // 人格システムから現在の感情状態を取得
        const { vadEmotionManager } = require('../personality/vad-emotion');
        const { relationshipManager } = require('../personality/relationship-manager');

        const [emotionState, relationshipState] = await Promise.all([
          vadEmotionManager.getCurrentEmotion(userId),
          relationshipManager.getRelationship(userId)
        ]);

        context.personalityState = {
          emotion: emotionState,
          relationship: relationshipState,
          systemVersion: 'v2.0'
        };
        context.summary.hasPersonality = !!(emotionState || relationshipState);
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
      console.log(`🔍 プロンプト詳細（先頭500文字）: "${finalPrompt.substring(0, 500)}..."`);

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

    try {
      // VAD感情データが存在するかチェック
      if (!personalityState.emotion || !personalityState.emotion.vad) {
        return `## 現在の人格状態
関係性レベル: ${personalityState.relationship?.relationship_stage || '不明'}
現在の感情状態: データなし（自然な調子で話しかけてください）`;
      }

      const { valence, arousal, dominance } = personalityState.emotion.vad;

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

関係性レベル: ${personalityState.relationship?.relationship_stage || '不明'}`;
    } catch (error) {
      console.warn('⚠️ 人格拡張構築エラー:', error.message);
      return '';
    }
  }

  /**
   * エンハンスド会話履歴の整形
   * @private
   */
  _formatConversationHistory(history) {
    if (!history || history.length === 0) {
      return '（会話履歴なし）';
    }

    console.log(`📝 会話履歴整形開始: ${history.length}件`);

    // 重要度別に分類
    const importantConvs = history.filter(conv => conv.source === 'important' || conv.score >= 5);
    const recentConvs = history.filter(conv => conv.source === 'recent' && conv.score < 5);
    const memoryConvs = history.filter(conv => conv.source === 'memory_related');

    let formattedHistory = '';

    // 重要な会話セクション
    if (importantConvs.length > 0) {
      formattedHistory += '【重要な会話】\n';
      importantConvs.slice(0, 3).forEach(conv => {
        const timeAgo = this._getTimeAgo(new Date(conv.created_at));
        const sentiment = conv.sentiment ? `(${conv.sentiment})` : '';
        formattedHistory += `[${timeAgo}] ${sentiment} ユーザー: "${this._truncateText(conv.user_message, 35)}" → ボット: "${this._truncateText(conv.bot_response, 35)}"\n`;
      });
      formattedHistory += '\n';
    }

    // 記憶関連会話セクション
    if (memoryConvs.length > 0) {
      formattedHistory += '【記憶関連会話】\n';
      memoryConvs.slice(0, 2).forEach(conv => {
        const timeAgo = this._getTimeAgo(new Date(conv.created_at));
        formattedHistory += `[${timeAgo}] ユーザー: "${this._truncateText(conv.user_message, 30)}" → ボット: "${this._truncateText(conv.bot_response, 30)}"\n`;
      });
      formattedHistory += '\n';
    }

    // 直近の会話セクション
    if (recentConvs.length > 0) {
      formattedHistory += '【最近の会話】\n';
      recentConvs.slice(-2).forEach(conv => {
        const timeAgo = this._getTimeAgo(new Date(conv.created_at));
        formattedHistory += `[${timeAgo}] ユーザー: "${this._truncateText(conv.user_message, 30)}" → ボット: "${this._truncateText(conv.bot_response, 30)}"\n`;
      });
    }

    // フォールバック: 通常履歴がない場合
    if (!formattedHistory.trim()) {
      const latest = history.slice(-3);
      formattedHistory = latest.map(conv => {
        const timeAgo = this._getTimeAgo(new Date(conv.created_at));
        return `[${timeAgo}] ユーザー: "${this._truncateText(conv.user_message, 40)}" → ボット: "${this._truncateText(conv.bot_response, 40)}"`;
      }).join('\n');
    }

    console.log(`✅ 会話履歴整形完了: ${formattedHistory.length}文字`);
    return formattedHistory.trim();
  }

  /**
   * テキスト省略ヘルパー
   * @private
   */
  _truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
   * エンハンスド会話履歴収集
   * 重要度・関連性・時系列を考慮した会話履歴を収集
   * @param {string} userId - ユーザーID
   * @param {number} totalLimit - 総履歴数制限（デフォルト: 12）
   * @returns {Promise<Array>} エンハンスドな会話履歴配列
   * @private
   */
  async _collectEnhancedConversationHistory(userId, totalLimit = 12) {
    console.log('🧠 エンハンスド会話履歴収集開始...');

    try {
      const enhancedHistory = [];

      // 1. 直近の重要な会話（conversation_analysis から）
      const importantConversations = await this._getImportantConversations(userId, 6);
      enhancedHistory.push(...importantConversations);
      console.log(`📈 重要な会話: ${importantConversations.length}件`);

      // 2. 直近の一般会話（基本履歴）
      const recentConversations = await this._getRecentConversations(userId, 4);
      enhancedHistory.push(...recentConversations);
      console.log(`⏰ 直近の会話: ${recentConversations.length}件`);

      // 3. 記憶システムから関連する会話
      const memoryBasedConversations = await this._getMemoryRelatedConversations(userId, 2);
      enhancedHistory.push(...memoryBasedConversations);
      console.log(`🧠 記憶関連会話: ${memoryBasedConversations.length}件`);

      // 4. 重複排除・スコア順ソート・制限適用
      const uniqueHistory = this._deduplicateAndScore(enhancedHistory, totalLimit);

      console.log(`✅ エンハンスド履歴収集完了: ${uniqueHistory.length}件`);
      return uniqueHistory;

    } catch (error) {
      console.error('❌ エンハンスド履歴収集エラー:', error.message);
      // フォールバック: 従来の方式
      return await this._getFallbackHistory(userId, totalLimit);
    }
  }

  /**
   * 重要な会話の取得（conversation_analysis基準）
   * @private
   */
  async _getImportantConversations(userId, limit) {
    try {
      const result = await this.pgPool.query(
        `SELECT c.user_message, c.bot_response, c.created_at, c.message_type,
                ca.importance_score, ca.sentiment, ca.topic_category
         FROM conversations c
         JOIN conversation_analysis ca ON c.user_id = ca.user_id 
           AND c.user_message = ca.user_message
         WHERE c.user_id = $1 
           AND c.message_type != 'proactive'
           AND ca.importance_score >= 5
           AND ca.confidence_score >= 0.6
         ORDER BY ca.importance_score DESC, c.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        ...row,
        source: 'important',
        score: row.importance_score || 5
      }));
    } catch (error) {
      console.warn('⚠️ 重要な会話取得失敗:', error.message);
      return [];
    }
  }

  /**
   * 直近の一般会話取得
   * @private
   */
  async _getRecentConversations(userId, limit) {
    try {
      const result = await this.pgPool.query(
        `SELECT user_message, bot_response, created_at, message_type
         FROM conversations 
         WHERE user_id = $1 
           AND message_type != 'proactive'
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        ...row,
        source: 'recent',
        score: 3 // 基本スコア
      }));
    } catch (error) {
      console.warn('⚠️ 直近会話取得失敗:', error.message);
      return [];
    }
  }

  /**
   * 記憶関連会話の取得
   * @private
   */
  async _getMemoryRelatedConversations(userId, limit) {
    try {
      // 高重要度の記憶からキーワード抽出
      const memoryResult = await this.pgPool.query(
        `SELECT keywords, content, importance_score
         FROM user_memories 
         WHERE user_id = $1 
           AND importance_score >= 4
           AND memory_type IN ('important_event', 'fact', 'preference')
         ORDER BY importance_score DESC, created_at DESC
         LIMIT 5`,
        [userId]
      );

      if (memoryResult.rows.length === 0) return [];

      // キーワードを集約
      const allKeywords = memoryResult.rows
        .flatMap(row => row.keywords || [])
        .filter(keyword => keyword && keyword.length > 1);

      if (allKeywords.length === 0) return [];

      // キーワードマッチする会話を検索
      const conversationResult = await this.pgPool.query(
        `SELECT user_message, bot_response, created_at, message_type
         FROM conversations 
         WHERE user_id = $1 
           AND message_type != 'proactive'
           AND (user_message ILIKE ANY($2) OR bot_response ILIKE ANY($2))
         ORDER BY created_at DESC
         LIMIT $3`,
        [userId, allKeywords.map(k => `%${k}%`), limit]
      );

      return conversationResult.rows.map(row => ({
        ...row,
        source: 'memory_related',
        score: 4 // 記憶関連は高スコア
      }));
    } catch (error) {
      console.warn('⚠️ 記憶関連会話取得失敗:', error.message);
      return [];
    }
  }

  /**
   * 重複排除・スコア計算・制限適用
   * @private
   */
  _deduplicateAndScore(conversations, limit) {
    // 重複排除（user_message + created_at でユニーク化）
    const uniqueMap = new Map();

    conversations.forEach(conv => {
      const key = `${conv.user_message}_${conv.created_at}`;
      const existing = uniqueMap.get(key);

      if (!existing || existing.score < conv.score) {
        uniqueMap.set(key, conv);
      }
    });

    // スコア順でソート、時系列順に変換
    const sortedConversations = Array.from(uniqueMap.values())
      .sort((a, b) => {
        // 1. スコア順 2. 新しさ順
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, limit)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // 古い順に並び替え

    return sortedConversations;
  }

  /**
   * フォールバック履歴取得（従来方式）
   * @private
   */
  async _getFallbackHistory(userId, limit) {
    try {
      const result = await this.pgPool.query(
        `SELECT user_message, bot_response, created_at, message_type
         FROM conversations 
         WHERE user_id = $1 AND message_type != 'proactive'
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.reverse().map(row => ({
        ...row,
        source: 'fallback',
        score: 2
      }));
    } catch (error) {
      console.error('❌ フォールバック履歴取得失敗:', error.message);
      return [];
    }
  }

  /**
   * AI でメッセージ生成
   * @private
   */
  async _generateWithAI(prompt, context) {
    console.log('🚀 Gemini APIでメッセージ生成中...');

    try {
      // Gemini を使用（固定設定）
      const { HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        systemInstruction: prompt.systemInstruction,
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.95,
          topP: 0.9
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_NONE
          }
        ]
      });

      // リトライ機能付きでAPI呼び出し
      const result = await retryGeminiApiCall(
        async () => await model.generateContent(prompt.userPrompt),
        '🤖 プロアクティブメッセージ生成',
        { maxRetries: 3, baseDelay: 1000, maxDelay: 5000 }
      );

      // Gemini応答の詳細ログ
      console.log('🔍 Gemini応答詳細:', {
        candidates: result.response.candidates?.length || 0,
        safetyRatings: result.response.candidates?.[0]?.safetyRatings,
        finishReason: result.response.candidates?.[0]?.finishReason,
        blocked: result.response.promptFeedback?.blockReason
      });

      const generatedText = result.response.text();
      console.log(`🔍 生成された元テキスト: "${generatedText}" (長さ: ${generatedText?.length || 0}文字)`);

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

    console.log(`🔍 後処理前: "${text}" (長さ: ${text.length}文字)`);

    // 基本的なクリーンアップ
    let processed = text
      .trim()
      .replace(/^#+\s*/, '') // マークダウンヘッダー削除
      .replace(/```[\s\S]*?```/g, '') // コードブロック削除
      .replace(/\*\*(.*?)\*\*/g, '$1') // 太字マークダウン削除
      .replace(/\*(.*?)\*/g, '$1') // イタリック削除
      .trim();

    console.log(`🔍 後処理中: "${processed}" (長さ: ${processed.length}文字)`);

    // 長すぎる場合は短縮
    if (processed.length > 200) {
      processed = processed.substring(0, 197) + '...';
    }

    // 空の場合はフォールバック
    if (!processed) {
      console.error(`❌ 後処理後に空文字: 元テキスト="${text}"`);
      throw new Error('後処理後にメッセージが空になりました');
    }

    console.log(`🔍 後処理後: "${processed}" (長さ: ${processed.length}文字)`);
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