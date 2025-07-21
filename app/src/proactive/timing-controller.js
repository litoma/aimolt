const { ProactiveDatabaseHelpers } = require('./database-helpers');

/**
 * プロアクティブメッセージ送信タイミング制御システム
 * 
 * 送信条件:
 * 1. 最後の会話から6時間以上経過 (優先条件)
 * 2. 最後のプロアクティブメッセージから24-72時間経過
 * 3. ターゲットユーザー: litoma
 * 4. ターゲットチャンネル: general
 */
class TimingController {
  constructor(pgPool) {
    this.pgPool = pgPool;
    this.helpers = new ProactiveDatabaseHelpers(pgPool);
    
    // 設定値（環境変数から読み込み、単位: ミリ秒）
    this.config = {
      TARGET_USER_ID: process.env.PROACTIVE_TARGET_USER_ID || 'litoma',
      TARGET_CHANNEL_NAME: process.env.PROACTIVE_TARGET_CHANNEL || 'general',
      
      // タイミング制御
      MIN_CONVERSATION_GAP: (parseInt(process.env.PROACTIVE_MIN_CONVERSATION_GAP) || 6) * 60 * 60 * 1000,
      MIN_PROACTIVE_GAP: (parseInt(process.env.PROACTIVE_MIN_PROACTIVE_GAP) || 24) * 60 * 60 * 1000,
      MAX_PROACTIVE_GAP: (parseInt(process.env.PROACTIVE_MAX_PROACTIVE_GAP) || 72) * 60 * 60 * 1000,
      
      // デバッグ用短縮設定
      DEBUG_MODE: process.env.PROACTIVE_DEBUG_MODE === 'true',
      DEBUG_CONVERSATION_GAP: (parseInt(process.env.PROACTIVE_DEBUG_CONVERSATION_GAP_MIN) || 10) * 60 * 1000,
      DEBUG_PROACTIVE_GAP: (parseInt(process.env.PROACTIVE_DEBUG_PROACTIVE_GAP_MIN) || 30) * 60 * 1000,
      DEBUG_MAX_PROACTIVE_GAP: (parseInt(process.env.PROACTIVE_DEBUG_MAX_PROACTIVE_GAP_MIN) || 120) * 60 * 1000
    };
  }

  /**
   * プロアクティブメッセージ送信判定のメイン関数
   * @param {Client} discordClient - Discord.jsクライアント
   * @returns {Promise<{shouldSend: boolean, reason: string, channel?: any}>}
   */
  async shouldSendProactiveMessage(discordClient) {
    const check = {
      shouldSend: false,
      reason: '',
      channel: null,
      debug: {
        targetUser: this.config.TARGET_USER_ID,
        targetChannel: this.config.TARGET_CHANNEL_NAME,
        debugMode: this.config.DEBUG_MODE
      }
    };

    try {
      // 1. ターゲットチャンネルの存在確認
      const channelCheck = await this._checkTargetChannel(discordClient);
      if (!channelCheck.exists) {
        check.reason = `❌ ターゲットチャンネル '${this.config.TARGET_CHANNEL_NAME}' が見つかりません`;
        return check;
      }
      check.channel = channelCheck.channel;

      // 2. 会話履歴の確認
      const conversationCheck = await this._checkConversationTiming();
      if (!conversationCheck.valid) {
        check.reason = conversationCheck.reason;
        check.debug.lastConversation = conversationCheck.lastConversation;
        check.debug.conversationGapHours = conversationCheck.gapHours;
        return check;
      }

      // 3. プロアクティブメッセージの履歴確認
      const proactiveCheck = await this._checkProactiveTiming();
      if (!proactiveCheck.valid) {
        check.reason = proactiveCheck.reason;
        check.debug.lastProactive = proactiveCheck.lastProactive;
        check.debug.proactiveGapHours = proactiveCheck.gapHours;
        return check;
      }

      // すべての条件をクリア
      check.shouldSend = true;
      check.reason = `✅ 送信条件を満たしています`;
      check.debug.lastConversation = conversationCheck.lastConversation;
      check.debug.lastProactive = proactiveCheck.lastProactive;
      check.debug.conversationGapHours = conversationCheck.gapHours;
      check.debug.proactiveGapHours = proactiveCheck.gapHours;

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
   * 会話タイミングの確認
   * @private
   */
  async _checkConversationTiming() {
    try {
      const lastConversation = await this.helpers.getLastConversationTime(this.config.TARGET_USER_ID);
      const now = new Date();
      const gapMs = now.getTime() - lastConversation.getTime();
      
      // デバッグモード対応
      const requiredGap = this.config.DEBUG_MODE ? 
        this.config.DEBUG_CONVERSATION_GAP : 
        this.config.MIN_CONVERSATION_GAP;
      
      const gapHours = Math.floor(gapMs / (1000 * 60 * 60));
      const requiredHours = Math.floor(requiredGap / (1000 * 60 * 60));

      if (gapMs < requiredGap) {
        return {
          valid: false,
          reason: `⏰ 最後の会話から${requiredHours}時間経過が必要 (現在: ${gapHours}時間)`,
          lastConversation,
          gapHours
        };
      }

      return {
        valid: true,
        lastConversation,
        gapHours
      };

    } catch (error) {
      return {
        valid: false,
        reason: `❌ 会話履歴の確認中にエラー: ${error.message}`,
        lastConversation: null,
        gapHours: 0
      };
    }
  }

  /**
   * プロアクティブメッセージタイミングの確認
   * @private
   */
  async _checkProactiveTiming() {
    try {
      const lastProactive = await this.helpers.getLastProactiveMessageTime(this.config.TARGET_USER_ID);
      const now = new Date();
      const gapMs = now.getTime() - lastProactive.getTime();
      
      // デバッグモード対応
      const minGap = this.config.DEBUG_MODE ? 
        this.config.DEBUG_PROACTIVE_GAP : 
        this.config.MIN_PROACTIVE_GAP;
      
      const maxGap = this.config.DEBUG_MODE ? 
        this.config.DEBUG_MAX_PROACTIVE_GAP : 
        this.config.MAX_PROACTIVE_GAP;
      
      const gapHours = Math.floor(gapMs / (1000 * 60 * 60));
      const minHours = Math.floor(minGap / (1000 * 60 * 60));
      const maxHours = Math.floor(maxGap / (1000 * 60 * 60));

      // 最小間隔チェック
      if (gapMs < minGap) {
        return {
          valid: false,
          reason: `⏰ 最後のプロアクティブから${minHours}時間経過が必要 (現在: ${gapHours}時間)`,
          lastProactive,
          gapHours
        };
      }

      // 最大間隔チェック（プロアクティブが古すぎる場合は積極的に送信）
      if (gapMs > maxGap) {
        console.log(`🔥 プロアクティブメッセージが${maxHours}時間以上送信されていません - 積極送信モード`);
      }

      return {
        valid: true,
        lastProactive,
        gapHours
      };

    } catch (error) {
      return {
        valid: false,
        reason: `❌ プロアクティブ履歴の確認中にエラー: ${error.message}`,
        lastProactive: null,
        gapHours: 0
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
    
    const stats = await this.helpers.getProactiveStats(this.config.TARGET_USER_ID);
    
    return {
      judgment: shouldSend,
      stats,
      config: this.getConfig(),
      timestamps: {
        now: new Date(),
        lastConversation: shouldSend.debug?.lastConversation,
        lastProactive: shouldSend.debug?.lastProactive
      }
    };
  }
}

module.exports = { TimingController };