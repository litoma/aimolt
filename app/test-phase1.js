#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');
const { ProactiveDatabaseHelpers } = require('./src/proactive/database-helpers');

/**
 * Phase 1 機能テストスクリプト
 */
class Phase1Test {
  constructor() {
    this.pgPool = new Pool({
      host: 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'aimolt',
      database: process.env.POSTGRES_DB || 'aimolt',
    });
    
    this.helpers = new ProactiveDatabaseHelpers(this.pgPool);
  }

  async runTests() {
    console.log('🧪 Phase 1 機能テスト開始\n');

    try {
      await this.testTableStructure();
      await this.testHelperFunctions();
      await this.testProactiveMessageSaving();
      await this.testUserResponseSaving();
      await this.testStatisticsRetrieval();
      await this.testTopicKeywordExtraction();

      console.log('\n🎉 すべてのテストが完了しました！');

    } catch (error) {
      console.error('\n❌ テスト中にエラーが発生しました:', error.message);
      throw error;
    }
  }

  async testTableStructure() {
    console.log('📋 1. テーブル構造テスト...');

    // 新しい列の存在確認
    const result = await this.pgPool.query(
      `SELECT column_name, data_type, column_default 
       FROM information_schema.columns 
       WHERE table_name = 'conversations' 
       AND column_name IN ('message_type', 'initiator')
       ORDER BY column_name`
    );

    console.log('   ✅ 新しい列の確認:');
    result.rows.forEach(row => {
      console.log(`     - ${row.column_name}: ${row.data_type} (default: ${row.column_default})`);
    });

    if (result.rows.length !== 2) {
      throw new Error('Expected 2 new columns, found ' + result.rows.length);
    }

    console.log('   ✅ テーブル構造テスト完了\n');
  }

  async testHelperFunctions() {
    console.log('⚙️ 2. ヘルパー関数テスト...');

    const testUserId = 'test_user_phase1';

    // 最初は履歴なしのはず
    const lastConv = await this.helpers.getLastConversationTime(testUserId);
    const lastProactive = await this.helpers.getLastProactiveMessageTime(testUserId);

    console.log(`   ✅ 初期状態 - 最後の会話: ${lastConv.toISOString()}`);
    console.log(`   ✅ 初期状態 - 最後のプロアクティブ: ${lastProactive.toISOString()}`);

    // 1970年になっているはず
    if (lastConv.getTime() !== 0 || lastProactive.getTime() !== 0) {
      throw new Error('Expected initial times to be epoch (1970)');
    }

    console.log('   ✅ ヘルパー関数テスト完了\n');
  }

  async testProactiveMessageSaving() {
    console.log('🤖 3. プロアクティブメッセージ保存テスト...');

    const testUserId = 'test_user_phase1';
    const testMessage = 'こんにちは！元気にしてる？最近どうですか？';

    // プロアクティブメッセージ保存
    const saveResult = await this.helpers.saveProactiveMessage(testUserId, testMessage);

    if (!saveResult) {
      throw new Error('Failed to save proactive message');
    }

    // 保存されたデータを確認
    const result = await this.pgPool.query(
      `SELECT user_message, bot_response, message_type, initiator 
       FROM conversations 
       WHERE user_id = $1 AND message_type = 'proactive'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [testUserId]
    );

    if (result.rows.length === 0) {
      throw new Error('Proactive message not found in database');
    }

    const saved = result.rows[0];
    console.log('   ✅ 保存されたプロアクティブメッセージ:');
    console.log(`     - user_message: "${saved.user_message}"`);
    console.log(`     - bot_response: "${saved.bot_response}"`);
    console.log(`     - message_type: "${saved.message_type}"`);
    console.log(`     - initiator: "${saved.initiator}"`);

    if (saved.message_type !== 'proactive' || saved.initiator !== 'bot') {
      throw new Error('Incorrect message_type or initiator for proactive message');
    }

    console.log('   ✅ プロアクティブメッセージ保存テスト完了\n');
  }

  async testUserResponseSaving() {
    console.log('👤 4. ユーザー応答保存テスト...');

    const testUserId = 'test_user_phase1';
    const userMessage = 'おかげさまで元気です！';
    const botResponse = 'それは良かった！';

    // ユーザー応答保存（プロアクティブメッセージへの応答として）
    const saveResult = await this.helpers.saveUserResponse(testUserId, userMessage, botResponse);

    if (!saveResult) {
      throw new Error('Failed to save user response');
    }

    // 保存されたデータを確認
    const result = await this.pgPool.query(
      `SELECT user_message, bot_response, message_type, initiator 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [testUserId]
    );

    const saved = result.rows[0];
    console.log('   ✅ 保存されたユーザー応答:');
    console.log(`     - user_message: "${saved.user_message}"`);
    console.log(`     - bot_response: "${saved.bot_response}"`);
    console.log(`     - message_type: "${saved.message_type}"`);
    console.log(`     - initiator: "${saved.initiator}"`);

    // プロアクティブメッセージの直後なので 'response_to_proactive' になるはず
    if (saved.message_type !== 'response_to_proactive' || saved.initiator !== 'user') {
      throw new Error(`Expected response_to_proactive/user, got ${saved.message_type}/${saved.initiator}`);
    }

    console.log('   ✅ ユーザー応答保存テスト完了\n');
  }

  async testStatisticsRetrieval() {
    console.log('📊 5. 統計情報取得テスト...');

    const testUserId = 'test_user_phase1';
    const stats = await this.helpers.getProactiveStats(testUserId);

    console.log('   ✅ プロアクティブメッセージ統計:');
    console.log(`     - プロアクティブ送信数: ${stats.proactiveCount}`);
    console.log(`     - 応答受信数: ${stats.responseCount}`);
    console.log(`     - 通常会話数: ${stats.userInitiatedCount}`);
    console.log(`     - 応答率: ${stats.responseRate}%`);
    console.log(`     - 最後のプロアクティブ: ${stats.lastProactive?.toISOString() || 'なし'}`);
    console.log(`     - 最後の会話: ${stats.lastConversation?.toISOString() || 'なし'}`);

    // 期待値チェック
    if (stats.proactiveCount !== 1 || stats.responseCount !== 1) {
      throw new Error(`Expected 1 proactive and 1 response, got ${stats.proactiveCount}/${stats.responseCount}`);
    }

    if (stats.responseRate !== 100.0) {
      throw new Error(`Expected 100% response rate, got ${stats.responseRate}%`);
    }

    console.log('   ✅ 統計情報取得テスト完了\n');
  }

  async testTopicKeywordExtraction() {
    console.log('🔍 6. 話題キーワード抽出テスト...');

    const testUserId = 'litoma'; // 実際のユーザーデータを使用

    const keywords = await this.helpers.getRecentTopicKeywords(testUserId);

    console.log(`   ✅ 抽出されたキーワード (上位${Math.min(keywords.length, 5)}個):`);
    keywords.slice(0, 5).forEach((item, index) => {
      console.log(`     ${index + 1}. "${item.keyword}" (出現回数: ${item.count})`);
    });

    console.log('   ✅ 話題キーワード抽出テスト完了\n');
  }

  async cleanup() {
    // テスト用データの削除
    console.log('🧹 テストデータのクリーンアップ...');
    
    await this.pgPool.query(
      "DELETE FROM conversations WHERE user_id = 'test_user_phase1'"
    );

    console.log('   ✅ クリーンアップ完了');
  }

  async close() {
    await this.pgPool.end();
  }
}

// 実行
async function runPhase1Test() {
  const test = new Phase1Test();
  
  try {
    await test.runTests();
    await test.cleanup();
    console.log('\n✅ Phase 1 テスト完了');
  } catch (error) {
    console.error('\n❌ Phase 1 テスト失敗:', error);
    process.exit(1);
  } finally {
    await test.close();
  }
}

if (require.main === module) {
  runPhase1Test();
}

module.exports = { Phase1Test };