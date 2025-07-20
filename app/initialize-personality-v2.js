#!/usr/bin/env node
/**
 * AImolt 動的人格システム v2.0 - 過去履歴分析スクリプト
 * 
 * 使用方法:
 * node initialize-personality-v2.js
 * 
 * 機能:
 * - VAD感情モデルでの履歴分析
 * - 関係性プロファイル構築
 * - Big Five人格特性の初期化
 * - 会話履歴からの包括的インポート
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');

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
const BATCH_SIZE = 50;
const DELAY_MS = 300;

/**
 * VAD感情分析エンジン
 */
class VADAnalyzer {
  analyzeVAD(message) {
    const valence = this.calculateValence(message);
    const arousal = this.calculateArousal(message);
    const dominance = this.calculateDominance(message);
    
    return { valence, arousal, dominance };
  }

  calculateValence(message) {
    const positivePatterns = [
      /嬉しい|楽しい|好き|最高|ありがと|幸せ|喜び|素晴らしい|良い|面白い/gi,
      /やった|成功|達成|完了|クリア|解決|できた|よかった|安心/gi,
      /笑|www|ｗ|爆笑|へー|すごい|さすが|いいね|オッケー|OK/gi
    ];
    
    const negativePatterns = [
      /悲しい|つらい|辛い|嫌|ダメ|最悪|ひどい|むかつく|腹立つ|怒り/gi,
      /疲れた|しんどい|きつい|大変|困った|難しい|無理|失敗|負け/gi,
      /心配|不安|怖い|恐い|びっくり|驚き|ショック|がっかり/gi
    ];

    let score = 50; // ニュートラルベース
    
    positivePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 8;
    });
    
    negativePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 8;
    });

    return Math.max(0, Math.min(100, score));
  }

  calculateArousal(message) {
    const highArousalPatterns = [
      /！|!|やった|すごい|びっくり|急いで|興奮|テンション|盛り上がる/gi,
      /熱い|燃える|アツい|ワクワク|ドキドキ|はやく|今すぐ/gi
    ];
    
    const lowArousalPatterns = [
      /疲れた|眠い|ゆっくり|落ち着く|静か|穏やか|のんびり|リラックス/gi
    ];

    let score = 50;
    
    highArousalPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 10;
    });
    
    lowArousalPatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 8;
    });

    // メッセージの長さと句読点も覚醒度に影響
    if (message.length > 100) score += 5;
    const exclamationCount = (message.match(/！|!/g) || []).length;
    score += exclamationCount * 3;

    return Math.max(0, Math.min(100, score));
  }

  calculateDominance(message) {
    const highDominancePatterns = [
      /決める|指示|命令|やってください|しなければ|すべき|必要|重要/gi,
      /私が|僕が|確信|絶対|間違いない|当然|明らか|決定/gi
    ];
    
    const lowDominancePatterns = [
      /お願い|助けて|わからない|困った|どうしよう|教えて|聞きたい/gi,
      /すみません|申し訳|恐縮|もしよろしければ|できれば/gi
    ];

    let score = 50;
    
    highDominancePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score += matches.length * 12;
    });
    
    lowDominancePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) score -= matches.length * 10;
    });

    return Math.max(0, Math.min(100, score));
  }

  mapVADToEmotion(vad) {
    const { valence, arousal, dominance } = vad;
    
    if (valence >= 70 && arousal >= 70 && dominance >= 60) return 'excitement';
    if (valence >= 70 && arousal >= 50) return 'joy';
    if (valence >= 60 && arousal <= 40) return 'serenity';
    if (valence <= 30 && arousal >= 70 && dominance >= 60) return 'anger';
    if (valence <= 30 && arousal >= 70 && dominance <= 40) return 'fear';
    if (valence <= 30 && arousal <= 40) return 'sadness';
    if (valence >= 40 && valence <= 60 && arousal >= 70) return 'surprise';
    if (valence <= 35 && arousal >= 50 && dominance >= 50) return 'disgust';
    if (valence >= 60 && arousal <= 50 && dominance <= 50) return 'trust';
    if (valence >= 55 && arousal >= 60 && dominance >= 45) return 'anticipation';
    
    return 'neutral';
  }
}

/**
 * 関係性アナライザー
 */
class RelationshipAnalyzer {
  analyzeRelationshipFactors(message, vad) {
    return {
      affectionChange: this.calculateAffectionChange(message, vad),
      trustChange: this.calculateTrustChange(message, vad),
      comfortChange: this.calculateComfortChange(message, vad),
      formalityLevel: this.assessFormalityLevel(message),
      personalInfo: this.extractPersonalInfo(message)
    };
  }

  calculateAffectionChange(message, vad) {
    let change = 0;
    
    // ポジティブな感情は好感度上昇
    if (vad.valence > 60) change += 2;
    if (vad.valence < 40) change -= 1;
    
    // 感謝表現は大きく好感度上昇
    if (message.match(/ありがと|感謝|おかげ|助かる|お世話/gi)) {
      change += 5;
    }
    
    // 質問や相談は信頼の表れ
    if (message.match(/質問|相談|聞きたい|教えて|どうして|なぜ/gi)) {
      change += 3;
    }

    return Math.max(-10, Math.min(10, change));
  }

  calculateTrustChange(message, vad) {
    let change = 0;
    
    // 個人的な情報の共有は信頼度上昇
    if (message.match(/実は|本当は|秘密|相談|悩み|個人的|プライベート/gi)) {
      change += 4;
    }
    
    // 継続的なポジティブな交流
    if (vad.valence > 65 && message.length > 50) {
      change += 2;
    }

    return Math.max(-5, Math.min(8, change));
  }

  calculateComfortChange(message, vad) {
    let change = 0;
    
    // ユーモアがある交流
    if (message.match(/笑|www|ｗ|面白い|冗談|ジョーク/gi)) {
      change += 2;
    }
    
    // カジュアルな表現
    if (message.match(/〜だよ|〜だね|〜かな|ちょっと|なんか/gi)) {
      change += 1;
    }

    return Math.max(-3, Math.min(5, change));
  }

  assessFormalityLevel(message) {
    const formalPatterns = /です|ます|である|いたします|いただき|お疲れ様|失礼/gi;
    const casualPatterns = /だよ|だね|〜じゃん|〜かな|ちょっと|なんか/gi;
    
    const formalCount = (message.match(formalPatterns) || []).length;
    const casualCount = (message.match(casualPatterns) || []).length;
    
    if (formalCount > casualCount) return 'formal';
    if (casualCount > formalCount) return 'casual';
    return 'polite';
  }

  extractPersonalInfo(message) {
    const personalPatterns = {
      interests: /好き|嫌い|趣味|興味|愛用|お気に入り/gi,
      traits: /私は|僕は|自分は.*な人|性格|特徴|得意|苦手/gi,
      work: /仕事|会社|職場|バイト|働く|勤務/gi,
      lifestyle: /家|住んで|生活|日常|毎日|いつも/gi
    };

    const extracted = {};
    Object.entries(personalPatterns).forEach(([category, pattern]) => {
      if (message.match(pattern)) {
        extracted[category] = true;
      }
    });

    return extracted;
  }
}

/**
 * メイン処理クラス
 */
class PersonalityInitializerV2 {
  constructor() {
    this.vadAnalyzer = new VADAnalyzer();
    this.relationshipAnalyzer = new RelationshipAnalyzer();
  }

  async initializeSchema() {
    console.log('🏗️  データベーススキーマを初期化中...');
    
    // bot_personalityテーブル作成
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS bot_personality (
        id SERIAL PRIMARY KEY,
        bot_instance VARCHAR(50) DEFAULT 'aimolt',
        openness INTEGER DEFAULT 75,
        conscientiousness INTEGER DEFAULT 65,
        extraversion INTEGER DEFAULT 80,
        agreeableness INTEGER DEFAULT 85,
        neuroticism INTEGER DEFAULT 25,
        humor_level INTEGER DEFAULT 70,
        curiosity INTEGER DEFAULT 85,
        supportiveness INTEGER DEFAULT 90,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // user_relationshipsテーブル作成
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS user_relationships (
        user_id VARCHAR(20) PRIMARY KEY,
        affection_level INTEGER DEFAULT 50,
        trust_level INTEGER DEFAULT 50,
        respect_level INTEGER DEFAULT 70,
        comfort_level INTEGER DEFAULT 40,
        relationship_stage VARCHAR(20) DEFAULT 'stranger',
        conversation_count INTEGER DEFAULT 0,
        meaningful_interactions INTEGER DEFAULT 0,
        preferred_formality VARCHAR(15) DEFAULT 'casual',
        communication_pace VARCHAR(15) DEFAULT 'normal',
        humor_receptivity INTEGER DEFAULT 50,
        known_interests TEXT[],
        avoided_topics TEXT[],
        positive_triggers TEXT[],
        negative_triggers TEXT[],
        first_interaction TIMESTAMP DEFAULT NOW(),
        last_interaction TIMESTAMP DEFAULT NOW(),
        last_mood_detected VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // emotion_statesテーブル拡張
    await pgPool.query(`
      ALTER TABLE emotion_states 
      ADD COLUMN IF NOT EXISTS valence INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS arousal INTEGER DEFAULT 50,
      ADD COLUMN IF NOT EXISTS dominance INTEGER DEFAULT 50
    `);

    // bot_personalityの初期データ投入
    await pgPool.query(`
      INSERT INTO bot_personality (bot_instance) 
      VALUES ('aimolt') 
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ スキーマ初期化完了');
  }

  async getUsers() {
    const result = await pgPool.query(
      'SELECT DISTINCT user_id FROM conversations ORDER BY user_id'
    );
    return result.rows.map(row => row.user_id);
  }

  async getConversations(userId) {
    const result = await pgPool.query(
      `SELECT id, user_id, user_message, bot_response, created_at 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at ASC`,
      [userId]
    );
    return result.rows;
  }

  async processUser(userId) {
    console.log(`\n👤 ユーザー ${userId} を処理中...`);
    
    const conversations = await this.getConversations(userId);
    console.log(`📚 会話履歴: ${conversations.length}件`);

    if (conversations.length === 0) return;

    // 関係性データの初期化
    await this.initializeUserRelationship(userId, conversations[0].created_at);

    // 感情状態の初期化
    await this.initializeUserEmotion(userId);

    // 会話履歴の分析とデータ蓄積
    await this.analyzeConversations(userId, conversations);

    console.log(`✅ ユーザー ${userId} 処理完了`);
  }

  async initializeUserRelationship(userId, firstInteraction) {
    await pgPool.query(`
      INSERT INTO user_relationships 
      (user_id, first_interaction) 
      VALUES ($1, $2) 
      ON CONFLICT (user_id) DO NOTHING
    `, [userId, firstInteraction]);
  }

  async initializeUserEmotion(userId) {
    await pgPool.query(`
      INSERT INTO emotion_states 
      (user_id, energy_level, intimacy_level, interest_level, mood_type, 
       valence, arousal, dominance) 
      VALUES ($1, 50, 0, 50, 'neutral', 50, 50, 50) 
      ON CONFLICT (user_id) DO UPDATE SET
        valence = EXCLUDED.valence,
        arousal = EXCLUDED.arousal,
        dominance = EXCLUDED.dominance
    `, [userId]);
  }

  async analyzeConversations(userId, conversations) {
    console.log('🔍 会話分析を実行中...');
    
    let cumulativeAffection = 0;
    let cumulativeTrust = 0;
    let cumulativeComfort = 0;
    let totalValence = 0;
    let totalArousal = 0;
    let totalDominance = 0;
    let meaningfulCount = 0;

    const knownInterests = new Set();
    const positiveTrigers = new Set();
    let lastFormality = 'casual';

    for (let i = 0; i < conversations.length; i++) {
      const conversation = conversations[i];
      
      // VAD分析
      const vad = this.vadAnalyzer.analyzeVAD(conversation.user_message);
      const emotion = this.vadAnalyzer.mapVADToEmotion(vad);
      
      // 関係性分析
      const relFactors = this.relationshipAnalyzer.analyzeRelationshipFactors(
        conversation.user_message, vad
      );

      // 累積計算
      cumulativeAffection += relFactors.affectionChange;
      cumulativeTrust += relFactors.trustChange;
      cumulativeComfort += relFactors.comfortChange;
      
      totalValence += vad.valence;
      totalArousal += vad.arousal;
      totalDominance += vad.dominance;

      // 重要な会話の判定
      if (conversation.user_message.length > 80 || 
          vad.valence > 75 || vad.valence < 25 ||
          Object.keys(relFactors.personalInfo).length > 0) {
        meaningfulCount++;
      }

      // 興味・関心の抽出
      if (relFactors.personalInfo.interests) {
        const interests = conversation.user_message.match(/好き.*|趣味.*|興味.*/gi);
        if (interests) {
          interests.forEach(interest => knownInterests.add(interest.substring(0, 50)));
        }
      }

      // ポジティブトリガーの抽出
      if (vad.valence > 75) {
        const words = conversation.user_message.match(/\w+/g) || [];
        words.slice(0, 3).forEach(word => positiveTrigers.add(word));
      }

      lastFormality = relFactors.formalityLevel;

      // 進捗表示
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }

    console.log(''); // 改行

    // 最終的な関係性データの更新
    await this.updateUserRelationship(userId, {
      affection_level: Math.max(0, Math.min(100, 50 + cumulativeAffection)),
      trust_level: Math.max(0, Math.min(100, 50 + cumulativeTrust)),
      comfort_level: Math.max(0, Math.min(100, 40 + cumulativeComfort)),
      conversation_count: conversations.length,
      meaningful_interactions: meaningfulCount,
      preferred_formality: lastFormality,
      known_interests: Array.from(knownInterests),
      positive_triggers: Array.from(positiveTrigers),
      last_interaction: conversations[conversations.length - 1].created_at,
      relationship_stage: this.determineRelationshipStage(
        50 + cumulativeAffection, 
        50 + cumulativeTrust, 
        40 + cumulativeComfort, 
        conversations.length
      )
    });

    // 感情状態の更新
    await this.updateUserEmotion(userId, {
      valence: Math.round(totalValence / conversations.length),
      arousal: Math.round(totalArousal / conversations.length),
      dominance: Math.round(totalDominance / conversations.length),
      conversation_count: conversations.length
    });

    console.log(`📊 分析完了: ${meaningfulCount}件の重要な会話を特定`);
  }

  determineRelationshipStage(affection, trust, comfort, conversationCount) {
    if (affection >= 80 && trust >= 75 && comfort >= 70) {
      return 'close_friend';
    } else if (affection >= 60 && trust >= 55 && conversationCount >= 10) {
      return 'friend';
    } else if (affection >= 40 || conversationCount >= 5) {
      return 'acquaintance';
    } else {
      return 'stranger';
    }
  }

  async updateUserRelationship(userId, data) {
    const setClause = Object.keys(data)
      .map((key, index) => `${key} = $${index + 2}`)
      .join(', ');
    
    const values = [userId, ...Object.values(data)];
    
    await pgPool.query(
      `UPDATE user_relationships SET ${setClause} WHERE user_id = $1`,
      values
    );
  }

  async updateUserEmotion(userId, data) {
    await pgPool.query(`
      UPDATE emotion_states 
      SET valence = $2, arousal = $3, dominance = $4, 
          conversation_count = $5, last_interaction = NOW()
      WHERE user_id = $1
    `, [userId, data.valence, data.arousal, data.dominance, data.conversation_count]);
  }

  async showFinalStats() {
    console.log('\n📊 最終統計:');
    
    const [userCount, avgAffection, avgTrust] = await Promise.all([
      pgPool.query('SELECT COUNT(*) as count FROM user_relationships'),
      pgPool.query('SELECT AVG(affection_level) as avg FROM user_relationships'),
      pgPool.query('SELECT AVG(trust_level) as avg FROM user_relationships')
    ]);

    console.log(`  - 処理ユーザー数: ${userCount.rows[0].count}`);
    console.log(`  - 平均好感度: ${parseFloat(avgAffection.rows[0].avg || 0).toFixed(1)}`);
    console.log(`  - 平均信頼度: ${parseFloat(avgTrust.rows[0].avg || 0).toFixed(1)}`);

    const relationshipStages = await pgPool.query(`
      SELECT relationship_stage, COUNT(*) as count 
      FROM user_relationships 
      GROUP BY relationship_stage 
      ORDER BY count DESC
    `);

    console.log('\n🤝 関係性分布:');
    relationshipStages.rows.forEach(row => {
      console.log(`  - ${row.relationship_stage}: ${row.count}人`);
    });
  }

  async run() {
    console.log('🚀 AImolt 人格システム v2.0 初期化開始');
    
    try {
      await this.initializeSchema();
      
      const users = await this.getUsers();
      console.log(`\n👥 対象ユーザー: ${users.length}人`);
      
      for (const userId of users) {
        await this.processUser(userId);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      
      await this.showFinalStats();
      
      console.log('\n✨ v2.0 初期化完了！新しい人格システムが有効になりました。');
      
    } catch (error) {
      console.error('\n❌ エラー:', error.message);
      throw error;
    } finally {
      await pgPool.end();
    }
  }
}

// 実行
if (require.main === module) {
  const initializer = new PersonalityInitializerV2();
  initializer.run().catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
  });
}

module.exports = { PersonalityInitializerV2 };