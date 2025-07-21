const { Pool } = require('pg');

/**
 * プロアクティブメッセージ機能用のデータベースヘルパー関数群
 */
class ProactiveDatabaseHelpers {
  constructor(pgPool) {
    this.pgPool = pgPool;
  }

  /**
   * 最後の会話時刻を取得
   * @param {string} userId - ユーザーID
   * @returns {Promise<Date>} 最後の会話時刻
   */
  async getLastConversationTime(userId) {
    try {
      const result = await this.pgPool.query(
        `SELECT MAX(created_at) as last_conversation 
         FROM conversations 
         WHERE user_id = $1 AND message_type != 'proactive'`,
        [userId]
      );
      
      const lastTime = result.rows[0]?.last_conversation;
      return lastTime ? new Date(lastTime) : new Date(0); // 会話履歴がない場合は1970年
    } catch (error) {
      console.error('Error getting last conversation time:', error.message);
      return new Date(0);
    }
  }

  /**
   * 最後のプロアクティブメッセージ時刻を取得
   * @param {string} userId - ユーザーID  
   * @returns {Promise<Date>} 最後のプロアクティブメッセージ時刻
   */
  async getLastProactiveMessageTime(userId) {
    try {
      const result = await this.pgPool.query(
        `SELECT MAX(created_at) as last_proactive 
         FROM conversations 
         WHERE user_id = $1 AND message_type = 'proactive'`,
        [userId]
      );
      
      const lastTime = result.rows[0]?.last_proactive;
      return lastTime ? new Date(lastTime) : new Date(0); // プロアクティブ送信履歴がない場合は1970年
    } catch (error) {
      console.error('Error getting last proactive message time:', error.message);
      return new Date(0);
    }
  }

  /**
   * プロアクティブメッセージを会話履歴として保存
   * @param {string} userId - ユーザーID
   * @param {string} message - プロアクティブメッセージ内容
   * @returns {Promise<boolean>} 保存成功可否
   */
  async saveProactiveMessage(userId, message) {
    try {
      const result = await this.pgPool.query(
        `INSERT INTO conversations (user_id, user_message, bot_response, message_type, initiator, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id, created_at`,
        [userId, '[PROACTIVE]', message, 'proactive', 'bot']
      );

      const savedRecord = result.rows[0];
      console.log(`✅ プロアクティブメッセージ保存成功 - ID: ${savedRecord.id}, 時刻: ${savedRecord.created_at}`);
      
      return true;
    } catch (error) {
      console.error('❌ プロアクティブメッセージ保存失敗:', error.message);
      return false;
    }
  }

  /**
   * ユーザーの応答を適切なmessage_typeで保存
   * @param {string} userId - ユーザーID
   * @param {string} userMessage - ユーザーメッセージ
   * @param {string} botResponse - ボット応答
   * @returns {Promise<boolean>} 保存成功可否
   */
  async saveUserResponse(userId, userMessage, botResponse) {
    try {
      // 直前のメッセージがプロアクティブかどうか確認
      const lastMessageResult = await this.pgPool.query(
        `SELECT message_type 
         FROM conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      let messageType = 'user_initiated'; // デフォルト
      
      if (lastMessageResult.rows.length > 0) {
        const lastMessageType = lastMessageResult.rows[0].message_type;
        if (lastMessageType === 'proactive') {
          messageType = 'response_to_proactive';
        }
      }

      const result = await this.pgPool.query(
        `INSERT INTO conversations (user_id, user_message, bot_response, message_type, initiator, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id, created_at`,
        [userId, userMessage, botResponse, messageType, 'user']
      );

      const savedRecord = result.rows[0];
      console.log(`✅ ユーザー応答保存成功 - ID: ${savedRecord.id}, タイプ: ${messageType}, 時刻: ${savedRecord.created_at}`);
      
      return true;
    } catch (error) {
      console.error('❌ ユーザー応答保存失敗:', error.message);
      return false;
    }
  }

  /**
   * プロアクティブメッセージ統計を取得
   * @param {string} userId - ユーザーID
   * @returns {Promise<Object>} 統計情報
   */
  async getProactiveStats(userId) {
    try {
      const result = await this.pgPool.query(
        `SELECT 
           COUNT(CASE WHEN message_type = 'proactive' THEN 1 END) as proactive_count,
           COUNT(CASE WHEN message_type = 'response_to_proactive' THEN 1 END) as response_count,
           COUNT(CASE WHEN message_type = 'user_initiated' THEN 1 END) as user_initiated_count,
           MAX(CASE WHEN message_type = 'proactive' THEN created_at END) as last_proactive,
           MAX(created_at) as last_conversation
         FROM conversations 
         WHERE user_id = $1`,
        [userId]
      );

      const stats = result.rows[0];
      const responseRate = stats.proactive_count > 0 
        ? (parseInt(stats.response_count) / parseInt(stats.proactive_count) * 100).toFixed(1)
        : '0.0';

      return {
        proactiveCount: parseInt(stats.proactive_count) || 0,
        responseCount: parseInt(stats.response_count) || 0,
        userInitiatedCount: parseInt(stats.user_initiated_count) || 0,
        responseRate: parseFloat(responseRate),
        lastProactive: stats.last_proactive ? new Date(stats.last_proactive) : null,
        lastConversation: stats.last_conversation ? new Date(stats.last_conversation) : null
      };
    } catch (error) {
      console.error('Error getting proactive stats:', error.message);
      return {
        proactiveCount: 0,
        responseCount: 0, 
        userInitiatedCount: 0,
        responseRate: 0.0,
        lastProactive: null,
        lastConversation: null
      };
    }
  }

  /**
   * 過去の会話から話題キーワードを抽出
   * @param {string} userId - ユーザーID
   * @param {number} days - 過去何日分を対象にするか（デフォルト: 30日）
   * @returns {Promise<Array>} 話題キーワード配列
   */
  async getRecentTopicKeywords(userId, days = 30) {
    try {
      const result = await this.pgPool.query(
        `SELECT user_message, bot_response 
         FROM conversations 
         WHERE user_id = $1 
           AND created_at >= NOW() - INTERVAL '${days} days'
           AND message_type != 'proactive'  -- プロアクティブメッセージは除外
         ORDER BY created_at DESC 
         LIMIT 50`, // 最新50件を分析対象
        [userId]
      );

      if (result.rows.length === 0) {
        return [];
      }

      // 簡単なキーワード抽出（実際にはより高度な処理が可能）
      const allText = result.rows.map(row => `${row.user_message} ${row.bot_response}`).join(' ');
      
      // 日本語の一般的な話題キーワードを抽出（簡易版）
      const keywords = allText
        .match(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]{2,}/g) // 漢字2文字以上
        ?.filter(keyword => keyword.length >= 2 && keyword.length <= 8) // 2-8文字
        ?.reduce((acc, keyword) => {
          acc[keyword] = (acc[keyword] || 0) + 1;
          return acc;
        }, {});

      if (!keywords) return [];

      // 頻度順でソートして上位10個を返す
      return Object.entries(keywords)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }));

    } catch (error) {
      console.error('Error getting topic keywords:', error.message);
      return [];
    }
  }
}

module.exports = { ProactiveDatabaseHelpers };