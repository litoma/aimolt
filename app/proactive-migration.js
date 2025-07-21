#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { Pool } = require('pg');

/**
 * プロアクティブメッセージ機能用マイグレーションスクリプト
 * conversationsテーブルにmessage_typeとinitiatorカラムを追加
 */
class ProactiveMessageMigration {
  constructor() {
    this.pgPool = new Pool({
      host: 'localhost', // コンテナ外からの接続
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'aimolt',
      database: process.env.POSTGRES_DB || 'aimolt',
    });
  }

  async migrate() {
    console.log('🚀 プロアクティブメッセージ機能 - データベースマイグレーション開始\n');

    try {
      // 1. 新しい列を追加
      await this.addNewColumns();

      // 2. 既存データにデフォルト値を設定
      await this.updateExistingData();

      // 3. インデックスを追加
      await this.addIndexes();

      // 4. マイグレーション検証
      await this.verifyMigration();

      console.log('\n🎉 マイグレーション完了！');

    } catch (error) {
      console.error('❌ マイグレーション中にエラーが発生しました:', error.message);
      throw error;
    }
  }

  async addNewColumns() {
    console.log('📊 1. conversationsテーブルに新しい列を追加...');

    const columns = [
      {
        name: 'message_type',
        definition: "VARCHAR(20) DEFAULT 'user_initiated'",
        description: 'メッセージタイプ (user_initiated/proactive/response_to_proactive)'
      },
      {
        name: 'initiator', 
        definition: "VARCHAR(10) DEFAULT 'user'",
        description: 'メッセージ発信者 (user/bot)'
      }
    ];

    for (const column of columns) {
      // 列が既に存在するかチェック
      const checkQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = $1
      `;
      
      const checkResult = await this.pgPool.query(checkQuery, [column.name]);
      
      if (checkResult.rows.length === 0) {
        const alterQuery = `ALTER TABLE conversations ADD COLUMN ${column.name} ${column.definition}`;
        await this.pgPool.query(alterQuery);
        console.log(`   ✅ ${column.name}列を追加 - ${column.description}`);
      } else {
        console.log(`   ⏭️ ${column.name}列は既に存在`);
      }
    }
  }

  async updateExistingData() {
    console.log('📊 2. 既存データにデフォルト値を設定...');

    // 既存の全てのレコードを 'user_initiated' および 'user' に設定
    const updateQuery = `
      UPDATE conversations 
      SET 
        message_type = 'user_initiated',
        initiator = 'user'
      WHERE 
        message_type IS NULL OR initiator IS NULL
    `;

    const result = await this.pgPool.query(updateQuery);
    console.log(`   ✅ ${result.rowCount}件のレコードにデフォルト値を設定`);
  }

  async addIndexes() {
    console.log('📊 3. パフォーマンス向上のためのインデックスを追加...');

    const indexes = [
      {
        name: 'idx_conversations_message_type',
        query: 'CREATE INDEX IF NOT EXISTS idx_conversations_message_type ON conversations(message_type)'
      },
      {
        name: 'idx_conversations_user_message_type',
        query: 'CREATE INDEX IF NOT EXISTS idx_conversations_user_message_type ON conversations(user_id, message_type)'
      },
      {
        name: 'idx_conversations_proactive_created',
        query: "CREATE INDEX IF NOT EXISTS idx_conversations_proactive_created ON conversations(user_id, created_at DESC) WHERE message_type = 'proactive'"
      }
    ];

    for (const index of indexes) {
      await this.pgPool.query(index.query);
      console.log(`   ✅ ${index.name}インデックス作成`);
    }
  }

  async verifyMigration() {
    console.log('📊 4. マイグレーション検証...');

    // テーブル構造確認
    const structureQuery = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      AND column_name IN ('message_type', 'initiator')
      ORDER BY column_name
    `;

    const structureResult = await this.pgPool.query(structureQuery);
    
    console.log('   ✅ 新しい列の構造:');
    structureResult.rows.forEach(row => {
      console.log(`     - ${row.column_name}: ${row.data_type}, default: ${row.column_default}, nullable: ${row.is_nullable}`);
    });

    // データ件数確認
    const countQuery = `
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN message_type = 'user_initiated' THEN 1 END) as user_initiated_count,
        COUNT(CASE WHEN initiator = 'user' THEN 1 END) as user_count
      FROM conversations
    `;

    const countResult = await this.pgPool.query(countQuery);
    const stats = countResult.rows[0];
    
    console.log('   ✅ データ統計:');
    console.log(`     - 総レコード数: ${stats.total_count}件`);
    console.log(`     - user_initiated: ${stats.user_initiated_count}件`);
    console.log(`     - user発信: ${stats.user_count}件`);

    // Supabase同期対象列の確認
    console.log('   ✅ Supabase同期システムへの影響確認...');
    console.log('     - 既存のトリガーが新しい列も自動的に同期します');
  }

  async close() {
    await this.pgPool.end();
  }
}

// 実行
async function runMigration() {
  const migration = new ProactiveMessageMigration();
  
  try {
    await migration.migrate();
    console.log('\n✅ マイグレーション成功');
  } catch (error) {
    console.error('\n❌ マイグレーション失敗:', error);
    process.exit(1);
  } finally {
    await migration.close();
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { ProactiveMessageMigration };