const cron = require('node-cron');
const { TimingController } = require('./timing-controller');
const { MessageGenerator } = require('./message-generator');
const { DiscordSender } = require('./discord-sender');
const { ProactiveResponseHandler } = require('./response-handler');

/**
 * プロアクティブメッセージスケジューラー
 * 
 * Node.jsのnode-cronを使用してタイミング制御を行います。
 * Dockerコンテナ内で動作するため、外部crontabに依存しません。
 */
class ProactiveScheduler {
  constructor(pgPool, discordClient, genAI) {
    this.pgPool = pgPool;
    this.discordClient = discordClient;
    this.genAI = genAI;
    this.timingController = new TimingController(pgPool);
    this.messageGenerator = new MessageGenerator(pgPool, genAI);
    this.discordSender = new DiscordSender();
    this.responseHandler = new ProactiveResponseHandler(pgPool, this.timingController.helpers);
    
    // スケジューラー状態
    this.isRunning = false;
    this.cronJob = null;
    this.stats = {
      checksPerformed: 0,
      messagesTriggered: 0,
      lastCheck: null,
      lastTrigger: null,
      errors: 0
    };
    
    // 設定（環境変数から読み込み）
    this.cronPattern = process.env.PROACTIVE_CRON_PATTERN || '0 */1 * * *'; // デフォルト: 毎時0分
    this.autoStart = process.env.PROACTIVE_AUTO_START !== 'false'; // デフォルト: true
  }

  /**
   * スケジューラーを開始
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ プロアクティブスケジューラーは既に実行中です');
      return false;
    }

    try {
      this.cronJob = cron.schedule(this.cronPattern, async () => {
        await this._performScheduledCheck();
      }, {
        scheduled: false, // 手動で開始
        timezone: 'Asia/Tokyo'
      });

      this.cronJob.start();
      this.isRunning = true;
      
      console.log('🚀 プロアクティブメッセージスケジューラーが開始されました');
      console.log(`📅 チェック間隔: ${this.cronPattern} (Asia/Tokyo)`);
      
      return true;
    } catch (error) {
      console.error('❌ スケジューラー開始エラー:', error.message);
      return false;
    }
  }

  /**
   * スケジューラーを停止
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ プロアクティブスケジューラーは既に停止中です');
      return false;
    }

    try {
      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob.destroy();
        this.cronJob = null;
      }

      this.isRunning = false;
      console.log('🛑 プロアクティブメッセージスケジューラーが停止されました');
      return true;
    } catch (error) {
      console.error('❌ スケジューラー停止エラー:', error.message);
      return false;
    }
  }

  /**
   * スケジューラーを再起動
   */
  restart() {
    console.log('🔄 プロアクティブスケジューラーを再起動中...');
    this.stop();
    return this.start();
  }

  /**
   * 定期チェックの実行（cronから呼ばれる）
   * @private
   */
  async _performScheduledCheck() {
    this.stats.checksPerformed++;
    this.stats.lastCheck = new Date();

    try {
      console.log(`🔍 プロアクティブメッセージチェック実行 (#${this.stats.checksPerformed})`);
      
      // タイミングコントローラーで送信判定
      const judgment = await this.timingController.shouldSendProactiveMessage(this.discordClient);
      
      if (judgment.shouldSend) {
        console.log('✅ プロアクティブメッセージ送信条件を満たしています');
        console.log(`📍 理由: ${judgment.reason}`);
        
        // メッセージ生成・送信を実行
        await this._triggerProactiveMessage(judgment.channel, judgment.targetUser);
        
      } else {
        console.log('⏰ プロアクティブメッセージ送信条件を満たしていません');
        console.log(`📍 理由: ${judgment.reason}`);
        
        // デバッグ情報をログに出力
        if (judgment.debug) {
          console.log('🐛 デバッグ情報:', {
            ターゲットユーザー: judgment.debug.targetUser,
            デバッグモード: judgment.debug.debugMode,
            最後の会話間隔: judgment.debug.conversationGapHours ? `${judgment.debug.conversationGapHours}時間前` : '不明',
            最後のプロアクティブ間隔: judgment.debug.proactiveGapHours ? `${judgment.debug.proactiveGapHours}時間前` : '不明'
          });
        }
      }

    } catch (error) {
      this.stats.errors++;
      console.error('❌ 定期チェック中にエラー:', error.message);
      console.error('Stack:', error.stack);
    }
  }

  /**
   * プロアクティブメッセージの送信トリガー
   * @param {Object} channel - Discord チャンネル
   * @param {string} targetUserId - 対象ユーザーID
   * @private
   */
  async _triggerProactiveMessage(channel, targetUserId) {
    try {
      this.stats.messagesTriggered++;
      this.stats.lastTrigger = new Date();

      console.log(`🤖 プロアクティブメッセージ送信を開始... (対象: ${targetUserId})`);
      
      // Phase 4: チャンネル送信権限の確認
      const permissionCheck = await this.discordSender.checkChannelPermissions(channel);
      if (!permissionCheck.canSend) {
        throw new Error(`チャンネル送信不可: ${permissionCheck.reason}`);
      }
      
      // Phase 3: MessageGeneratorを使用してAIメッセージを生成
      const generationResult = await this.messageGenerator.generateProactiveMessage(
        targetUserId, 
        this.timingController.helpers
      );
      
      let messageContent;
      
      if (generationResult.success) {
        messageContent = generationResult.message;
        console.log('✅ AI生成メッセージを使用');
      } else {
        // フォールバック: シンプルなメッセージ
        messageContent = 'こんにちは！最近どうしてる？😊';
        console.warn('⚠️ AI生成失敗、フォールバックメッセージを使用:', generationResult.error);
      }
      
      // メンション付きの最終メッセージ
      const finalMessage = `<@${targetUserId}> ${messageContent}`;
      
      // Phase 4: DiscordSenderで送信
      const sendResult = await this.discordSender.sendProactiveMessage(channel, finalMessage, {
        showTyping: true
      });
      
      if (!sendResult.success) {
        throw new Error(`Discord送信失敗: ${sendResult.error}`);
      }
      
      console.log(`✅ Discord送信成功 - MessageID: ${sendResult.messageId}`);
      
      // データベースに記録
      const dbSuccess = await this.timingController.helpers.saveProactiveMessage(
        targetUserId, 
        finalMessage
      );
      
      if (!dbSuccess) {
        console.error('❌ データベース保存失敗 (Discord送信は成功)');
      }
      
      // Phase 4: 応答追跡開始
      this.responseHandler.startTrackingResponse(targetUserId, sendResult.messageId);
      
      // 統合ログ
      console.log('📊 プロアクティブメッセージ送信完了:', {
        ユーザー: targetUserId,
        チャンネル: `#${sendResult.metadata?.channelName}`,
        Discord送信時間: `${sendResult.metadata?.sendTime}ms`,
        AI生成時間: generationResult.metadata?.generationTime ? `${generationResult.metadata.generationTime}ms` : 'N/A',
        AIモデル: generationResult.metadata?.aiModel || 'フォールバック',
        データベース保存: dbSuccess ? '✅' : '❌'
      });

    } catch (error) {
      this.stats.errors++;
      console.error('❌ プロアクティブメッセージ送信エラー:', error.message);
      throw error;
    }
  }

  /**
   * 手動でチェックを実行（管理コマンド用）
   */
  async performManualCheck() {
    console.log('🔧 手動チェックを実行中...');
    await this._performScheduledCheck();
  }

  /**
   * スケジューラー状態の取得
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cronPattern: this.cronPattern,
      stats: { ...this.stats },
      nextRun: this.cronJob ? 'cron管理中' : null
    };
  }

  /**
   * 統計情報のリセット
   */
  resetStats() {
    const oldStats = { ...this.stats };
    this.stats = {
      checksPerformed: 0,
      messagesTriggered: 0,
      lastCheck: null,
      lastTrigger: null,
      errors: 0
    };
    console.log('📊 スケジューラー統計をリセット');
    return oldStats;
  }

  /**
   * cron パターンの変更（動的設定変更）
   */
  setCronPattern(newPattern) {
    if (!cron.validate(newPattern)) {
      throw new Error(`無効なcronパターン: ${newPattern}`);
    }

    const wasRunning = this.isRunning;
    if (wasRunning) {
      this.stop();
    }

    this.cronPattern = newPattern;
    console.log(`⚙️ cronパターンを更新: ${newPattern}`);

    if (wasRunning) {
      this.start();
    }

    return true;
  }

  /**
   * タイミングコントローラーの設定更新
   */
  updateTimingConfig(newConfig) {
    this.timingController.updateConfig(newConfig);
  }

  /**
   * 詳細状態の取得（デバッグ用）
   */
  async getDetailedStatus() {
    const basicStatus = this.getStatus();
    const timingStatus = await this.timingController.getTimingStatus(this.discordClient);
    const generatorStats = this.messageGenerator.getStats();
    const senderStats = this.discordSender.getStats();
    const responseStats = this.responseHandler.getStats();
    
    return {
      scheduler: basicStatus,
      timing: timingStatus,
      messageGeneration: generatorStats,
      discordSending: senderStats,
      responseHandling: responseStats,
      systemTime: new Date(),
      timezone: 'Asia/Tokyo'
    };
  }

  /**
   * リソースクリーンアップ（終了時）
   */
  cleanup() {
    console.log('🧹 ProactiveScheduler クリーンアップ開始');
    
    // スケジューラー停止
    this.stop();
    
    // サブコンポーネントのクリーンアップ
    if (this.discordSender) {
      this.discordSender.cleanup();
    }
    
    if (this.responseHandler) {
      this.responseHandler.cleanup();
    }
    
    console.log('✅ ProactiveScheduler クリーンアップ完了');
  }

  /**
   * 応答処理へのアクセス（index.jsから使用）
   */
  getResponseHandler() {
    return this.responseHandler;
  }
}

module.exports = { ProactiveScheduler };