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
const { personalityManager } = require('./personality/manager');
const { supabaseSync } = require('./supabase-sync');

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

  // ローカルPostgreSQLに保存（同期トリガーが自動でSupabaseに送信）
  try {
    await pgPool.query(
      'INSERT INTO conversations (user_id, user_message, bot_response) VALUES ($1, $2, $3)',
      [userId, userMessage, botResponse]
    );
  } catch (error) {
    console.error('Error saving conversation history:', error.message);
  }

  // キャッシュをクリア（次回取得時に最新データを読み込む）
  conversationCache.delete(userId);
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

  // 人格システム管理コマンド
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

          const statusMsg = await message.reply('🧠 人格状態を取得中...');
          
          try {
            const snapshot = await personalityManager.getPersonalitySnapshot(targetUserId);
            
            if (!snapshot) {
              await statusMsg.edit({
                content: '',
                embeds: [{
                  title: '❌ 人格データなし',
                  description: `${targetUser.displayName || targetUser.username}の人格データが見つかりません。`,
                  color: 0xff0000,
                  timestamp: new Date().toISOString(),
                  footer: { text: 'AImolt Personality System' }
                }]
              });
              return;
            }

            await statusMsg.edit({
              content: '',
              embeds: [{
                title: '🧠 人格システム状態',
                description: `${targetUser.displayName || targetUser.username}の現在の状態`,
                color: 0x9b59b6,
                fields: [
                  { 
                    name: '💭 感情状態', 
                    value: `元気度: ${snapshot.emotion.energy}/100\n親密度: ${snapshot.emotion.intimacy}/100\n興味度: ${snapshot.emotion.interest}/100\nムード: ${snapshot.emotion.mood}`, 
                    inline: true 
                  },
                  { 
                    name: '📊 統計', 
                    value: `会話数: ${snapshot.emotion.conversationCount}回\n記憶数: ${snapshot.recentMemories.length}件`, 
                    inline: true 
                  },
                  { 
                    name: '🏷️ 主な特徴', 
                    value: snapshot.profile.topTraits.length > 0 
                      ? snapshot.profile.topTraits.map(trait => 
                          typeof trait === 'string' ? trait : trait.trait || trait.name || JSON.stringify(trait)
                        ).join(', ') 
                      : 'データ蓄積中...', 
                    inline: false 
                  },
                  { 
                    name: '💫 興味・関心', 
                    value: snapshot.profile.topInterests.length > 0 
                      ? snapshot.profile.topInterests.slice(0, 3).map(interest => 
                          typeof interest === 'string' ? interest : interest.topic || interest.name || JSON.stringify(interest)
                        ).join(', ') 
                      : 'データ蓄積中...', 
                    inline: false 
                  },
                  { 
                    name: '📝 最近の記憶', 
                    value: snapshot.recentMemories.length > 0 
                      ? snapshot.recentMemories.slice(0, 2).map(m => `・${m.content}...`).join('\n') 
                      : 'まだ記憶がありません', 
                    inline: false 
                  }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System' }
              }]
            });
          } catch (error) {
            await statusMsg.edit({
              content: '',
              embeds: [{
                title: '❌ 取得エラー',
                description: '人格状態の取得中にエラーが発生しました。',
                color: 0xff0000,
                fields: [
                  { name: 'エラー', value: `\`${error.message}\``, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System' }
              }]
            });
          }
          break;

        case 'stats':
          const statsMsg = await message.reply('📊 システム統計を取得中...');
          
          try {
            const stats = await personalityManager.getSystemStats();
            
            if (!stats) {
              await statsMsg.edit({
                content: '',
                embeds: [{
                  title: '❌ 統計取得失敗',
                  description: 'システム統計の取得に失敗しました。',
                  color: 0xff0000,
                  timestamp: new Date().toISOString(),
                  footer: { text: 'AImolt Personality System' }
                }]
              });
              return;
            }

            await statsMsg.edit({
              content: '',
              embeds: [{
                title: '📊 人格システム統計',
                description: 'ボット全体の人格システム稼働状況',
                color: 0x3498db,
                fields: [
                  { 
                    name: '👥 登録ユーザー', 
                    value: `${stats.totalUsers}人`, 
                    inline: true 
                  },
                  { 
                    name: '🧠 総記憶数', 
                    value: `${stats.totalMemories}件`, 
                    inline: true 
                  },
                  { 
                    name: '📈 分析回数', 
                    value: `${stats.totalAnalyses}回`, 
                    inline: true 
                  },
                  { 
                    name: '⚙️ システム状態', 
                    value: stats.systemEnabled ? '✅ 有効' : '❌ 無効', 
                    inline: true 
                  },
                  { 
                    name: '🔄 処理中', 
                    value: `${stats.activeProcessing}件`, 
                    inline: true 
                  }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System' }
              }]
            });
          } catch (error) {
            await statsMsg.edit({
              content: '',
              embeds: [{
                title: '❌ 統計エラー',
                description: 'システム統計の取得中にエラーが発生しました。',
                color: 0xff0000,
                fields: [
                  { name: 'エラー', value: `\`${error.message}\``, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System' }
              }]
            });
          }
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

          const debugMsg = await message.reply('🔍 デバッグ情報を取得中...');
          
          try {
            const debugInfo = await personalityManager.debugUser(debugTargetUserId);
            
            if (!debugInfo) {
              await debugMsg.edit({
                content: '',
                embeds: [{
                  title: '❌ デバッグ失敗',
                  description: 'デバッグ情報の取得に失敗しました。',
                  color: 0xff0000,
                  timestamp: new Date().toISOString(),
                  footer: { text: 'AImolt Personality System' }
                }]
              });
              return;
            }

            await debugMsg.edit({
              content: '',
              embeds: [{
                title: '🔍 デバッグ情報',
                description: `${debugTargetUser.displayName || debugTargetUser.username}のシステム詳細`,
                color: 0xe74c3c,
                fields: [
                  { 
                    name: '💾 キャッシュ状況', 
                    value: `感情: ${debugInfo.cacheStatus.emotionCached ? '✅' : '❌'}\n記憶: ${debugInfo.cacheStatus.memoryCached}件\n生成: ${debugInfo.cacheStatus.generatorCached}件`, 
                    inline: true 
                  },
                  { 
                    name: '🎯 最後の更新', 
                    value: debugInfo.snapshot ? 
                      `<t:${Math.floor(new Date(debugInfo.snapshot.lastUpdated).getTime() / 1000)}:R>` : 
                      '未更新', 
                    inline: true 
                  }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System Debug' }
              }]
            });
          } catch (error) {
            await debugMsg.edit({
              content: '',
              embeds: [{
                title: '❌ デバッグエラー',
                description: 'デバッグ情報の取得中にエラーが発生しました。',
                color: 0xff0000,
                fields: [
                  { name: 'エラー', value: `\`${error.message}\``, inline: false }
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'AImolt Personality System' }
              }]
            });
          }
          break;

        case 'help':
        default:
          await message.reply({
            embeds: [{
              title: '🧠 人格システム管理コマンド',
              description: '動的人格システムの状態確認・管理コマンドです',
              color: 0x9b59b6,
              fields: [
                {
                  name: '`!personality status [@ユーザー]`',
                  value: '自分（または指定ユーザー）の人格状態を表示します',
                  inline: false
                },
                {
                  name: '`!personality stats`',
                  value: 'ボット全体の人格システム統計を表示します',
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
                text: '人格システムは会話から学習し、個人化された応答を提供します' 
              }
            }]
          });
          break;
      }

    } catch (error) {
      console.error('Error in personality command:', error);
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
    ['❓', '📝'].includes(reaction.emoji.name);

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