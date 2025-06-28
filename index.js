require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
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
});

// Supabaseの設定
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// クールダウン管理
const cooldowns = new Map();
const COOLDOWN_TIME = 5000; // 5秒

// スラッシュコマンドの登録
const commands = [
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('aimoltになんでも聞いて！楽しく答えるよ！😉')
    .addStringOption(option =>
      option.setName('query')
        .setDescription('質問やトピック')
        .setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, process.env.DISCORD_GUILD_ID),
      { body: commands },
    );
    console.log('スラッシュコマンドを登録しました！');
  } catch (error) {
    console.error('スラッシュコマンド登録エラー:', error);
  }
})();

// ボット起動時のログ
client.on('ready', () => {
  console.log(`ログインしました: ${client.user.tag} 😄`);
});

// 会話履歴の取得
async function getConversationHistory(userId) {
  if (!userId) {
    console.error('getConversationHistory: userIdがundefinedまたは空');
    return [];
  }
  console.log(`Conversation history query for userId=${userId}`);
  const { data, error } = await supabase
    .from('conversations')
    .select('message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error(`Supabase取得エラー: userId=${userId}, エラー:`, error);
    return [];
  }
  console.log(`Conversation history query result for userId=${userId}:`, JSON.stringify(data));
  if (!data || data.length === 0) {
    console.log(`Conversation history empty for userId=${userId}`);
    return [];
  }
  const history = data[0].message || [];
  console.log(`History retrieved for userId=${userId}:`, JSON.stringify(history));
  return Array.isArray(history) ? history : [];
}

// 会話履歴の保存
async function saveConversationHistory(userId, history) {
  if (!userId) {
    console.error('saveConversationHistory: userIdがundefinedまたは空');
    return;
  }
  console.log(`Saving conversation history for userId=${userId}`);
  const { error } = await supabase
    .from('conversations')
    .upsert({ user_id: userId, message: history.slice(-10) });
  if (error) {
    console.error(`Supabase保存エラー: userId=${userId}, エラー:`, error);
  } else {
    console.log(`Conversation history saved for userId=${userId}`);
  }
}

// リアクション追加時の処理（👍、🎤、❓）
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
      return;
    }
  }

  if (reaction.message.author.id !== client.user.id) {
    const userId = user.id;
    console.log(`Processing reaction for userId=${userId}, messageId=${reaction.message.id}, emoji=${reaction.emoji.name}`);

    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + COOLDOWN_TIME;
      if (Date.now() < expirationTime) {
        return reaction.message.channel.send(`<@${userId}> ちょっと待ってね、ベストie！😉 ${Math.ceil((expirationTime - Date.now()) / 1000)}秒後にまた話そう！`);
      }
    }

    if (reaction.emoji.name === '🎤') {
      // 音声文字起こし
      try {
        await transcribeAudio(reaction.message, reaction.message.channel, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        console.error('音声処理エラー:', error);
        await reaction.message.channel.send(`<@${user.id}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
      }
    } else if (reaction.emoji.name === '👍') {
      // テキスト応答
      try {
        await handleReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        console.error('リアクション処理エラー:', error);
        await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
      }
    } else if (reaction.emoji.name === '❓') {
      // 解説処理
      try {
        await handleExplainReaction(reaction.message, reaction.message.channel, user, genAI, getConversationHistory, saveConversationHistory);
        cooldowns.set(userId, Date.now());
      } catch (error) {
        console.error('解説処理エラー:', error);
        await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
      }
    }
  }
});

// スラッシュコマンドの処理（/ask）
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ask') {
    const userId = interaction.user.id;
    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + COOLDOWN_TIME;
      if (Date.now() < expirationTime) {
        return interaction.reply({
          content: `ちょっと待って、ベストie！😉 ${Math.ceil((expirationTime - Date.now()) / 1000)}秒後にまた話そう！`,
          ephemeral: true,
        });
      }
    }

    const query = interaction.options.getString('query');
    await interaction.deferReply();

    try {
      const history = await getConversationHistory(userId);
      const chatSession = model.startChat({ history });
      const result = await chatSession.sendMessage(`以下の質問に日本語で答えて: ${query}`);
      const reply = result.response.text();

      history.push({ role: 'user', parts: [{ text: query }] });
      history.push({ role: 'model', parts: [{ text: reply }] });
      await saveConversationHistory(userId, history);

      await interaction.editReply(reply.slice(0, 2000));
      cooldowns.set(userId, Date.now());
    } catch (error) {
      console.error('Gemini APIエラー:', error);
      await interaction.editReply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
    }
  }
});

// ボットログイン
client.login(process.env.DISCORD_BOT_TOKEN);
