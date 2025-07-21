const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const { prompts } = require('./prompt');
const { transcribeAudio } = require('./transcribe');
const { handleLikeReaction, getProfileStatus, forceRefreshProfile } = require('./like');
const { handleExplainReaction } = require('./explain');
const { handleMemoReaction } = require('./memo');
const { personalityManagerV2 } = require('./personality/manager-v2');
const { PersonalityCommandV2 } = require('./personality-command-v2');
const { supabaseSync } = require('./supabase-sync');
const { ProactiveScheduler } = require('./proactive/scheduler');
const { ProactiveManagementCommands } = require('./proactive/management-commands');

// 人格システムv2.0初期化
const personalityCommandV2 = new PersonalityCommandV2();

// プロアクティブメッセージシステム初期化（ボット起動後に設定）
let proactiveScheduler = null;
let proactiveCommands = null;

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
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    await pgPool.query('SELECT NOW()');
    console.log('PostgreSQL connection successful');
    
    // プロンプトシステムの動作確認
    try {
      const systemInstruction = await prompts.getSystem();
      console.log('Prompt system initialized successfully');
      console.log(`System instruction loaded: ${systemInstruction.length} characters`);
    } catch (promptError) {
      console.error('Prompt system initialization error:', promptError.message);
    }

    // Supabase同期システムを開始
    try {
      await supabaseSync.start();
      console.log('Supabase sync system started successfully');
    } catch (syncError) {
      console.error('Supabase sync system initialization error:', syncError.message);
    }

    // プロアクティブメッセージシステムを初期化
    try {
      proactiveScheduler = new ProactiveScheduler(pgPool, client, genAI);
      proactiveCommands = new ProactiveManagementCommands(proactiveScheduler);
      
      // 自動開始（環境変数で制御）
      if (proactiveScheduler.autoStart) {
        proactiveScheduler.start();
        console.log('Proactive message system initialized and started successfully (auto-start)');
      } else {
        console.log('Proactive message system initialized (manual start required)');
      }
    } catch (proactiveError) {
      console.error('Proactive message system initialization error:', proactiveError.message);
    }
  } catch (error) {
    console.error('Database connection error:', error.message);
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

// 会話履歴の保存（ローカルPostgreSQL）
// 注意: Supabaseへの同期は自動トリガーで処理されます
async function saveConversationHistory(userId, userMessage, botResponse) {
  if (!userId || !userMessage || !botResponse) {
    return;
  }

  try {
    // Phase 4: プロアクティブ応答処理システムを使用
    if (proactiveScheduler && proactiveScheduler.getResponseHandler) {
      const responseHandler = proactiveScheduler.getResponseHandler();
      const saveResult = await responseHandler.saveUserMessage(userId, userMessage, botResponse);
      
      if (saveResult.success) {
        console.log(`✅ 会話保存成功 - タイプ: ${saveResult.messageType}, 応答時間: ${saveResult.responseTime ? Math.round(saveResult.responseTime / 1000) + '秒' : 'N/A'}`);
      } else {
        console.error('❌ プロアクティブ応答処理での保存失敗:', saveResult.error);
        // フォールバック: 従来の方法で保存
        await _fallbackSaveConversation(userId, userMessage, botResponse);
      }
    } else {
      // プロアクティブシステムが利用できない場合のフォールバック
      await _fallbackSaveConversation(userId, userMessage, botResponse);
    }
  } catch (error) {
    console.error('Error in enhanced conversation saving:', error.message);
    // 最終フォールバック
    await _fallbackSaveConversation(userId, userMessage, botResponse);
  }

  // キャッシュをクリア（次回取得時に最新データを読み込む）
  conversationCache.delete(userId);
}

// フォールバック用の従来保存方法
async function _fallbackSaveConversation(userId, userMessage, botResponse) {
  try {
    await pgPool.query(
      'INSERT INTO conversations (user_id, user_message, bot_response) VALUES ($1, $2, $3)',
      [userId, userMessage, botResponse]
    );
    console.log('✅ フォールバック保存成功');
  } catch (error) {
    console.error('❌ フォールバック保存も失敗:', error.message);
  }
}

// プロファイル管理コマンドの処理
client.on('messageCreate', async (message) => {
  // ボット自身のメッセージは無視
  if (message.author.bot) return;

  // プロファイル管理コマンド
  if (message.content.startsWith('!profile')) {
    const args = message.content.split(' ').slice(1);
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'status':
          const status = await getProfileStatus();
          const statusEmbed = {
            title: '🤖 プロファイル状態',
            color: status.hasProfile ? 0x00ff00 : 0xff0000,
            fields: [
              { 
                name: '機能状態', 
                value: status.enabled ? '✅ 有効' : '❌ 無効 (GITHUB_TOKEN未設定)', 
                inline: true 
              },
              { 
                name: 'プロファイル', 
                value: status.hasProfile ? '✅ 読み込み済み' : '❌ 未読み込み', 
                inline: true 
              },
              { 
                name: '最終更新', 
                value: status.lastFetch 
                  ? `<t:${Math.floor(new Date(status.lastFetch).getTime() / 1000)}:R>`
                  : '未取得', 
                inline: true 
              },
              { 
                name: 'キャッシュ', 
                value: status.cacheAgeHours !== null 
                  ? `${status.cacheAgeHours}時間前 (${status.cacheTimeHours}h設定)`
                  : 'なし', 
                inline: true 
              },
              { 
                name: 'キャッシュ状態', 
                value: status.isExpired === null 
                  ? 'なし' 
                  : status.isExpired ? '⚠️ 期限切れ' : '✅ 有効', 
                inline: true 
              }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'AImolt Profile System' }
          };
          
          await message.reply({ embeds: [statusEmbed] });
          break;

        case 'refresh':
          const currentStatus = await getProfileStatus();
          if (!currentStatus.enabled) {
            await message.reply('❌ プロファイル機能が無効です。GITHUB_TOKENを設定してください。');
            return;
          }

          const refreshMsg = await message.reply('🔄 プロファイルを更新中...');
          
          try {
            await forceRefreshProfile();
            const newStatus = await getProfileStatus();
            
            await refreshMsg.edit({
              content: '',
              embeds: [{
                title: '✅ プロファイル更新完了',
                description: `プロファイルが正常に更新されました！`,
                color: 0x00ff00,
                fields: [
                  { 
                    name: '更新時刻', 
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                    inline: true 
                  },
                  { 
                    name: 'ステータス', 
                    value: newStatus.hasProfile ? '✅ 読み込み済み' : '❌ 読み込み失敗', 
                    inline: true 
                  }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Profile System' }
              }]
            });
          } catch (error) {
            await refreshMsg.edit({
              content: '',
              embeds: [{
                title: '❌ プロファイル更新失敗',
                description: 'プロファイルの更新に失敗しました。',
                color: 0xff0000,
                fields: [
                  { name: 'エラー', value: `\`${error.message}\``, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Profile System' }
              }]
            });
          }
          break;

        case 'help':
        default:
          await message.reply({
            embeds: [{
              title: '📋 プロファイル管理コマンド',
              description: 'プロファイル連携機能の管理コマンドです',
              color: 0x0099ff,
              fields: [
                {
                  name: '`!profile status`',
                  value: 'プロファイルの現在の状態を表示します',
                  inline: false
                },
                {
                  name: '`!profile refresh`',
                  value: 'プロファイルを強制的に更新します（GitHubから再取得）',
                  inline: false
                },
                {
                  name: '`!profile help`',
                  value: 'このヘルプメッセージを表示します',
                  inline: false
                }
              ],
              footer: { 
                text: 'プロファイル機能はGITHUB_TOKENが設定されている場合のみ有効です' 
              }
            }]
          });
          break;
      }

    } catch (error) {
      console.error('Error in profile command:', error);
      await message.reply('❌ プロファイルコマンドの実行中にエラーが発生しました。');
    }
    return;
  }

  // プロアクティブメッセージ管理コマンド
  if (message.content.startsWith('!proactive')) {
    if (!proactiveCommands) {
      await message.reply('❌ プロアクティブメッセージシステムが初期化されていません。');
      return;
    }
    
    const args = message.content.split(' ').slice(1);
    try {
      await proactiveCommands.handleProactiveCommand(message, args);
    } catch (error) {
      console.error('Error in proactive command:', error);
      await message.reply('❌ プロアクティブコマンドの実行中にエラーが発生しました。');
    }
    return;
  }

  // 人格システム管理コマンド (v2.0 - VAD + 関係性管理)
  if (message.content.startsWith('!personality')) {
    const args = message.content.split(' ').slice(1);
    const command = args[0]?.toLowerCase();
    
    try {
      switch (command) {
        case 'status':
          let targetUserId = message.author.id;
          let targetUser = message.author;
          
          // メンションされたユーザーがいる場合は対象を変更
          if (message.mentions.users.size > 0) {
            const mentionedUser = message.mentions.users.first();
            targetUserId = mentionedUser.id;
            targetUser = mentionedUser;
          }
          
          await personalityCommandV2.handleStatusCommand(message, targetUserId, targetUser);
          break;

        case 'stats':
          await personalityCommandV2.handleStatsCommand(message);
          break;

        case 'debug':
          // 管理者のみ実行可能（必要に応じて権限チェックを追加）
          let debugTargetUserId = message.author.id;
          let debugTargetUser = message.author;
          
          if (message.mentions.users.size > 0) {
            const mentionedUser = message.mentions.users.first();
            debugTargetUserId = mentionedUser.id;
            debugTargetUser = mentionedUser;
          }

          await personalityCommandV2.handleDebugCommand(message, debugTargetUserId, debugTargetUser);
          break;

        case 'help':
        default:
          await message.reply({
            embeds: [{
              title: '🧠 人格システム管理コマンド v2.0',
              description: 'VADモデル + 関係性管理による動的人格システムです',
              color: 0x9b59b6,
              fields: [
                {
                  name: '`!personality status [@ユーザー]`',
                  value: '自分（または指定ユーザー）のVAD感情状態と関係性を表示します',
                  inline: false
                },
                {
                  name: '`!personality stats`',
                  value: 'ボット全体の人格システム統計（VAD平均値、関係性分布）を表示します',
                  inline: false
                },
                {
                  name: '`!personality debug [@ユーザー]`',
                  value: 'システムのデバッグ情報を表示します（詳細情報）',
                  inline: false
                },
                {
                  name: '`!personality help`',
                  value: 'このヘルプメッセージを表示します',
                  inline: false
                }
              ],
              footer: { 
                text: '人格システムv2.0 - VAD感情モデル + Big Five性格特性 + 関係性管理' 
              }
            }]
          });
          break;
      }
    } catch (error) {
      console.error('Error in personality command v2:', error);
      await message.reply('❌ 人格システムコマンドの実行中にエラーが発生しました。');
    }
    return;
  }

  // Supabase同期管理コマンド
  if (message.content.startsWith('!sync')) {
    const args = message.content.split(' ').slice(1);
    const command = args[0]?.toLowerCase();

    try {
      switch (command) {
        case 'status':
          const syncStatus = supabaseSync.getHealthStatus();
          await message.reply({
            embeds: [{
              title: '🔄 Supabase同期システム状態',
              color: syncStatus.isRunning ? 0x00ff00 : 0xff0000,
              fields: [
                { 
                  name: '⚙️ システム状態', 
                  value: syncStatus.isRunning ? '✅ 稼働中' : '❌ 停止中', 
                  inline: true 
                },
                { 
                  name: '📊 同期回数', 
                  value: `${syncStatus.stats.syncCount}回`, 
                  inline: true 
                },
                { 
                  name: '❌ エラー回数', 
                  value: `${syncStatus.stats.errorCount}回`, 
                  inline: true 
                },
                { 
                  name: '📈 成功率', 
                  value: syncStatus.stats.syncCount > 0 
                    ? `${Math.round((syncStatus.stats.syncCount / (syncStatus.stats.syncCount + syncStatus.stats.errorCount)) * 100)}%`
                    : 'N/A', 
                  inline: true 
                },
                { 
                  name: '📅 最終同期', 
                  value: syncStatus.stats.lastSync 
                    ? `<t:${Math.floor(new Date(syncStatus.stats.lastSync).getTime() / 1000)}:R>`
                    : '未実行', 
                  inline: true 
                },
                { 
                  name: '🏷️ 対象テーブル', 
                  value: syncStatus.tables.join(', '), 
                  inline: false 
                }
              ],
              timestamp: new Date().toISOString(),
              footer: { text: 'Supabase Sync System' }
            }]
          });
          break;

        case 'manual':
          const tableName = args[1];
          const manualMsg = await message.reply('🔄 手動同期を開始中...');
          
          try {
            if (tableName && !supabaseSync.syncTables[tableName]) {
              await manualMsg.edit({
                content: '',
                embeds: [{
                  title: '❌ 無効なテーブル名',
                  description: `テーブル '${tableName}' は存在しません。`,
                  color: 0xff0000,
                  fields: [
                    { 
                      name: '利用可能なテーブル', 
                      value: Object.keys(supabaseSync.syncTables).join(', '), 
                      inline: false 
                    }
                  ]
                }]
              });
              return;
            }

            await supabaseSync.manualSync(tableName);
            
            await manualMsg.edit({
              content: '',
              embeds: [{
                title: '✅ 手動同期完了',
                description: tableName 
                  ? `テーブル '${tableName}' の手動同期が完了しました。`
                  : '全テーブルの手動同期が完了しました。',
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
                footer: { text: 'Supabase Sync System' }
              }]
            });
          } catch (error) {
            await manualMsg.edit({
              content: '',
              embeds: [{
                title: '❌ 手動同期失敗',
                description: '手動同期中にエラーが発生しました。',
                color: 0xff0000,
                fields: [
                  { name: 'エラー', value: `\`${error.message}\``, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'Supabase Sync System' }
              }]
            });
          }
          break;

        case 'stats':
          supabaseSync.logStats();
          await message.reply('📊 同期統計をログに出力しました。');
          break;

        case 'help':
        default:
          await message.reply({
            embeds: [{
              title: '🔄 Supabase同期管理コマンド',
              description: 'PostgreSQL⇔Supabase間の自動同期システムの管理',
              color: 0x0099ff,
              fields: [
                {
                  name: '`!sync status`',
                  value: '同期システムの現在の状態を表示します',
                  inline: false
                },
                {
                  name: '`!sync manual [table]`',
                  value: '手動同期を実行します（テーブル指定可能）',
                  inline: false
                },
                {
                  name: '`!sync stats`',
                  value: '詳細な統計情報をログに出力します',
                  inline: false
                },
                {
                  name: '`!sync help`',
                  value: 'このヘルプメッセージを表示します',
                  inline: false
                }
              ],
              footer: { 
                text: '対象テーブル: conversations, emotion_states, user_memories, conversation_analysis' 
              }
            }]
          });
          break;
      }

    } catch (error) {
      console.error('Error in sync command:', error);
      await message.reply('❌ 同期コマンドの実行中にエラーが発生しました。');
    }
    return;
  }
});

// リアクション追加時の処理（👍、🎤、❓、📝）
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      return;
    }
  }

  const isUserMessage = reaction.message.author.id !== client.user.id;
  const isBotMessageWithAllowedReaction = 
    reaction.message.author.id === client.user.id && 
    ['❓', '📝', '👍'].includes(reaction.emoji.name);

  if (isUserMessage || isBotMessageWithAllowedReaction) {
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
        
        await handleLikeReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory);
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
    } else if (reaction.emoji.name === '📝') {
      try {
        // タイピング表示開始
        typingInterval = await startTyping(reaction.message.channel);
        
        await handleMemoReaction(reaction.message, reaction.message.channel, user, genAI);
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