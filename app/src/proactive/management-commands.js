/**
 * プロアクティブメッセージ機能の管理コマンド
 * 
 * 提供するコマンド:
 * - !proactive status: システム状態表示
 * - !proactive check: 手動チェック実行
 * - !proactive start: スケジューラー開始
 * - !proactive stop: スケジューラー停止
 * - !proactive restart: スケジューラー再起動
 * - !proactive config: 設定表示・変更
 * - !proactive stats: 詳細統計
 * - !proactive debug: デバッグ情報
 */
class ProactiveManagementCommands {
  constructor(proactiveScheduler) {
    this.scheduler = proactiveScheduler;
  }

  /**
   * プロアクティブ管理コマンドの処理
   * @param {Message} message - Discord.jsメッセージオブジェクト
   * @param {string[]} args - コマンド引数配列
   */
  async handleProactiveCommand(message, args) {
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'status':
          await this._handleStatusCommand(message);
          break;
        
        case 'check':
          await this._handleCheckCommand(message);
          break;
        
        case 'start':
          await this._handleStartCommand(message);
          break;
        
        case 'stop':
          await this._handleStopCommand(message);
          break;
        
        case 'restart':
          await this._handleRestartCommand(message);
          break;
        
        case 'config':
          await this._handleConfigCommand(message, args.slice(1));
          break;
        
        case 'stats':
          await this._handleStatsCommand(message);
          break;
        
        case 'debug':
          await this._handleDebugCommand(message);
          break;
        
        case 'help':
        default:
          await this._handleHelpCommand(message);
          break;
      }
    } catch (error) {
      console.error('Error in proactive command:', error);
      await message.reply('❌ コマンドの実行中にエラーが発生しました。');
    }
  }

  /**
   * !proactive status - システム状態表示
   * @private
   */
  async _handleStatusCommand(message) {
    const status = this.scheduler.getStatus();
    const timingStatus = await this.scheduler.timingController.getTimingStatus(message.client);

    const embed = {
      title: '🤖 プロアクティブメッセージシステム状態',
      color: status.isRunning ? 0x00ff00 : 0xff6600,
      fields: [
        {
          name: '⚙️ スケジューラー状態',
          value: status.isRunning ? '✅ 稼働中' : '⏸️ 停止中',
          inline: true
        },
        {
          name: '📅 チェック間隔',
          value: status.cronPattern,
          inline: true
        },
        {
          name: '📊 チェック回数',
          value: `${status.stats.checksPerformed}回`,
          inline: true
        },
        {
          name: '🚀 送信回数',
          value: `${status.stats.messagesTriggered}回`,
          inline: true
        },
        {
          name: '❌ エラー回数',
          value: `${status.stats.errors}回`,
          inline: true
        },
        {
          name: '📈 成功率',
          value: status.stats.checksPerformed > 0 
            ? `${Math.round(((status.stats.checksPerformed - status.stats.errors) / status.stats.checksPerformed) * 100)}%`
            : 'N/A',
          inline: true
        },
        {
          name: '🕐 最終チェック',
          value: status.stats.lastCheck 
            ? `<t:${Math.floor(new Date(status.stats.lastCheck).getTime() / 1000)}:R>`
            : '未実行',
          inline: true
        },
        {
          name: '🚀 最終送信',
          value: status.stats.lastTrigger 
            ? `<t:${Math.floor(new Date(status.stats.lastTrigger).getTime() / 1000)}:R>`
            : '未実行',
          inline: true
        },
        {
          name: '🎯 ターゲット',
          value: `<@${timingStatus.config.TARGET_USER_ID}> in #${timingStatus.config.TARGET_CHANNEL_NAME}`,
          inline: true
        },
        {
          name: '⚡ 判定状況',
          value: timingStatus.judgment.shouldSend ? '✅ 送信可能' : '⏰ 条件待ち',
          inline: false
        },
        {
          name: '📝 理由',
          value: timingStatus.judgment.reason,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: 'Proactive Message System v2.0' }
    };

    await message.reply({ embeds: [embed] });
  }

  /**
   * !proactive check - 手動チェック実行
   * @private
   */
  async _handleCheckCommand(message) {
    const checkMsg = await message.reply('🔍 手動チェックを実行中...');

    try {
      await this.scheduler.performManualCheck();
      
      await checkMsg.edit({
        content: '',
        embeds: [{
          title: '✅ 手動チェック完了',
          description: '手動でプロアクティブメッセージのチェックを実行しました。',
          color: 0x00ff00,
          fields: [
            {
              name: '実行時刻',
              value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
              inline: true
            }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Manual Check' }
        }]
      });
    } catch (error) {
      await checkMsg.edit({
        content: '',
        embeds: [{
          title: '❌ 手動チェック失敗',
          description: '手動チェック中にエラーが発生しました。',
          color: 0xff0000,
          fields: [
            { name: 'エラー', value: `\`${error.message}\``, inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Manual Check Error' }
        }]
      });
    }
  }

  /**
   * !proactive start - スケジューラー開始
   * @private
   */
  async _handleStartCommand(message) {
    const success = this.scheduler.start();
    
    await message.reply({
      embeds: [{
        title: success ? '🚀 スケジューラー開始' : '⚠️ 開始失敗',
        description: success 
          ? 'プロアクティブメッセージスケジューラーを開始しました。'
          : 'スケジューラーは既に稼働中か、開始に失敗しました。',
        color: success ? 0x00ff00 : 0xff6600,
        timestamp: new Date().toISOString(),
        footer: { text: 'Scheduler Control' }
      }]
    });
  }

  /**
   * !proactive stop - スケジューラー停止
   * @private
   */
  async _handleStopCommand(message) {
    const success = this.scheduler.stop();
    
    await message.reply({
      embeds: [{
        title: success ? '🛑 スケジューラー停止' : '⚠️ 停止失敗',
        description: success 
          ? 'プロアクティブメッセージスケジューラーを停止しました。'
          : 'スケジューラーは既に停止中か、停止に失敗しました。',
        color: success ? 0xff6600 : 0xff0000,
        timestamp: new Date().toISOString(),
        footer: { text: 'Scheduler Control' }
      }]
    });
  }

  /**
   * !proactive restart - スケジューラー再起動
   * @private
   */
  async _handleRestartCommand(message) {
    const restartMsg = await message.reply('🔄 スケジューラーを再起動中...');
    
    try {
      const success = this.scheduler.restart();
      
      await restartMsg.edit({
        content: '',
        embeds: [{
          title: success ? '✅ 再起動完了' : '❌ 再起動失敗',
          description: success 
            ? 'プロアクティブメッセージスケジューラーを再起動しました。'
            : 'スケジューラーの再起動に失敗しました。',
          color: success ? 0x00ff00 : 0xff0000,
          timestamp: new Date().toISOString(),
          footer: { text: 'Scheduler Control' }
        }]
      });
    } catch (error) {
      await restartMsg.edit({
        content: '',
        embeds: [{
          title: '❌ 再起動エラー',
          description: '再起動中にエラーが発生しました。',
          color: 0xff0000,
          fields: [
            { name: 'エラー', value: `\`${error.message}\``, inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'Restart Error' }
        }]
      });
    }
  }

  /**
   * !proactive config - 設定表示・変更
   * @private
   */
  async _handleConfigCommand(message, args) {
    const config = this.scheduler.timingController.getConfig();

    if (args.length === 0) {
      // 設定表示
      const embed = {
        title: '⚙️ プロアクティブメッセージ設定',
        color: 0x0099ff,
        fields: [
          {
            name: '🎯 ターゲット設定',
            value: `ユーザー: <@${config.TARGET_USER_ID}>\nチャンネル: #${config.TARGET_CHANNEL_NAME}`,
            inline: false
          },
          {
            name: '⏰ タイミング設定',
            value: `会話間隔: ${Math.floor(config.MIN_CONVERSATION_GAP / (1000 * 60 * 60))}時間\nプロアクティブ最小: ${Math.floor(config.MIN_PROACTIVE_GAP / (1000 * 60 * 60))}時間\nプロアクティブ最大: ${Math.floor(config.MAX_PROACTIVE_GAP / (1000 * 60 * 60))}時間`,
            inline: false
          },
          {
            name: '🐛 デバッグモード',
            value: config.DEBUG_MODE ? '✅ 有効（短縮間隔）' : '❌ 無効（通常間隔）',
            inline: true
          },
          {
            name: '📅 cron設定',
            value: this.scheduler.cronPattern,
            inline: true
          }
        ],
        footer: { text: 'config debug on/off でデバッグモード切り替え' }
      };

      await message.reply({ embeds: [embed] });
      
    } else if (args[0] === 'debug' && args[1]) {
      // デバッグモード切り替え
      const debugMode = args[1].toLowerCase() === 'on';
      this.scheduler.updateTimingConfig({ DEBUG_MODE: debugMode });
      
      await message.reply({
        embeds: [{
          title: '⚙️ 設定更新',
          description: `デバッグモードを${debugMode ? '有効' : '無効'}にしました。`,
          color: debugMode ? 0xff6600 : 0x00ff00,
          fields: [
            {
              name: '新しい設定',
              value: debugMode ? '短縮間隔（テスト用）' : '通常間隔（本番用）',
              inline: true
            }
          ],
          timestamp: new Date().toISOString()
        }]
      });
    } else {
      await message.reply('❌ 無効な設定コマンドです。`!proactive config` で設定表示、`!proactive config debug on/off` でデバッグモード切り替え');
    }
  }

  /**
   * !proactive stats - 詳細統計
   * @private
   */
  async _handleStatsCommand(message) {
    const detailedStatus = await this.scheduler.getDetailedStatus();
    
    const embed = {
      title: '📊 プロアクティブシステム詳細統計',
      color: 0x9b59b6,
      fields: [
        {
          name: '📈 送信統計',
          value: `プロアクティブ送信: ${detailedStatus.timing.stats.proactiveCount}回\n応答受信: ${detailedStatus.timing.stats.responseCount}回\n応答率: ${detailedStatus.timing.stats.responseRate}%`,
          inline: true
        },
        {
          name: '🕐 タイムスタンプ',
          value: `最終会話: ${detailedStatus.timing.stats.lastConversation ? `<t:${Math.floor(detailedStatus.timing.stats.lastConversation.getTime() / 1000)}:R>` : '未記録'}\n最終プロアクティブ: ${detailedStatus.timing.stats.lastProactive ? `<t:${Math.floor(detailedStatus.timing.stats.lastProactive.getTime() / 1000)}:R>` : '未記録'}`,
          inline: true
        },
        {
          name: '🤖 AI生成統計',
          value: `生成成功: ${detailedStatus.messageGeneration.generated}回\n生成エラー: ${detailedStatus.messageGeneration.errors}回\n成功率: ${detailedStatus.messageGeneration.successRate}%`,
          inline: true
        },
        {
          name: '⚡ システム稼働',
          value: `チェック実行: ${detailedStatus.scheduler.stats.checksPerformed}回\nメッセージ送信: ${detailedStatus.scheduler.stats.messagesTriggered}回\nエラー: ${detailedStatus.scheduler.stats.errors}回`,
          inline: false
        },
        {
          name: '⏱️ 生成パフォーマンス',
          value: `平均生成時間: ${Math.round(detailedStatus.messageGeneration.averageGenerationTime)}ms\n最終生成: ${detailedStatus.messageGeneration.lastGeneration ? `<t:${Math.floor(detailedStatus.messageGeneration.lastGeneration.getTime() / 1000)}:R>` : '未実行'}`,
          inline: false
        },
        {
          name: '📤 Discord送信統計',
          value: `送信成功: ${detailedStatus.discordSending.messagesSent}回\n送信エラー: ${detailedStatus.discordSending.sendErrors}回\n成功率: ${detailedStatus.discordSending.successRate}%`,
          inline: true
        },
        {
          name: '🎯 応答処理統計',
          value: `応答検出: ${detailedStatus.responseHandling.responsesDetected}回\n応答率: ${detailedStatus.responseHandling.responseRate}%\n現在追跡中: ${detailedStatus.responseHandling.currentlyTracking}ユーザー`,
          inline: true
        },
        {
          name: '🔮 次の判定',
          value: detailedStatus.timing.judgment.reason,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `システム時刻: ${detailedStatus.systemTime.toLocaleString('ja-JP', {timeZone: detailedStatus.timezone})}` }
    };

    await message.reply({ embeds: [embed] });
  }

  /**
   * !proactive debug - デバッグ情報
   * @private
   */
  async _handleDebugCommand(message) {
    const detailedStatus = await this.scheduler.getDetailedStatus();
    
    // デバッグ情報をJSON形式でフォーマット
    const debugInfo = {
      scheduler: detailedStatus.scheduler,
      timing: {
        judgment: detailedStatus.timing.judgment,
        config: detailedStatus.timing.config,
        timestamps: detailedStatus.timing.timestamps
      }
    };

    const debugJson = JSON.stringify(debugInfo, null, 2);
    
    // 2000文字制限に対応
    if (debugJson.length > 1900) {
      await message.reply({
        content: '🐛 **デバッグ情報** (一部省略)',
        files: [{
          attachment: Buffer.from(debugJson, 'utf-8'),
          name: 'proactive-debug.json'
        }]
      });
    } else {
      await message.reply(`🐛 **デバッグ情報**\n\`\`\`json\n${debugJson}\n\`\`\``);
    }
  }

  /**
   * !proactive help - ヘルプ表示
   * @private
   */
  async _handleHelpCommand(message) {
    await message.reply({
      embeds: [{
        title: '🤖 プロアクティブメッセージ管理コマンド',
        description: 'ボット主導でメッセージを送信する機能の管理システムです',
        color: 0x0099ff,
        fields: [
          {
            name: '`!proactive status`',
            value: 'システムの現在状態と送信条件の確認',
            inline: false
          },
          {
            name: '`!proactive check`',
            value: '手動でタイミングチェックを実行',
            inline: false
          },
          {
            name: '`!proactive start/stop/restart`',
            value: 'スケジューラーの制御（開始/停止/再起動）',
            inline: false
          },
          {
            name: '`!proactive config [debug on/off]`',
            value: '設定の表示・デバッグモード切り替え',
            inline: false
          },
          {
            name: '`!proactive stats`',
            value: '詳細な統計情報の表示',
            inline: false
          },
          {
            name: '`!proactive debug`',
            value: 'システムのデバッグ情報を出力',
            inline: false
          }
        ],
        footer: { 
          text: 'プロアクティブメッセージ機能 - 自動会話開始システム' 
        }
      }]
    });
  }
}

module.exports = { ProactiveManagementCommands };