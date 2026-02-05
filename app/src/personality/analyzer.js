const { Pool } = require('pg');

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

class ConversationAnalyzer {
  constructor() {
    this.sentimentPatterns = this.initializeSentimentPatterns();
    this.emotionPatterns = this.initializeEmotionPatterns();
    this.topicCategories = this.initializeTopicCategories();
  }

  initializeSentimentPatterns() {
    return {
      positive: [
        /ありがと|感謝|嬉しい|楽しい|良い|素晴らしい|最高|好き|愛|幸せ/gi,
        /やった|成功|勝利|達成|完了|クリア|解決|できた/gi,
        /面白い|笑|ｗ|草|爆笑|へー|すごい|さすが/gi,
        /よかった|安心|ホッと|よし|オッケー|OK|いいね/gi
      ],
      negative: [
        /悲しい|つらい|辛い|嫌|ダメ|最悪|ひどい|むかつく|腹立つ/gi,
        /疲れた|しんどい|きつい|大変|困った|難しい|無理/gi,
        /失敗|負け|ミス|エラー|バグ|壊れた|だめ|いけない/gi,
        /心配|不安|怖い|恐い|びっくり|驚き|ショック/gi
      ]
    };
  }

  initializeEmotionPatterns() {
    return {
      joy: /嬉しい|楽しい|やった|最高|ハッピー|ウキウキ|ワクワク/gi,
      excitement: /興奮|テンション|盛り上がる|熱い|燃える|アツい/gi,
      curiosity: /気になる|知りたい|どうして|なぜ|なんで|教えて|聞きたい/gi,
      sadness: /悲しい|落ち込む|憂鬱|ブルー|しょんぼり|がっかり/gi,
      anger: /怒り|むかつく|腹立つ|イライラ|ムカムカ|頭にくる/gi,
      surprise: /びっくり|驚き|まじ|え？|うそ|ホント|信じられない/gi,
      fear: /怖い|恐い|不安|心配|ドキドキ|緊張|ビビる/gi,
      love: /好き|愛|大好き|愛してる|ラブ|♡|❤/gi,
      gratitude: /ありがと|感謝|おかげ|助かる|恩|お世話/gi
    };
  }

  initializeTopicCategories() {
    return {
      'programming': /プログラミング|コード|開発|バグ|デバッグ|JavaScript|Python|GitHub|アプリ|システム|API/gi,
      'gaming': /ゲーム|プレイ|攻略|レベル|キャラ|RPG|FPS|クリア|ボス|アイテム/gi,
      'daily_life': /今日|昨日|明日|朝|夜|仕事|学校|家|食事|買い物|天気/gi,
      'entertainment': /映画|アニメ|漫画|音楽|歌|ドラマ|YouTube|Netflix|本|小説/gi,
      'study': /勉強|学習|試験|テスト|宿題|課題|授業|講義|資格|英語/gi,
      'health': /健康|病気|体調|医者|薬|運動|ダイエット|疲れ|眠い|元気/gi,
      'relationships': /友達|恋人|家族|彼氏|彼女|結婚|恋愛|人間関係|コミュニケーション/gi,
      'technology': /AI|人工知能|ロボット|スマホ|パソコン|インターネット|SNS|アプリ|テクノロジー/gi,
      'food': /食べ物|料理|レシピ|美味しい|レストラン|カフェ|お菓子|飲み物|グルメ/gi,
      'travel': /旅行|観光|電車|飛行機|ホテル|温泉|海外|国内|お出かけ|散歩/gi
    };
  }

  async analyzeMessage(userId, message, messageId = null) {
    try {
      const analysis = {
        user_id: userId,
        message_id: messageId,
        user_message: message,
        sentiment: this.analyzeSentiment(message),
        emotion_detected: this.detectEmotion(message),
        topic_category: this.categorizeMessage(message),
        keywords: this.extractKeywords(message),
        importance_score: this.calculateImportanceScore(message),
        confidence_score: 0.75
      };

      analysis.confidence_score = this.calculateConfidenceScore(analysis);

      await this.saveAnalysis(analysis);
      return analysis;
    } catch (error) {
      console.error('Error analyzing message:', error);
      return this.getDefaultAnalysis(userId, message, messageId);
    }
  }

  analyzeSentiment(message) {
    let positiveScore = 0;
    let negativeScore = 0;

    this.sentimentPatterns.positive.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) positiveScore += matches.length;
    });

    this.sentimentPatterns.negative.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) negativeScore += matches.length;
    });

    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  detectEmotion(message) {
    const emotions = {};

    Object.entries(this.emotionPatterns).forEach(([emotion, pattern]) => {
      const matches = message.match(pattern);
      if (matches) {
        emotions[emotion] = matches.length;
      }
    });

    if (Object.keys(emotions).length === 0) return 'neutral';

    return Object.entries(emotions)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  categorizeMessage(message) {
    const categories = {};

    Object.entries(this.topicCategories).forEach(([category, pattern]) => {
      const matches = message.match(pattern);
      if (matches) {
        categories[category] = matches.length;
      }
    });

    if (Object.keys(categories).length === 0) return 'general';

    return Object.entries(categories)
      .sort(([, a], [, b]) => b - a)[0][0];
  }

  extractKeywords(message) {
    const text = message.toLowerCase();
    const stopWords = new Set([
      'は', 'が', 'を', 'に', 'で', 'と', 'の', 'だ', 'である', 'です', 'ます',
      'した', 'して', 'ある', 'いる', 'なる', 'する', 'この', 'その', 'あの',
      'それ', 'これ', 'あれ', 'どの', 'なに', 'なん', 'どこ', 'いつ', 'だれ',
      'もの', 'こと', 'とき', 'ところ', 'ため', 'よう', 'ちょっと', 'けど',
      'でも', 'だから', 'そして', 'また', 'さらに', 'しかし', 'ただ', 'ので'
    ]);

    const words = text.match(/[\p{L}\p{N}]+/gu) || [];
    const keywords = words
      .filter(word => word.length >= 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 10);

    return keywords;
  }

  calculateImportanceScore(message) {
    let score = 1;

    if (message.length > 100) score += 2;
    if (message.length > 200) score += 2;

    if (message.match(/質問|聞きたい|教えて|どうして|なぜ|わからない/gi)) score += 3;

    if (message.match(/ありがと|感謝|助かる|おかげ/gi)) score += 2;

    if (message.match(/悩み|相談|困った|辛い|悲しい/gi)) score += 4;

    if (message.match(/！|!|\?|？/g)) score += 1;

    if (message.match(/すごい|最高|素晴らしい|やばい|マジ/gi)) score += 2;

    return Math.min(score, 10);
  }

  calculateConfidenceScore(analysis) {
    let confidence = 0.5;

    if (analysis.sentiment !== 'neutral') confidence += 0.15;
    if (analysis.emotion_detected !== 'neutral') confidence += 0.15;
    if (analysis.topic_category !== 'general') confidence += 0.1;
    if (analysis.keywords.length >= 3) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  async saveAnalysis(analysis) {
    try {
      await supabase
        .from('conversation_analysis')
        .insert([analysis]);
    } catch (error) {
      console.error('Error saving analysis:', error);
    }
  }

  async getRecentAnalysis(userId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('conversation_analysis')
        .select('*')
        .eq('user_id', userId)
        .order('analyzed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting recent analysis:', error);
      return [];
    }
  }

  async getUserTrends(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('conversation_analysis')
        .select('sentiment, emotion_detected, topic_category, importance_score')
        .eq('user_id', userId)
        .gte('analyzed_at', startDate.toISOString());

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // クライアント側で集計
      // グルーピングキー: sentiment + emotion + topic
      const groups = {};

      data.forEach(item => {
        const key = `${item.sentiment}|${item.emotion_detected}|${item.topic_category}`;
        if (!groups[key]) {
          groups[key] = {
            sentiment: item.sentiment,
            emotion_detected: item.emotion_detected,
            topic_category: item.topic_category,
            totalImportance: 0,
            count: 0
          };
        }
        groups[key].count++;
        groups[key].totalImportance += item.importance_score;
      });

      return Object.values(groups)
        .map(g => ({
          sentiment: g.sentiment,
          emotion_detected: g.emotion_detected,
          topic_category: g.topic_category,
          avg_importance: g.totalImportance / g.count,
          count: g.count
        }))
        .sort((a, b) => b.count - a.count);

    } catch (error) {
      console.error('Error getting user trends:', error);
      return [];
    }
  }

  getDefaultAnalysis(userId, message, messageId) {
    return {
      user_id: userId,
      message_id: messageId,
      user_message: message,
      sentiment: 'neutral',
      emotion_detected: 'neutral',
      topic_category: 'general',
      keywords: [],
      importance_score: 1,
      confidence_score: 0.3
    };
  }
}

const conversationAnalyzer = new ConversationAnalyzer();

module.exports = {
  ConversationAnalyzer,
  conversationAnalyzer
};