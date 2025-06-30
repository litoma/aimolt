const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const { systemInstruction } = require('./config');
const { transcribeAudio } = require('./transcribe');
const { handleReaction } = require('./react');
const { handleExplainReaction } = require('./explain');

// クライアントの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Gemini APIの設定
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  systemInstruction,
  generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
});

// Supabaseの設定
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ローカルPostgreSQLの設定
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

// キャッシュ
const conversationCache = new Map();

// クールダウン管理
const cooldowns = new Map();
const COOLDOWN_TIME = 5000; // 5秒

// タイピング管理用のヘルパー関数
async function startTyping(channel) {
  try {
    await channel.sendTyping();
    // 10秒ごとにタイピングを継続（Discordのタイピング表示は10秒で自動停止）
    const typingInterval = setInterval(async () => {
      try {
        await channel.sendTyping();
      } catch (error) {
        clearInterval(typingInterval);
      }
    }, 9000); // 9秒間隔で再送信（余裕を持って）
    
    return typingInterval;
  } catch (error) {
    return null;
  }
}

function stopTyping(typingInterval) {
  if (typingInterval) {
    clearInterval(typingInterval);
  }
}

// ボット起動時の処理
client.on('ready', async () => {
  try {
    await pgPool.query('SELECT NOW()');
  } catch (error) {
    // PostgreSQL接続エラーは静かに処理
  }
});

// 会話履歴の取得（ローカルPostgreSQL）
async function getConversationHistory(userId) {
  if (!userId) {
    return [];
  }
  try {
    if (conversationCache.has(userId)) {
      return conversationCache.get(userId);
    }
    
    const conversationLimit = parseInt(process.env.CONVERSATION_LIMIT) || 1000;
    
    // 直近のCONVERSATION_LIMIT件のレコードを取得
    const result = await pgPool.query(
      'SELECT user_message, bot_response FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, conversationLimit]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return [];
    }
    
    // Gemini API形式に変換（古い順に並び替え）
    const history = [];
    for (let i = result.rows.length - 1; i >= 0; i--) {
      const row = result.rows[i];
      history.push({ role: 'user', parts: [{ text: row.user_message }] });
      history.push({ role: 'model', parts: [{ text: row.bot_response }] });
    }
    
    conversationCache.set(userId, history);
    return history;
  } catch (error) {
    return [];
  }
}

// 会話履歴の保存（SupabaseとローカルPostgreSQL）
async function saveConversationHistory(userId, userMessage, botResponse) {
  if (!userId || !userMessage || !botResponse) {
    return;
  }

  // ローカルPostgreSQLに保存
  try {
    await pgPool.query(
      'INSERT INTO conversations (user_id, user_message, bot_response) VALUES ($1, $2, $3)',
      [userId, userMessage, botResponse]
    );
  } catch (error) {
    // PostgreSQL保存エラーは静かに処理
  }

  // Supabaseに保存（バックアップ用）
  try {
    const { error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        user_message: userMessage,
        bot_response: botResponse
      });
    if (error) {
      // Supabase保存エラーは静かに処理
    }
  } catch (error) {
    // Supabase保存エラーは静かに処理
  }

  // キャッシュをクリア（次回取得時に最新データを読み込む）
  conversationCache.delete(userId);
}

// リアクション追加時の処理（👍、🎤、❓）
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      return;
    }
  }

  if (reaction.message.author.id !== client.user.id) {
    const userId = user.id;

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + COOLDOWN_TIME;
      if (Date.now() < expirationTime) {
        return reaction.message.channel.send(`<@${userId}> ちょっと待ってね、ベストie！😉 ${Math.ceil((expirationTime - Date.now()) / 1000)}秒後にまた話そう！`);
      }
    }

    let typingInterval = null;

    if (reaction.emoji.name === '🎤') {
      try {
        // タイピング表示開始
        typingInterval = await startTyping(reaction.message.channel);
        
        await transcribeAudio(reaction.message, reaction.message.channel, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        await reaction.message.channel.send(`<@${user.id}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
      } finally {
        // タイピング表示停止
        stopTyping(typingInterval);
      }
    } else if (reaction.emoji.name === '👍') {
      try {
        // タイピング表示開始
        typingInterval = await startTyping(reaction.message.channel);
        
        await handleReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
      } finally {
        // タイピング表示停止
        stopTyping(typingInterval);
      }
    } else if (reaction.emoji.name === '❓') {
      try {
        // タイピング表示開始
        typingInterval = await startTyping(reaction.message.channel);
        
        await handleExplainReaction(reaction.message, reaction.message.channel, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
      } finally {
        // タイピング表示停止
        stopTyping(typingInterval);
      }
    }
  }
});

// ボットログイン
client.login(process.env.DISCORD_BOT_TOKEN);