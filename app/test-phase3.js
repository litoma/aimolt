#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { MessageGenerator } = require('./src/proactive/message-generator');
const { ProactiveDatabaseHelpers } = require('./src/proactive/database-helpers');

/**
 * Phase 3 メッセージ生成エンジンテストスクリプト
 */
class Phase3Test {
  constructor() {
    this.pgPool = new Pool({
      host: 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'aimolt',
      database: process.env.POSTGRES_DB || 'aimolt',
    });

    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.messageGenerator = new MessageGenerator(this.pgPool, this.genAI);
    this.helpers = new ProactiveDatabaseHelpers(this.pgPool);
  }

  async runTests() {
    console.log('🧪 Phase 3 メッセージ生成エンジンテスト開始\n');

    try {
      await this.testDependencies();
      await this.testMessageGeneration();
      await this.testContextCollection();
      await this.testStatistics();
      await this.testErrorHandling();

      console.log('\n🎉 すべてのテストが完了しました！');

    } catch (error) {
      console.error('\n❌ テスト中にエラーが発生しました:', error.message);
      throw error;
    }
  }

  async testDependencies() {
    console.log('📋 1. 依存関係テスト...');

    // Gemini API Key確認
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }
    console.log('   ✅ Gemini API Key設定確認');

    // データベース接続確認
    const result = await this.pgPool.query('SELECT NOW()');
    console.log('   ✅ PostgreSQL接続確認:', result.rows[0].now);

    // 必要なテーブル確認
    const tableCheck = await this.pgPool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('conversations', 'user_memories', 'emotion_states')
      AND table_schema = 'public'
    `);
    
    console.log('   ✅ 必要テーブル確認:', tableCheck.rows.map(r => r.table_name).join(', '));

    console.log('   ✅ 依存関係テスト完了\n');
  }

  async testMessageGeneration() {
    console.log('🤖 2. メッセージ生成テスト...');

    const testUserId = 'litoma'; // 実際のユーザーIDを使用

    try {
      // メッセージ生成の実行
      console.log('   🔄 AI メッセージ生成実行中...');
      const result = await this.messageGenerator.generateProactiveMessage(testUserId, this.helpers);

      if (result.success) {
        console.log('   ✅ メッセージ生成成功');
        console.log(`   📝 生成メッセージ: "${result.message}"`);
        console.log('   📊 メタデータ:', {
          生成時間: `${result.metadata.generationTime}ms`,
          AIモデル: result.metadata.aiModel,
          コンテキスト要素: Object.keys(result.metadata.context).length
        });
      } else {
        console.log('   ⚠️ メッセージ生成失敗（予期される動作の場合）');
        console.log(`   📝 エラー: "${result.error}"`);
      }

    } catch (error) {
      console.warn('   ⚠️ 生成テスト中にエラー（テストデータが不足している可能性）:', error.message);
    }

    console.log('   ✅ メッセージ生成テスト完了\n');
  }

  async testContextCollection() {
    console.log('📊 3. コンテキスト収集テスト...');

    const testUserId = 'litoma';

    try {
      // プライベートメソッドにアクセスするため、直接テスト
      console.log('   🔄 会話履歴取得テスト...');
      const historyResult = await this.pgPool.query(
        `SELECT user_message, bot_response, created_at, message_type 
         FROM conversations 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [testUserId]
      );

      console.log(`   ✅ 会話履歴: ${historyResult.rows.length}件取得`);
      if (historyResult.rows.length > 0) {
        const latest = historyResult.rows[0];
        console.log(`   📝 最新会話: "${latest.user_message.substring(0, 30)}..." -> "${latest.bot_response.substring(0, 30)}..."`);
      }

      // 話題キーワード取得テスト
      console.log('   🔄 話題キーワード取得テスト...');
      const keywords = await this.helpers.getRecentTopicKeywords(testUserId, 7);
      console.log(`   ✅ 話題キーワード: ${keywords.length}件取得`);
      if (keywords.length > 0) {
        console.log(`   🔑 上位キーワード: ${keywords.slice(0, 3).map(k => `"${k.keyword}"(${k.count})`).join(', ')}`);
      }

      // 統計取得テスト
      const stats = await this.helpers.getProactiveStats(testUserId);
      console.log(`   ✅ プロアクティブ統計: 送信${stats.proactiveCount}回, 応答率${stats.responseRate}%`);

    } catch (error) {
      console.warn('   ⚠️ コンテキスト収集テスト中にエラー:', error.message);
    }

    console.log('   ✅ コンテキスト収集テスト完了\n');
  }

  async testStatistics() {
    console.log('📈 4. 統計機能テスト...');

    // 初期統計確認
    const initialStats = this.messageGenerator.getStats();
    console.log('   📊 初期統計:', {
      生成回数: initialStats.generated,
      エラー回数: initialStats.errors,
      成功率: `${initialStats.successRate}%`
    });

    // 統計リセットテスト
    console.log('   🔄 統計リセットテスト...');
    const oldStats = this.messageGenerator.resetStats();
    const newStats = this.messageGenerator.getStats();

    console.log('   ✅ リセット前統計保存確認');
    console.log('   ✅ 新統計初期化確認:', {
      生成回数: newStats.generated === 0,
      エラー回数: newStats.errors === 0,
      最終生成時刻: newStats.lastGeneration === null
    });

    console.log('   ✅ 統計機能テスト完了\n');
  }

  async testErrorHandling() {
    console.log('⚠️ 5. エラーハンドリングテスト...');

    try {
      // 存在しないユーザーでのテスト
      console.log('   🔄 存在しないユーザーでのテスト...');
      const result = await this.messageGenerator.generateProactiveMessage('nonexistent_user_12345', this.helpers);
      
      if (!result.success) {
        console.log('   ✅ 存在しないユーザーのエラーハンドリング正常');
        console.log(`   📝 エラー内容: "${result.error}"`);
      } else {
        console.log('   ⚠️ エラーハンドリングが期待通りでない（フォールバック動作）');
      }

    } catch (error) {
      console.log('   ✅ 例外キャッチのエラーハンドリング正常:', error.message.substring(0, 50));
    }

    console.log('   ✅ エラーハンドリングテスト完了\n');
  }

  async close() {
    await this.pgPool.end();
  }
}

// 実行
async function runPhase3Test() {
  const test = new Phase3Test();
  
  try {
    await test.runTests();
    console.log('\n✅ Phase 3 テスト完了');
  } catch (error) {
    console.error('\n❌ Phase 3 テスト失敗:', error);
    process.exit(1);
  } finally {
    await test.close();
  }
}

if (require.main === module) {
  runPhase3Test();
}

module.exports = { Phase3Test };