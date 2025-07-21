/**
 * Discord送信システム
 * 
 * プロアクティブメッセージのDiscord送信と関連する処理を担当します。
 * - メッセージ送信の実行
 * - 送信エラーのハンドリング
 * - タイピング表示の管理
 * - 送信統計の追跡
 */
class DiscordSender {
  constructor() {
    // 送信統計
    this.stats = {
      messagesSent: 0,
      sendErrors: 0,
      lastSend: null,
      averageSendTime: 0,
      channelTargets: new Map() // チャンネル別送信回数
    };
    
    // タイピング管理
    this.typingIntervals = new Map();
    
    // 設定（環境変数から読み込み）
    this.config = {
      MAX_MESSAGE_LENGTH: parseInt(process.env.PROACTIVE_MAX_MESSAGE_LENGTH) || 2000,
      TYPING_DURATION_MS: parseInt(process.env.PROACTIVE_TYPING_DURATION_MS) || 3000,
      TYPING_INTERVAL_MS: 9000,      // 固定（Discordの仕様）
      SEND_TIMEOUT_MS: parseInt(process.env.PROACTIVE_SEND_TIMEOUT_MS) || 10000,
      RETRY_ATTEMPTS: parseInt(process.env.PROACTIVE_RETRY_ATTEMPTS) || 3,
      RETRY_DELAY_MS: 1000           // 固定
    };
  }

  /**
   * プロアクティブメッセージをDiscordに送信
   * @param {TextChannel} channel - 送信先チャンネル
   * @param {string} message - 送信メッセージ
   * @param {Object} options - 送信オプション
   * @returns {Promise<{success: boolean, messageId?: string, error?: string, metadata?: Object}>}
   */
  async sendProactiveMessage(channel, message, options = {}) {
    const startTime = Date.now();
    const channelId = channel.id;
    const channelName = channel.name;
    
    console.log(`📤 Discord送信開始 - Channel: #${channelName} (${channelId})`);
    
    try {
      // 1. メッセージの前処理
      const processedMessage = this._preprocessMessage(message);
      
      // 2. タイピング表示開始
      let typingInterval = null;
      if (options.showTyping !== false) {
        typingInterval = await this._startTyping(channel);
      }
      
      try {
        // 3. メッセージ送信実行
        const sentMessage = await this._sendWithRetry(channel, processedMessage);
        
        // 4. 送信成功処理
        const sendTime = Date.now() - startTime;
        this._updateStats(channelId, channelName, sendTime, true);
        
        console.log(`✅ Discord送信成功 - MessageID: ${sentMessage.id} (${sendTime}ms)`);
        
        return {
          success: true,
          messageId: sentMessage.id,
          metadata: {
            channelId,
            channelName,
            sendTime,
            messageLength: processedMessage.length,
            originalLength: message.length,
            timestamp: new Date(),
            showedTyping: !!typingInterval
          }
        };
        
      } finally {
        // タイピング表示停止
        if (typingInterval) {
          this._stopTyping(channelId, typingInterval);
        }
      }
      
    } catch (error) {
      const sendTime = Date.now() - startTime;
      this._updateStats(channelId, channelName, sendTime, false);
      
      console.error(`❌ Discord送信失敗 - Channel: #${channelName} (${sendTime}ms):`, error.message);
      
      return {
        success: false,
        error: error.message,
        metadata: {
          channelId,
          channelName,
          sendTime,
          timestamp: new Date(),
          errorType: this._categorizeError(error)
        }
      };
    }
  }

  /**
   * メッセージの前処理
   * @private
   */
  _preprocessMessage(message) {
    if (!message || typeof message !== 'string') {
      throw new Error('無効なメッセージです');
    }

    let processed = message.trim();
    
    // Discord制限に合わせて長さを調整
    if (processed.length > this.config.MAX_MESSAGE_LENGTH) {
      processed = processed.substring(0, this.config.MAX_MESSAGE_LENGTH - 3) + '...';
      console.warn(`⚠️ メッセージを${this.config.MAX_MESSAGE_LENGTH}文字に短縮しました`);
    }
    
    // 空メッセージチェック
    if (!processed) {
      throw new Error('処理後にメッセージが空になりました');
    }
    
    return processed;
  }

  /**
   * タイピング表示開始
   * @private
   */
  async _startTyping(channel) {
    try {
      await channel.sendTyping();
      
      // 継続的なタイピング表示
      const interval = setInterval(async () => {
        try {
          await channel.sendTyping();
        } catch (error) {
          // タイピングエラーは致命的でない
          console.warn('⚠️ タイピング表示エラー:', error.message);
          clearInterval(interval);
        }
      }, this.config.TYPING_INTERVAL_MS);
      
      this.typingIntervals.set(channel.id, interval);
      
      // 最大表示時間後に自動停止
      setTimeout(() => {
        this._stopTyping(channel.id, interval);
      }, this.config.TYPING_DURATION_MS);
      
      return interval;
      
    } catch (error) {
      console.warn('⚠️ タイピング開始失敗:', error.message);
      return null;
    }
  }

  /**
   * タイピング表示停止
   * @private
   */
  _stopTyping(channelId, interval) {
    if (interval) {
      clearInterval(interval);
      this.typingIntervals.delete(channelId);
    }
  }

  /**
   * リトライ機能付きメッセージ送信
   * @private
   */
  async _sendWithRetry(channel, message) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.RETRY_ATTEMPTS; attempt++) {
      try {
        // タイムアウト付きで送信実行
        return await Promise.race([
          channel.send(message),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('送信タイムアウト')), this.config.SEND_TIMEOUT_MS)
          )
        ]);
        
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ 送信試行 ${attempt}/${this.config.RETRY_ATTEMPTS} 失敗:`, error.message);
        
        // 最終試行でない場合は待機
        if (attempt < this.config.RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, this.config.RETRY_DELAY_MS * attempt));
        }
      }
    }
    
    throw new Error(`${this.config.RETRY_ATTEMPTS}回の送信試行がすべて失敗: ${lastError.message}`);
  }

  /**
   * 送信統計の更新
   * @private
   */
  _updateStats(channelId, channelName, sendTime, success) {
    this.stats.lastSend = new Date();
    
    if (success) {
      this.stats.messagesSent++;
      
      // 移動平均で送信時間を更新
      this.stats.averageSendTime = 
        (this.stats.averageSendTime * (this.stats.messagesSent - 1) + sendTime) / this.stats.messagesSent;
      
      // チャンネル別統計
      const channelStats = this.stats.channelTargets.get(channelId) || { name: channelName, count: 0 };
      channelStats.count++;
      this.stats.channelTargets.set(channelId, channelStats);
      
    } else {
      this.stats.sendErrors++;
    }
  }

  /**
   * エラーの分類
   * @private
   */
  _categorizeError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('missing permissions')) return 'PERMISSION_ERROR';
    if (message.includes('unknown channel')) return 'CHANNEL_ERROR';
    if (message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('network')) return 'NETWORK_ERROR';
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * チャンネルの送信可能性チェック
   * @param {TextChannel} channel - 確認するチャンネル
   * @returns {Promise<{canSend: boolean, reason?: string}>}
   */
  async checkChannelPermissions(channel) {
    try {
      if (!channel) {
        return { canSend: false, reason: 'チャンネルが存在しません' };
      }

      if (!channel.isTextBased()) {
        return { canSend: false, reason: 'テキストチャンネルではありません' };
      }

      // ボットの権限確認
      const permissions = channel.permissionsFor(channel.client.user);
      if (!permissions) {
        return { canSend: false, reason: '権限情報を取得できません' };
      }

      if (!permissions.has('SendMessages')) {
        return { canSend: false, reason: 'メッセージ送信権限がありません' };
      }

      if (!permissions.has('ViewChannel')) {
        return { canSend: false, reason: 'チャンネル閲覧権限がありません' };
      }

      return { canSend: true };
      
    } catch (error) {
      return { canSend: false, reason: `権限確認エラー: ${error.message}` };
    }
  }

  /**
   * バッチメッセージ送信（複数メッセージの順次送信）
   * @param {TextChannel} channel - 送信先チャンネル
   * @param {string[]} messages - 送信メッセージ配列
   * @param {Object} options - 送信オプション
   * @returns {Promise<{success: boolean, results: Array, errors: Array}>}
   */
  async sendBatchMessages(channel, messages, options = {}) {
    console.log(`📤 バッチ送信開始 - ${messages.length}件のメッセージ`);
    
    const results = [];
    const errors = [];
    const delay = options.delayBetweenMessages || 1000; // 1秒間隔
    
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      console.log(`📤 バッチ送信 ${i + 1}/${messages.length}`);
      
      try {
        const result = await this.sendProactiveMessage(channel, message, options);
        results.push(result);
        
        // 次のメッセージまで待機（最後以外）
        if (i < messages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        const errorResult = { success: false, error: error.message, messageIndex: i };
        errors.push(errorResult);
        results.push(errorResult);
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ バッチ送信完了 - 成功: ${successCount}/${messages.length}`);
    
    return {
      success: errors.length === 0,
      results,
      errors,
      successCount,
      totalCount: messages.length
    };
  }

  /**
   * 送信統計の取得
   */
  getStats() {
    const totalSends = this.stats.messagesSent + this.stats.sendErrors;
    const successRate = totalSends > 0 
      ? ((this.stats.messagesSent / totalSends) * 100).toFixed(1)
      : '0.0';
    
    return {
      messagesSent: this.stats.messagesSent,
      sendErrors: this.stats.sendErrors,
      successRate: parseFloat(successRate),
      lastSend: this.stats.lastSend,
      averageSendTime: Math.round(this.stats.averageSendTime),
      channelTargets: Array.from(this.stats.channelTargets.entries()).map(([id, stats]) => ({
        channelId: id,
        channelName: stats.name,
        messageCount: stats.count
      }))
    };
  }

  /**
   * 統計のリセット
   */
  resetStats() {
    const oldStats = this.getStats();
    this.stats = {
      messagesSent: 0,
      sendErrors: 0,
      lastSend: null,
      averageSendTime: 0,
      channelTargets: new Map()
    };
    console.log('📊 Discord送信統計をリセット');
    return oldStats;
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ DiscordSender設定を更新:', newConfig);
    return this.config;
  }

  /**
   * アクティブなタイピング表示の停止（クリーンアップ用）
   */
  cleanup() {
    console.log(`🧹 DiscordSender クリーンアップ - ${this.typingIntervals.size}個のタイピング停止`);
    for (const [channelId, interval] of this.typingIntervals) {
      this._stopTyping(channelId, interval);
    }
  }
}

module.exports = { DiscordSender };