/**
 * プロアクティブメッセージへの応答処理システム
 * 
 * プロアクティブメッセージに対するユーザーの応答を検出・処理し、
 * 適切なmessage_typeでデータベースに記録します。
 */
class ProactiveResponseHandler {
  constructor(pgPool, helpers) {
    this.pgPool = pgPool;
    this.helpers = helpers;
    
    // 応答追跡システム
    this.responseTracking = new Map(); // userId -> { lastProactiveMessageId, lastProactiveTime, isAwaitingResponse }
    
    // 応答統計
    this.stats = {
      responsesDetected: 0,
      responseTimeouts: 0,
      averageResponseTime: 0,
      lastResponseDetection: null
    };
    
    // 設定（環境変数から読み込み）
    this.config = {
      RESPONSE_WINDOW_MS: (parseInt(process.env.PROACTIVE_RESPONSE_WINDOW_HOURS) || 24) * 60 * 60 * 1000,
      CLEANUP_INTERVAL_MS: 60 * 60 * 1000,         // 1時間ごとにクリーンアップ（固定）
      MAX_TRACKING_ENTRIES: parseInt(process.env.PROACTIVE_MAX_TRACKING_ENTRIES) || 1000
    };
    
    // 定期クリーンアップ開始
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpiredTracking();
    }, this.config.CLEANUP_INTERVAL_MS);
    
    console.log('🎯 ProactiveResponseHandler 初期化完了');
  }

  /**
   * プロアクティブメッセージ送信時の追跡開始
   * @param {string} userId - ユーザーID
   * @param {string} messageId - 送信されたメッセージのID
   */
  startTrackingResponse(userId, messageId) {
    const trackingData = {
      lastProactiveMessageId: messageId,
      lastProactiveTime: new Date(),
      isAwaitingResponse: true,
      attempts: 0
    };
    
    this.responseTracking.set(userId, trackingData);
    
    console.log(`🎯 応答追跡開始 - User: ${userId}, MessageID: ${messageId}`);
    
    // メモリ使用量制限チェック
    if (this.responseTracking.size > this.config.MAX_TRACKING_ENTRIES) {
      this._cleanupExpiredTracking();
    }
  }

  /**
   * ユーザーメッセージが プロアクティブメッセージへの応答かどうか判定
   * @param {string} userId - ユーザーID
   * @param {string} userMessage - ユーザーのメッセージ
   * @param {Date} messageTime - メッセージ送信時刻
   * @returns {Promise<{isResponse: boolean, responseType: string, responseTime?: number}>}
   */
  async checkIfResponse(userId, userMessage, messageTime = new Date()) {
    try {
      // 1. 追跡データの確認
      const trackingData = this.responseTracking.get(userId);
      
      if (!trackingData || !trackingData.isAwaitingResponse) {
        // 追跡中でない場合は、データベースから直近のプロアクティブメッセージを確認
        return await this._checkDatabaseForRecentProactive(userId, messageTime);
      }
      
      // 2. 応答時間窓の確認
      const timeSinceProactive = messageTime.getTime() - trackingData.lastProactiveTime.getTime();
      
      if (timeSinceProactive > this.config.RESPONSE_WINDOW_MS) {
        // 応答時間窓を過ぎている
        this._updateTrackingAsTimedOut(userId);
        return { isResponse: false, responseType: 'timeout' };
      }
      
      // 3. 応答として検出
      this._updateTrackingAsResponded(userId, timeSinceProactive);
      
      console.log(`✅ プロアクティブ応答検出 - User: ${userId}, 応答時間: ${Math.round(timeSinceProactive / 1000)}秒`);
      
      return {
        isResponse: true,
        responseType: 'response_to_proactive',
        responseTime: timeSinceProactive,
        proactiveMessageId: trackingData.lastProactiveMessageId
      };
      
    } catch (error) {
      console.error('❌ 応答判定エラー:', error.message);
      return { isResponse: false, responseType: 'error' };
    }
  }

  /**
   * データベースから直近のプロアクティブメッセージを確認
   * @private
   */
  async _checkDatabaseForRecentProactive(userId, messageTime) {
    try {
      const result = await this.pgPool.query(
        `SELECT created_at, id
         FROM conversations 
         WHERE user_id = $1 
           AND message_type = 'proactive' 
           AND created_at > $2
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId, new Date(messageTime.getTime() - this.config.RESPONSE_WINDOW_MS)]
      );
      
      if (result.rows.length > 0) {
        const proactiveMsg = result.rows[0];
        const timeSinceProactive = messageTime.getTime() - new Date(proactiveMsg.created_at).getTime();
        
        // 既存の応答があるかチェック
        const responseCheck = await this.pgPool.query(
          `SELECT COUNT(*) as response_count
           FROM conversations 
           WHERE user_id = $1 
             AND message_type = 'response_to_proactive'
             AND created_at > $2`,
          [userId, proactiveMsg.created_at]
        );
        
        if (parseInt(responseCheck.rows[0].response_count) === 0) {
          console.log(`🔍 データベースから応答検出 - User: ${userId}, 応答時間: ${Math.round(timeSinceProactive / 1000)}秒`);
          
          return {
            isResponse: true,
            responseType: 'response_to_proactive',
            responseTime: timeSinceProactive
          };
        }
      }
      
      return { isResponse: false, responseType: 'no_recent_proactive' };
      
    } catch (error) {
      console.error('❌ データベース応答確認エラー:', error.message);
      return { isResponse: false, responseType: 'database_error' };
    }
  }

  /**
   * 応答追跡データを応答済みに更新
   * @private
   */
  _updateTrackingAsResponded(userId, responseTime) {
    const trackingData = this.responseTracking.get(userId);
    if (trackingData) {
      trackingData.isAwaitingResponse = false;
      trackingData.responseTime = responseTime;
      trackingData.respondedAt = new Date();
      
      // 統計更新
      this.stats.responsesDetected++;
      this.stats.averageResponseTime = 
        (this.stats.averageResponseTime * (this.stats.responsesDetected - 1) + responseTime) / this.stats.responsesDetected;
      this.stats.lastResponseDetection = new Date();
    }
  }

  /**
   * 応答追跡データをタイムアウトに更新
   * @private
   */
  _updateTrackingAsTimedOut(userId) {
    const trackingData = this.responseTracking.get(userId);
    if (trackingData) {
      trackingData.isAwaitingResponse = false;
      trackingData.timedOutAt = new Date();
      
      // 統計更新
      this.stats.responseTimeouts++;
    }
  }

  /**
   * 期限切れの追跡データをクリーンアップ
   * @private
   */
  _cleanupExpiredTracking() {
    const now = new Date();
    const expiredThreshold = now.getTime() - this.config.RESPONSE_WINDOW_MS;
    let cleanedCount = 0;
    
    for (const [userId, trackingData] of this.responseTracking.entries()) {
      if (trackingData.lastProactiveTime.getTime() < expiredThreshold) {
        this.responseTracking.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 応答追跡クリーンアップ - ${cleanedCount}件削除, 残り: ${this.responseTracking.size}件`);
    }
  }

  /**
   * ユーザーメッセージの保存（適切なmessage_typeで）
   * @param {string} userId - ユーザーID
   * @param {string} userMessage - ユーザーメッセージ
   * @param {string} botResponse - ボット応答
   * @param {Date} messageTime - メッセージ時刻
   * @returns {Promise<{success: boolean, messageType: string}>}
   */
  async saveUserMessage(userId, userMessage, botResponse, messageTime = new Date()) {
    try {
      // 応答種別の判定
      const responseCheck = await this.checkIfResponse(userId, userMessage, messageTime);
      
      let messageType = 'user_initiated'; // デフォルト
      
      if (responseCheck.isResponse) {
        messageType = responseCheck.responseType;
      }
      
      // データベースに保存
      const result = await this.pgPool.query(
        `INSERT INTO conversations (user_id, user_message, bot_response, message_type, initiator, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING id, created_at`,
        [userId, userMessage, botResponse, messageType, 'user', messageTime]
      );

      const savedRecord = result.rows[0];
      
      console.log(`✅ ユーザーメッセージ保存 - ID: ${savedRecord.id}, タイプ: ${messageType}, 応答時間: ${responseCheck.responseTime ? Math.round(responseCheck.responseTime / 1000) + '秒' : 'N/A'}`);
      
      return {
        success: true,
        messageType,
        conversationId: savedRecord.id,
        responseTime: responseCheck.responseTime
      };

    } catch (error) {
      console.error('❌ ユーザーメッセージ保存失敗:', error.message);
      return {
        success: false,
        error: error.message,
        messageType: 'error'
      };
    }
  }

  /**
   * 現在追跡中のユーザー一覧を取得
   */
  getCurrentlyTracked() {
    const tracked = [];
    
    for (const [userId, data] of this.responseTracking.entries()) {
      if (data.isAwaitingResponse) {
        const elapsedMs = Date.now() - data.lastProactiveTime.getTime();
        tracked.push({
          userId,
          messageId: data.lastProactiveMessageId,
          elapsedHours: Math.round(elapsedMs / (1000 * 60 * 60) * 10) / 10,
          isExpiringSoon: elapsedMs > (this.config.RESPONSE_WINDOW_MS * 0.8)
        });
      }
    }
    
    return tracked.sort((a, b) => b.elapsedHours - a.elapsedHours);
  }

  /**
   * 応答統計の取得
   */
  getStats() {
    const currentlyTracked = this.getCurrentlyTracked();
    
    return {
      responsesDetected: this.stats.responsesDetected,
      responseTimeouts: this.stats.responseTimeouts,
      averageResponseTime: Math.round(this.stats.averageResponseTime),
      lastResponseDetection: this.stats.lastResponseDetection,
      currentlyTracking: currentlyTracked.length,
      trackingDetails: currentlyTracked,
      responseRate: this.stats.responsesDetected + this.stats.responseTimeouts > 0
        ? ((this.stats.responsesDetected / (this.stats.responsesDetected + this.stats.responseTimeouts)) * 100).toFixed(1)
        : '0.0'
    };
  }

  /**
   * 統計リセット
   */
  resetStats() {
    const oldStats = this.getStats();
    this.stats = {
      responsesDetected: 0,
      responseTimeouts: 0,
      averageResponseTime: 0,
      lastResponseDetection: null
    };
    console.log('📊 応答処理統計をリセット');
    return oldStats;
  }

  /**
   * 手動での応答追跡停止
   */
  stopTracking(userId) {
    const removed = this.responseTracking.delete(userId);
    if (removed) {
      console.log(`🛑 応答追跡手動停止 - User: ${userId}`);
    }
    return removed;
  }

  /**
   * 全追跡データの強制クリーンアップ
   */
  clearAllTracking() {
    const count = this.responseTracking.size;
    this.responseTracking.clear();
    console.log(`🧹 全応答追跡データをクリア - ${count}件削除`);
    return count;
  }

  /**
   * リソースクリーンアップ（終了時）
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    const trackingCount = this.responseTracking.size;
    this.responseTracking.clear();
    
    console.log(`🧹 ProactiveResponseHandler クリーンアップ完了 - ${trackingCount}件の追跡データを削除`);
  }
}

module.exports = { ProactiveResponseHandler };