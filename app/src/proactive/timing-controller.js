const { ProactiveDatabaseHelpers } = require('./database-helpers');

/**
 * プロアクティブメッセージ送信タイミング制御システム
 * 
 * 送信条件:
 * 1. 自動選出されたアクティブユーザーを対象
 * 2. 最後の会話から最低経過時間（デフォルト72時間）+ ランダム時間（1-100時間）が経過
 * 3. 前回のプロアクティブメッセージに対する応答があること
 * 4. ターゲットチャンネル: general
 */
class TimingController {
  constructor(pgPool) {
    this.pgPool = pgPool;
    this.helpers = new ProactiveDatabaseHelpers(pgPool);
    
    // 設定値（環境変数から読み込み、単位: ミリ秒）
    this.config = {
      TARGET_CHANNEL_NAME: process.env.PROACTIVE_TARGET_CHANNEL || 'general',
      
      // タイミング制御（新方式）
      MIN_CONVERSATION_GAP: (parseInt(process.env.PROACTIVE_MIN_CONVERSATION_GAP) || 72) * 60 * 60 * 1000,
      RANDOM_DELAY_MIN_HOURS: 1,   // ランダム時間の最小値（時間）
      RANDOM_DELAY_MAX_HOURS: 100, // ランダム時間の最大値（時間）
      
      // デバッグ用短縮設定
      DEBUG_MODE: process.env.PROACTIVE_DEBUG_MODE === 'true',
      DEBUG_CONVERSATION_GAP: (parseInt(process.env.PROACTIVE_DEBUG_CONVERSATION_GAP_MIN) || 10) * 60 * 1000,
      DEBUG_RANDOM_DELAY_MIN_HOURS: 0.1, // デバッグ時：6分
      DEBUG_RANDOM_DELAY_MAX_HOURS: 2    // デバッグ時：2時間
    };
  }

  /**
   * プロアクティブメッセージ送信判定のメイン関数
   * @param {Client} discordClient - Discord.jsクライアント
   * @returns {Promise<{shouldSend: boolean, reason: string, channel?: any, targetUser?: string}>}
   */
  async shouldSendProactiveMessage(discordClient) {
    const check = {
      shouldSend: false,
      reason: '',
      channel: null,
      targetUser: null,
      debug: {
        targetChannel: this.config.TARGET_CHANNEL_NAME,
        debugMode: this.config.DEBUG_MODE
      }
    };

    try {
      // 1. ターゲットユーザーの自動選出
      const targetUserId = await this.helpers.getTargetUserForProactive();
      if (!targetUserId) {
        check.reason = '❌ プロアクティブメッセージの対象ユーザーが見つかりません';
        return check;
      }
      check.targetUser = targetUserId;
      check.debug.targetUser = targetUserId;

      // 2. ターゲットチャンネルの存在確認
      const channelCheck = await this._checkTargetChannel(discordClient);
      if (!channelCheck.exists) {
        check.reason = `❌ ターゲットチャンネル '${this.config.TARGET_CHANNEL_NAME}' が見つかりません`;
        return check;
      }
      check.channel = channelCheck.channel;

      // 3. ランダムタイミング制御による送信判定
      const timingCheck = await this._checkRandomTiming(targetUserId);
      if (!timingCheck.valid) {
        check.reason = timingCheck.reason;
        check.debug.lastConversation = timingCheck.lastConversation;
        check.debug.nextSendTime = timingCheck.nextSendTime;
        check.debug.hoursUntilNext = timingCheck.hoursUntilNext;
        return check;
      }

      // 4. 前回プロアクティブメッセージへの応答確認
      const responseCheck = await this._checkProactiveResponse(targetUserId);
      if (!responseCheck.valid) {
        check.reason = responseCheck.reason;
        check.debug.needsResponse = true;
        return check;
      }

      // すべての条件をクリア
      check.shouldSend = true;
      check.reason = `✅ 送信条件を満たしています (対象: ${targetUserId})`;
      check.debug.lastConversation = timingCheck.lastConversation;
      check.debug.nextSendTime = timingCheck.nextSendTime;
      check.debug.randomDelayHours = timingCheck.randomDelayHours;
      check.debug.hasResponse = responseCheck.hasResponse;

      return check;

    } catch (error) {
      check.reason = `❌ 判定処理中にエラー: ${error.message}`;
      return check;
    }
  }

  /**
   * ターゲットチャンネルの存在確認
   * @private
   */
  async _checkTargetChannel(discordClient) {
    try {
      // 全てのギルドから指定名のチャンネルを検索
      for (const guild of discordClient.guilds.cache.values()) {
        const channel = guild.channels.cache.find(ch => 
          ch.name === this.config.TARGET_CHANNEL_NAME && ch.isTextBased()
        );
        if (channel) {
          return { exists: true, channel };
        }
      }
      return { exists: false, channel: null };
    } catch (error) {
      console.error('Error checking target channel:', error);
      return { exists: false, channel: null };
    }
  }

  /**
   * ランダムタイミング制御による送信判定
   * @param {string} userId - ユーザーID
   * @private
   */
  async _checkRandomTiming(userId) {
    try {
      const lastConversation = await this.helpers.getLastConversationTime(userId);
      const now = new Date();
      
      // デバッグモード対応
      const minGap = this.config.DEBUG_MODE ? 
        this.config.DEBUG_CONVERSATION_GAP : 
        this.config.MIN_CONVERSATION_GAP;
      
      const randomMinHours = this.config.DEBUG_MODE ? 
        this.config.DEBUG_RANDOM_DELAY_MIN_HOURS : 
        this.config.RANDOM_DELAY_MIN_HOURS;
      
      const randomMaxHours = this.config.DEBUG_MODE ? 
        this.config.DEBUG_RANDOM_DELAY_MAX_HOURS : 
        this.config.RANDOM_DELAY_MAX_HOURS;

      // ランダム時間を生成（時間単位）
      const randomDelayHours = randomMinHours + Math.random() * (randomMaxHours - randomMinHours);
      const randomDelayMs = randomDelayHours * 60 * 60 * 1000;
      
      // 次回送信時間 = 最後の会話 + 最低経過時間 + ランダム時間
      const nextSendTime = new Date(lastConversation.getTime() + minGap + randomDelayMs);
      
      const hoursUntilNext = Math.max(0, (nextSendTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      if (now < nextSendTime) {
        const minGapHours = Math.floor(minGap / (1000 * 60 * 60));
        return {
          valid: false,
          reason: `⏰ 次回送信予定時刻まで待機中 (${Math.ceil(hoursUntilNext)}時間後: ${nextSendTime.toLocaleString('ja-JP')})`,
          lastConversation,
          nextSendTime,
          hoursUntilNext: Math.ceil(hoursUntilNext),
          randomDelayHours: Math.round(randomDelayHours * 10) / 10
        };
      }

      return {
        valid: true,
        lastConversation,
        nextSendTime,
        randomDelayHours: Math.round(randomDelayHours * 10) / 10
      };

    } catch (error) {
      return {
        valid: false,
        reason: `❌ タイミング確認中にエラー: ${error.message}`,
        lastConversation: null,
        nextSendTime: null,
        hoursUntilNext: 0
      };
    }
  }

  /**
   * 前回プロアクティブメッセージへの応答確認
   * @param {string} userId - ユーザーID
   * @private
   */
  async _checkProactiveResponse(userId) {
    try {
      // 最後のプロアクティブメッセージを取得
      const result = await this.pgPool.query(
        `SELECT created_at 
         FROM conversations 
         WHERE user_id = $1 AND message_type = 'proactive'
         ORDER BY created_at DESC 
         LIMIT 1`,
        [userId]
      );

      // プロアクティブメッセージがない場合は送信OK（初回）
      if (result.rows.length === 0) {
        return {
          valid: true,
          hasResponse: null,
          reason: '初回プロアクティブメッセージ送信'
        };
      }

      const lastProactiveTime = new Date(result.rows[0].created_at);

      // 最後のプロアクティブメッセージ以降に応答があるかチェック
      const responseResult = await this.pgPool.query(
        `SELECT COUNT(*) as response_count
         FROM conversations 
         WHERE user_id = $1 
           AND message_type = 'response_to_proactive'
           AND created_at > $2`,
        [userId, lastProactiveTime]
      );

      const responseCount = parseInt(responseResult.rows[0].response_count);
      
      if (responseCount === 0) {
        return {
          valid: false,
          hasResponse: false,
          reason: '❌ 前回のプロアクティブメッセージに対する応答がありません'
        };
      }

      return {
        valid: true,
        hasResponse: true,
        responseCount
      };

    } catch (error) {
      return {
        valid: false,
        hasResponse: null,
        reason: `❌ 応答確認中にエラー: ${error.message}`
      };
    }
  }

  /**
   * 設定の更新（デバッグモード切り替え等）
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 TimingController設定を更新:', newConfig);
  }

  /**
   * 現在の設定値を取得
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * タイミング状態の詳細情報を取得（デバッグ用）
   */
  async getTimingStatus(discordClient) {
    const shouldSend = await this.shouldSendProactiveMessage(discordClient);
    
    // 自動選出されたユーザーでの統計取得
    const targetUserId = shouldSend.targetUser;
    const stats = targetUserId ? await this.helpers.getProactiveStats(targetUserId) : null;
    
    return {
      judgment: shouldSend,
      stats,
      config: this.getConfig(),
      timestamps: {
        now: new Date(),
        lastConversation: shouldSend.debug?.lastConversation,
        nextSendTime: shouldSend.debug?.nextSendTime
      }
    };
  }
}

module.exports = { TimingController };