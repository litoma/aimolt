#!/usr/bin/env node
/**
 * AImolt 動的人格システム - 過去履歴分析スクリプト
 * 
 * 使用方法:
 * node initialize-personality.js
 * 
 * 機能:
 * - 全期間の会話履歴を分析
 * - 感情状態を段階的に構築
 * - 重要記憶を抽出・保存
 * - 会話分析結果を蓄積
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

// 人格システムモジュール
const { conversationAnalyzer } = require('./src/personality/analyzer');
const { emotionManager } = require('./src/personality/emotion');
const { memoryManager } = require('./src/personality/memory');
const { personalityManager } = require('./src/personality/manager');

// PostgreSQL接続設定
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'aimolt',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 設定
const TARGET_USER = 'litoma';
const BATCH_SIZE = 20; // 一度に処理する会話数
const DELAY_MS = 500;  // バッチ間の待機時間（ミリ秒）

/**
 * ユーザーIDをDiscordユーザー名から取得
 */
async function getUserIdByName(username) {
  try {
    // 実際のDiscordユーザーIDを取得する必要があります
    // この部分はDiscordのAPIやログから取得する必要があります
    
    // 仮の実装：会話履歴からユーザーIDを推測
    const result = await pgPool.query(
      'SELECT DISTINCT user_id FROM conversations LIMIT 10'
    );
    
    console.log('📋 データベース内のユーザーID一覧:');
    result.rows.forEach(row => {
      console.log(`  - ${row.user_id}`);
    });
    
    // 最初のユーザーIDを使用（lutomaが唯一のユーザーの場合）
    if (result.rows.length > 0) {
      return result.rows[0].user_id;
    }
    
    throw new Error('ユーザーIDが見つかりません');
  } catch (error) {
    console.error('ユーザーID取得エラー:', error.message);
    throw error;
  }
}

/**
 * 過去の会話履歴を取得
 */
async function getHistoricalConversations(userId) {
  try {
    const result = await pgPool.query(
      `SELECT id, user_id, user_message, bot_response, created_at 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [userId]
    );
    
    console.log(`📚 取得した会話履歴: ${result.rows.length}件`);
    return result.rows;
  } catch (error) {
    console.error('会話履歴取得エラー:', error.message);
    throw error;
  }
}

/**
 * 会話が重要な記憶として保存すべきかを判定
 */
function shouldSaveAsMemory(conversation, analysisData) {
  // 重要度スコア7以上は必ず保存
  if (analysisData.importance_score >= 7) {
    return true;
  }
  
  // 感情的に強い内容は保存
  if (analysisData.emotion_detected && 
      ['joy', 'sadness', 'anger', 'love', 'gratitude', 'excitement'].includes(analysisData.emotion_detected)) {
    return true;
  }
  
  // 質問や相談は保存
  if (conversation.user_message.match(/質問|聞きたい|教えて|相談|悩み|困った|どうして|なぜ|なんで/gi)) {
    return true;
  }
  
  // 個人的な情報は保存
  if (conversation.user_message.match(/私は|僕は|自分は|好き|嫌い|趣味|仕事|学校|家族|友達/gi)) {
    return true;
  }
  
  // 長いメッセージは保存
  if (conversation.user_message.length > 100) {
    return true;
  }
  
  return false;
}

/**
 * 記憶タイプを決定
 */
function determineMemoryType(conversation, analysisData) {
  const message = conversation.user_message;
  
  // 個人的な特徴や性格
  if (message.match(/私は|僕は|自分は.*な人|性格|特徴|得意|苦手/gi)) {
    return 'trait';
  }
  
  // 好みや嗜好
  if (message.match(/好き|嫌い|趣味|興味|愛用|お気に入り/gi)) {
    return 'preference';
  }
  
  // 重要な出来事
  if (analysisData.importance_score >= 8) {
    return 'important_event';
  }
  
  // 学習や知識
  if (message.match(/学んだ|覚えた|知った|理解した|勉強|練習/gi)) {
    return 'fact';
  }
  
  return 'important_event';
}

/**
 * 感情的重みを計算
 */
function calculateEmotionalWeight(analysisData) {
  let weight = 0;
  
  // 感情に基づく重み
  const emotionWeights = {
    'joy': 6,
    'love': 8,
    'gratitude': 7,
    'excitement': 5,
    'curiosity': 3,
    'surprise': 2,
    'sadness': -4,
    'anger': -6,
    'fear': -5,
    'frustration': -3
  };
  
  if (analysisData.emotion_detected && emotionWeights[analysisData.emotion_detected]) {
    weight += emotionWeights[analysisData.emotion_detected];
  }
  
  // センチメントに基づく重み
  if (analysisData.sentiment === 'positive') {
    weight += 2;
  } else if (analysisData.sentiment === 'negative') {
    weight -= 2;
  }
  
  // 重要度による調整
  if (analysisData.importance_score >= 8) {
    weight += 2;
  } else if (analysisData.importance_score <= 3) {
    weight -= 1;
  }
  
  return Math.max(-10, Math.min(10, weight));
}

/**
 * 時間減衰を考慮した感情更新
 */
function applyTimeDecay(baseEmotion, conversationDate) {
  const now = new Date();
  const conversationTime = new Date(conversationDate);
  const daysSinceConversation = (now - conversationTime) / (1000 * 60 * 60 * 24);
  
  // 古い会話ほど感情への影響を減らす
  const decayFactor = Math.max(0.1, 1 - (daysSinceConversation / 365)); // 1年で90%減衰
  
  return {
    energy: Math.round(baseEmotion.energy * decayFactor),
    intimacy: Math.round(baseEmotion.intimacy * decayFactor),
    interest: Math.round(baseEmotion.interest * decayFactor)
  };
}

/**
 * 会話バッチを処理
 */
async function processConversationBatch(userId, conversations, batchIndex) {
  const batchStart = batchIndex * BATCH_SIZE;
  const batchEnd = Math.min(batchStart + BATCH_SIZE, conversations.length);
  const batch = conversations.slice(batchStart, batchEnd);
  
  console.log(`📝 バッチ ${batchIndex + 1} を処理中... (${batchStart + 1}-${batchEnd}/${conversations.length})`);
  
  for (const conversation of batch) {
    try {
      // 1. 会話分析
      const analysisData = await conversationAnalyzer.analyzeMessage(
        userId, 
        conversation.user_message, 
        conversation.id?.toString()
      );
      
      // 2. 感情状態更新（時間減衰を考慮）
      const baseEmotionImpact = emotionManager.calculateEmotionUpdate(
        await emotionManager.getCurrentEmotion(userId),
        analysisData
      );
      
      const decayedImpact = applyTimeDecay(baseEmotionImpact, conversation.created_at);
      
      // 感情を段階的に更新
      await emotionManager.updateEmotion(userId, {
        ...analysisData,
        decayed_impact: decayedImpact
      });
      
      // 3. 重要記憶の保存判定
      if (shouldSaveAsMemory(conversation, analysisData)) {
        const memoryType = determineMemoryType(conversation, analysisData);
        const emotionalWeight = calculateEmotionalWeight(analysisData);
        
        // 記憶内容を生成
        const memoryContent = `[${conversation.created_at.toISOString().split('T')[0]}] ${conversation.user_message}`;
        
        await memoryManager.saveImportantMemory(
          userId,
          memoryContent,
          memoryType,
          analysisData.keywords || [],
          analysisData.importance_score,
          emotionalWeight
        );
      }
      
      // 処理済みマーカー
      process.stdout.write('.');
      
    } catch (error) {
      console.error(`\n❌ 会話処理エラー (ID: ${conversation.id}):`, error.message);
      // エラーが発生しても処理を続行
    }
  }
  
  console.log(`\n✅ バッチ ${batchIndex + 1} 完了`);
}

/**
 * 進捗状況を表示
 */
async function showProgress(userId) {
  try {
    const [emotionResult, memoryResult, analysisResult] = await Promise.all([
      pgPool.query('SELECT COUNT(*) as count FROM emotion_states WHERE user_id = $1', [userId]),
      pgPool.query('SELECT COUNT(*) as count FROM user_memories WHERE user_id = $1', [userId]),
      pgPool.query('SELECT COUNT(*) as count FROM conversation_analysis WHERE user_id = $1', [userId])
    ]);
    
    console.log('📊 現在の処理状況:');
    console.log(`  - 感情状態: ${emotionResult.rows[0].count}件`);
    console.log(`  - 記憶: ${memoryResult.rows[0].count}件`);
    console.log(`  - 分析結果: ${analysisResult.rows[0].count}件`);
    
    // 感情状態の詳細
    if (emotionResult.rows[0].count > 0) {
      const emotionDetail = await pgPool.query(
        'SELECT energy_level, intimacy_level, interest_level, mood_type, conversation_count FROM emotion_states WHERE user_id = $1',
        [userId]
      );
      
      const emotion = emotionDetail.rows[0];
      console.log('💫 現在の感情状態:');
      console.log(`  - 元気度: ${emotion.energy_level}/100`);
      console.log(`  - 親密度: ${emotion.intimacy_level}/100`);
      console.log(`  - 興味度: ${emotion.interest_level}/100`);
      console.log(`  - ムード: ${emotion.mood_type}`);
      console.log(`  - 会話回数: ${emotion.conversation_count}`);
    }
    
  } catch (error) {
    console.error('進捗表示エラー:', error.message);
  }
}

/**
 * 最終統計を表示
 */
async function showFinalStats(userId) {
  try {
    console.log('\n🎯 最終統計情報:');
    
    // ユーザープロファイル生成
    const userProfile = await memoryManager.buildUserProfile(userId);
    console.log('\n👤 ユーザープロファイル:');
    console.log(`  概要: ${userProfile.summary}`);
    
    if (userProfile.traits.length > 0) {
      console.log('\n🎭 主な性格特徴:');
      userProfile.traits.slice(0, 5).forEach((trait, index) => {
        console.log(`  ${index + 1}. ${trait.trait} (強度: ${trait.strength.toFixed(1)}, 出現: ${trait.frequency}回)`);
      });
    }
    
    if (userProfile.interests.length > 0) {
      console.log('\n🎯 主な興味・関心:');
      userProfile.interests.slice(0, 5).forEach((interest, index) => {
        console.log(`  ${index + 1}. ${interest.topic} (頻度: ${interest.frequency}回, 重要度: ${interest.averageImportance.toFixed(1)})`);
      });
    }
    
    console.log('\n😊 感情傾向:');
    console.log(`  - ポジティブ: ${(userProfile.emotionalTendencies.positiveRatio * 100).toFixed(1)}%`);
    console.log(`  - ネガティブ: ${(userProfile.emotionalTendencies.negativeRatio * 100).toFixed(1)}%`);
    console.log(`  - 中性: ${(userProfile.emotionalTendencies.neutralRatio * 100).toFixed(1)}%`);
    
    // 記憶の内訳
    const memoryTypes = await pgPool.query(
      'SELECT memory_type, COUNT(*) as count FROM user_memories WHERE user_id = $1 GROUP BY memory_type ORDER BY count DESC',
      [userId]
    );
    
    console.log('\n🧠 記憶の内訳:');
    memoryTypes.rows.forEach(row => {
      console.log(`  - ${row.memory_type}: ${row.count}件`);
    });
    
  } catch (error) {
    console.error('統計表示エラー:', error.message);
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 AImolt 過去履歴分析スクリプト開始');
  console.log(`👤 対象ユーザー: ${TARGET_USER}`);
  console.log(`⚙️  バッチサイズ: ${BATCH_SIZE}件`);
  console.log(`⏱️  バッチ間隔: ${DELAY_MS}ms`);
  
  try {
    // 1. ユーザーIDを取得
    console.log('\n📋 ユーザーIDを取得中...');
    const userId = await getUserIdByName(TARGET_USER);
    console.log(`✅ ユーザーID: ${userId}`);
    
    // 2. 既存の人格データをチェック
    console.log('\n🔍 既存データをチェック中...');
    await showProgress(userId);
    
    // 3. 過去の会話履歴を取得
    console.log('\n📚 過去の会話履歴を取得中...');
    const conversations = await getHistoricalConversations(userId);
    
    if (conversations.length === 0) {
      console.log('⚠️  会話履歴が見つかりませんでした。');
      return;
    }
    
    console.log(`📊 処理対象: ${conversations.length}件の会話`);
    console.log(`🔄 予想処理時間: 約${Math.ceil(conversations.length / BATCH_SIZE * (DELAY_MS / 1000))}秒`);
    
    // 4. 確認プロンプト
    console.log('\n❓ 処理を開始しますか？ (Ctrl+C で中断)');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 5. バッチ処理開始
    console.log('\n🔄 バッチ処理を開始...');
    const startTime = Date.now();
    
    const totalBatches = Math.ceil(conversations.length / BATCH_SIZE);
    for (let i = 0; i < totalBatches; i++) {
      await processConversationBatch(userId, conversations, i);
      
      // 進捗表示
      const progress = ((i + 1) / totalBatches * 100).toFixed(1);
      console.log(`📈 進捗: ${progress}% (${i + 1}/${totalBatches})`);
      
      // 中間進捗を表示
      if ((i + 1) % 10 === 0) {
        await showProgress(userId);
      }
      
      // 最後のバッチでなければ待機
      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    const endTime = Date.now();
    const processingTime = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`\n🎉 処理完了！ (処理時間: ${processingTime}秒)`);
    
    // 6. 最終統計を表示
    await showFinalStats(userId);
    
    // 7. 人格システムのスナップショット
    console.log('\n📸 人格システムスナップショット:');
    const snapshot = await personalityManager.getPersonalitySnapshot(userId);
    console.log(`  - 最終更新: ${snapshot.lastUpdated}`);
    console.log(`  - 感情状態: ${snapshot.emotion.description}`);
    
    console.log('\n✨ 初期化が完了しました！AImoltが新しい人格でお待ちしています。');
    
  } catch (error) {
    console.error('\n❌ 処理エラー:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // データベース接続を閉じる
    await pgPool.end();
  }
}

// スクリプトが直接実行された場合
if (require.main === module) {
  main().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

module.exports = { main };