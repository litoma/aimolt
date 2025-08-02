#!/usr/bin/env node

/**
 * Supabase Health Check Script
 * GitHub Actionsから定期実行されるSupabaseヘルスチェック
 */

const path = require('path');
// appディレクトリのnode_modulesを参照
const { createClient } = require(path.join(__dirname, '../app/node_modules/@supabase/supabase-js'));

// 環境変数の確認
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境変数が設定されていません: SUPABASE_URL, SUPABASE_KEY');
  process.exit(1);
}

console.log('🚀 Supabase Health Check 開始');
console.log(`📅 実行時刻: ${new Date().toISOString()}`);

async function healthCheck() {
  try {
    // Supabaseクライアントを初期化
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    console.log('🔗 Supabase接続を開始...');
    
    // conversationsテーブルから最新5件を取得してヘルスチェック
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      throw new Error(`Supabaseクエリエラー: ${error.message}`);
    }
    
    console.log('✅ Supabase接続成功');
    console.log(`📊 取得レコード数: ${data.length}件`);
    
    if (data.length > 0) {
      console.log('📄 最新レコード情報:');
      data.forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, User: ${record.user_id}, 作成日時: ${record.created_at}`);
      });
    } else {
      console.log('⚠️  conversationsテーブルにレコードが存在しません');
    }
    
    // 追加のヘルスチェック: 簡単な接続テスト
    const { data: healthData, error: healthError } = await supabase
      .from('conversations')
      .select('count', { count: 'exact', head: true });
    
    if (healthError) {
      throw new Error(`ヘルスチェックエラー: ${healthError.message}`);
    }
    
    console.log(`📈 conversationsテーブル総レコード数: ${healthData || 0}件`);
    console.log('🎉 ヘルスチェック完了: すべて正常');
    
  } catch (error) {
    console.error('❌ ヘルスチェック失敗:', error.message);
    console.error('🔍 エラー詳細:', error);
    process.exit(1);
  }
}

// メイン実行
healthCheck()
  .then(() => {
    console.log('✨ ヘルスチェック正常終了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 予期しないエラー:', error);
    process.exit(1);
  });