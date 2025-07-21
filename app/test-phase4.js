#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');
const { DiscordSender } = require('./src/proactive/discord-sender');
const { ProactiveResponseHandler } = require('./src/proactive/response-handler');
const { ProactiveDatabaseHelpers } = require('./src/proactive/database-helpers');

/**
 * Phase 4 Discord送信システムテストスクリプト
 */
class Phase4Test {
  constructor() {
    this.pgPool = new Pool({
      host: 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'aimolt',
      database: process.env.POSTGRES_DB || 'aimolt',
    });

    this.discordSender = new DiscordSender();
    this.helpers = new ProactiveDatabaseHelpers(this.pgPool);
    this.responseHandler = new ProactiveResponseHandler(this.pgPool, this.helpers);
  }

  async runTests() {
    console.log('🧪 Phase 4 Discord送信システムテスト開始\n');

    try {
      await this.testDependencies();
      await this.testDiscordSender();
      await this.testResponseHandler();
      await this.testMessageTypeRecording();
      await this.testStatistics();

      console.log('\n🎉 すべてのテストが完了しました！');

    } catch (error) {
      console.error('\n❌ テスト中にエラーが発生しました:', error.message);
      throw error;
    }
  }

  async testDependencies() {
    console.log('📋 1. 依存関係テスト...');

    // データベース接続確認
    const result = await this.pgPool.query('SELECT NOW()');
    console.log('   ✅ PostgreSQL接続確認:', result.rows[0].now);

    // プロアクティブ関連テーブル確認
    const tableCheck = await this.pgPool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
        AND column_name IN ('message_type', 'initiator')
    `);
    
    if (parseInt(tableCheck.rows[0].count) >= 2) {
      console.log('   ✅ conversationsテーブル拡張確認 (message_type, initiator列)');
    } else {
      console.warn('   ⚠️ conversationsテーブル拡張が見つからない（Phase 1のマイグレーション必要）');
    }

    console.log('   ✅ 依存関係テスト完了\n');
  }

  async testDiscordSender() {
    console.log('📤 2. DiscordSender機能テスト...');

    // メッセージ前処理テスト
    console.log('   🔄 メッセージ前処理テスト...');
    
    try {
      // モックチャンネルオブジェクト（実際のDiscordチャンネルがない場合）
      const mockChannel = {
        id: 'mock_channel_123',
        name: 'test-channel',
        isTextBased: () => true,
        send: async (message) => {
          console.log(`   📝 モック送信: "${message.substring(0, 50)}..."`);
          return { id: `mock_message_${Date.now()}` };
        },
        sendTyping: async () => {
          console.log('   ⌨️ モックタイピング開始');
        },
        client: { user: { id: 'mock_bot_id' } },
        permissionsFor: () => ({
          has: () => true  // 権限あり
        })
      };

      // 権限確認テスト
      const permissionCheck = await this.discordSender.checkChannelPermissions(mockChannel);
      console.log(`   ✅ 権限確認: ${permissionCheck.canSend ? '送信可能' : '送信不可'}`);

      // モック送信テスト
      const sendResult = await this.discordSender.sendProactiveMessage(
        mockChannel,
        'テストメッセージです！これはPhase 4のテスト送信です。',
        { showTyping: false }
      );

      if (sendResult.success) {
        console.log('   ✅ モック送信成功');
        console.log(`   📊 送信メタデータ: ${sendResult.metadata.sendTime}ms`);
      } else {
        console.log('   ⚠️ モック送信失敗:', sendResult.error);
      }

    } catch (error) {
      console.warn('   ⚠️ DiscordSender テスト中にエラー（実際のDiscord接続が必要）:', error.message);
    }

    console.log('   ✅ DiscordSender機能テスト完了\n');
  }

  async testResponseHandler() {
    console.log('🎯 3. 応答処理システムテスト...');

    const testUserId = 'test_user_phase4';
    const testMessageId = `test_msg_${Date.now()}`;

    try {
      // 応答追跡開始テスト
      console.log('   🔄 応答追跡開始テスト...');
      this.responseHandler.startTrackingResponse(testUserId, testMessageId);
      
      const trackedUsers = this.responseHandler.getCurrentlyTracked();
      console.log(`   ✅ 追跡開始成功 - 追跡中ユーザー: ${trackedUsers.length}名`);

      // 応答判定テスト（即座に応答）
      console.log('   🔄 応答判定テスト...');
      const responseCheck = await this.responseHandler.checkIfResponse(
        testUserId, 
        'テスト応答メッセージです',
        new Date()
      );

      if (responseCheck.isResponse) {
        console.log(`   ✅ 応答検出成功 - タイプ: ${responseCheck.responseType}, 応答時間: ${Math.round(responseCheck.responseTime / 1000)}秒`);
      } else {
        console.log(`   ⚠️ 応答非検出 - 理由: ${responseCheck.responseType}`);
      }

      // 統計確認
      const responseStats = this.responseHandler.getStats();
      console.log('   📊 応答処理統計:', {
        検出回数: responseStats.responsesDetected,
        応答率: `${responseStats.responseRate}%`,
        追跡中: responseStats.currentlyTracking
      });

      // クリーンアップ
      this.responseHandler.stopTracking(testUserId);

    } catch (error) {
      console.warn('   ⚠️ 応答処理テスト中にエラー:', error.message);
    }

    console.log('   ✅ 応答処理システムテスト完了\n');
  }

  async testMessageTypeRecording() {
    console.log('📝 4. メッセージタイプ記録テスト...');

    const testUserId = 'test_user_phase4';

    try {
      // プロアクティブメッセージ保存テスト
      console.log('   🔄 プロアクティブメッセージ保存テスト...');
      const proactiveSave = await this.helpers.saveProactiveMessage(
        testUserId,
        'Phase 4 テスト用プロアクティブメッセージです'
      );

      if (proactiveSave) {
        console.log('   ✅ プロアクティブメッセージ保存成功');
      }

      // 応答メッセージ保存テスト
      console.log('   🔄 応答メッセージ保存テスト...');
      const responseSave = await this.responseHandler.saveUserMessage(
        testUserId,
        'ありがとう！元気だよ！',
        'それは良かった！何か新しいことあった？'
      );

      if (responseSave.success) {
        console.log(`   ✅ 応答メッセージ保存成功 - タイプ: ${responseSave.messageType}`);
      } else {
        console.log('   ⚠️ 応答メッセージ保存失敗:', responseSave.error);
      }

      // データベース確認
      const verificationResult = await this.pgPool.query(
        `SELECT message_type, initiator, user_message, bot_response 
         FROM conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 2`,
        [testUserId]
      );

      console.log('   📋 保存データ確認:');
      verificationResult.rows.forEach((row, index) => {
        console.log(`     ${index + 1}. タイプ: ${row.message_type}, 発信者: ${row.initiator}, メッセージ: "${row.user_message}"`);
      });

    } catch (error) {
      console.warn('   ⚠️ メッセージタイプ記録テスト中にエラー:', error.message);
    }

    console.log('   ✅ メッセージタイプ記録テスト完了\n');
  }

  async testStatistics() {
    console.log('📊 5. 統計機能テスト...');

    // DiscordSender統計
    const senderStats = this.discordSender.getStats();
    console.log('   📤 DiscordSender統計:', {
      送信数: senderStats.messagesSent,
      エラー数: senderStats.sendErrors,
      成功率: `${senderStats.successRate}%`,
      平均送信時間: `${senderStats.averageSendTime}ms`
    });

    // ResponseHandler統計
    const responseStats = this.responseHandler.getStats();
    console.log('   🎯 ResponseHandler統計:', {
      応答検出数: responseStats.responsesDetected,
      タイムアウト数: responseStats.responseTimeouts,
      応答率: `${responseStats.responseRate}%`,
      平均応答時間: `${responseStats.averageResponseTime}ms`
    });

    // プロアクティブ統計
    const testUserId = 'test_user_phase4';
    const proactiveStats = await this.helpers.getProactiveStats(testUserId);
    console.log('   🤖 プロアクティブ統計:', {
      プロアクティブ送信: proactiveStats.proactiveCount,
      応答受信: proactiveStats.responseCount,
      応答率: `${proactiveStats.responseRate}%`
    });

    console.log('   ✅ 統計機能テスト完了\n');
  }

  async cleanup() {
    // テスト用データの削除
    console.log('🧹 テストデータのクリーンアップ...');
    
    await this.pgPool.query(
      "DELETE FROM conversations WHERE user_id = 'test_user_phase4'"
    );

    // リソースクリーンアップ
    this.responseHandler.cleanup();
    this.discordSender.cleanup();

    console.log('   ✅ クリーンアップ完了');
  }

  async close() {
    await this.pgPool.end();
  }
}

// 実行
async function runPhase4Test() {
  const test = new Phase4Test();
  
  try {
    await test.runTests();
    await test.cleanup();
    console.log('\n✅ Phase 4 テスト完了');
  } catch (error) {
    console.error('\n❌ Phase 4 テスト失敗:', error);
    process.exit(1);
  } finally {
    await test.close();
  }
}

if (require.main === module) {
  runPhase4Test();
}

module.exports = { Phase4Test };