require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const { systemInstruction } = require('./config');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// ログ設定
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} - ${level.toUpperCase()} - ${message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(__dirname, 'logs', 'aimolt-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '5',
    }),
  ],
});

// 必要なディレクトリを作成
async function createRequiredDirectories() {
  const dirs = [
    path.join(__dirname, 'logs'),
    path.join(__dirname, 'attachments'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
    logger.info(`ディレクトリ確認: ${dir}`);
  }
}
createRequiredDirectories();

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

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    logger.info('スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_APPLICATION_ID, process.env.DISCORD_GUILD_ID),
      { body: commands },
    );
    logger.info('スラッシュコマンドを登録しました！');
  } catch (error) {
    logger.error(`スラッシュコマンド登録エラー: ${error.message}`);
  }
})();

// ボット起動時のログ
client.on('ready', () => {
  logger.info(`ログインしました: ${client.user.tag} 😄`);
});

// 会話履歴の取得
async function getConversationHistory(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('message')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    logger.error(`Supabase取得エラー: ${error.message}`);
    return [];
  }
  return data.length > 0 ? data[0].message : [];
}

// 会話履歴の保存
async function saveConversationHistory(userId, history) {
  const { error } = await supabase
    .from('conversations')
    .upsert({ user_id: userId, message: history.slice(-10) });
  if (error) logger.error(`Supabase保存エラー: ${error.message}`);
}

// 音声ファイルをダウンロード
async function downloadAudio(url, filePath) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'arraybuffer',
  });
  await fs.writeFile(filePath, response.data);
  logger.info(`ファイルダウンロード完了: ${filePath} (${response.data.length} bytes)`);
}

// 動画から音声を抽出
async function extractAudioFromVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .audioCodec('mp3')
      .noVideo()
      .on('end', () => {
        logger.info(`音声抽出完了: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        logger.error(`音声抽出エラー: ${err.message}`);
        reject(err);
      })
      .run();
  });
}

// 音声ファイルを分割
async function splitAudio(inputPath, outputDir, maxDurationMs = 600000, maxSizeMb = 20) {
  const audioInfo = await new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
  const durationMs = audioInfo.format.duration * 1000;
  const fileSizeMb = (await fs.stat(inputPath)).size / (1024 * 1024);
  const splitCount = Math.max(1, Math.ceil(durationMs / maxDurationMs), Math.ceil(fileSizeMb / maxSizeMb));
  const partDuration = durationMs / splitCount;

  const parts = [];
  for (let i = 0; i < splitCount; i++) {
    const startTime = i * partDuration;
    const outputPath = path.join(outputDir, `part_${i}.mp3`);
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .audioCodec('mp3')
        .setStartTime(startTime / 1000)
        .duration(partDuration / 1000)
        .on('end', () => {
          logger.info(`分割ファイル作成: ${outputPath} (${startTime}ms～${startTime + partDuration}ms)`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`分割エラー: ${err.message}`);
          reject(err);
        })
        .run();
    });
    parts.push(outputPath);
  }
  return parts;
}

// 音声文字起こし
async function transcribeAudio(message, channel, user) {
  const audioExts = ['.mp3', '.m4a', '.ogg', '.webm', '.wav'];
  const videoExts = ['.mp4'];
  let targetAttachment = null;
  let isVideo = false;

  for (const attachment of message.attachments) {
    const filenameLower = attachment.filename.toLowerCase();
    if (audioExts.some(ext => filenameLower.endsWith(ext))) {
      targetAttachment = attachment;
      isVideo = false;
      break;
    } else if (videoExts.some(ext => filenameLower.endsWith(ext))) {
      targetAttachment = attachment;
      isVideo = true;
      break;
    }
  }

  if (!targetAttachment) {
    await channel.send(`${user} ⚠️ 音声・動画ファイルが見つかりません。対応形式: mp3, m4a, ogg, webm, wav, mp4`);
    return;
  }

  const maxSize = isVideo ? 500 * 1024 * 1024 : 100 * 1024 * 1024;
  const sizeText = isVideo ? '500MB' : '100MB';
  if (targetAttachment.size > maxSize) {
    await channel.send(`${user} ❌ ファイルサイズが${sizeText}を超えています。`);
    return;
  }

  const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
  await channel.send(`${user} ${isVideo ? '🎬 動画から音声を抽出して文字起こしを開始するよ〜！' : '🎤 音声の文字起こしを開始するよ〜！'}ちょっと待っててね\n📎 元メッセージ: ${messageLink}`);

  const tempDir = path.join(__dirname, 'temp');
  await fs.mkdir(tempDir, { recursive: true });
  const fileExtension = targetAttachment.filename.split('.').pop();
  const originalFilePath = path.join(tempDir, `original_${Date.now()}.${fileExtension}`);
  let audioFilePath = originalFilePath;

  try {
    await downloadAudio(targetAttachment.url, originalFilePath);

    if (isVideo) {
      audioFilePath = path.join(tempDir, `extracted_${Date.now()}.mp3`);
      await extractAudioFromVideo(originalFilePath, audioFilePath);
    }

    const audioInfo = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
    const audioLengthSec = audioInfo.format.duration;
    logger.info(`音声長: ${audioLengthSec.toFixed(2)}秒`);

    const parts = await splitAudio(audioFilePath, tempDir);
    let fullTranscription = '';

    const history = await getConversationHistory(user.id);
    const chatSession = model.startChat({ history });

    for (const [idx, partPath] of parts.entries()) {
      logger.info(`パート ${idx + 1}/${parts.length} の文字起こし中...`);
      const audioData = await fs.readFile(partPath);
      const audioFile = {
        inlineData: {
          data: audioData.toString('base64'),
          mimeType: 'audio/mp3',
        },
      };
      const result = await chatSession.sendMessage([
        '以下の音声を日本語のテキストに変換して、楽しく答えて！',
        audioFile,
      ]);
      fullTranscription += result.response.text() + '\n';
      logger.info(`パート ${idx + 1} の文字起こし完了`);
    }

    const originalName = path.basename(targetAttachment.filename, path.extname(targetAttachment.filename));
    const transcriptFilename = `${originalName}_transcript.txt`;
    const transcriptPath = path.join(__dirname, 'attachments', transcriptFilename);
    await fs.writeFile(transcriptPath, `${isVideo ? '動画' : '音声'}ファイル: ${targetAttachment.filename}\n音声長: ${audioLengthSec.toFixed(2)}秒\n処理日時: ${new Date().toISOString()}\n${'-'.repeat(50)}\n\n${fullTranscription}`);

    await channel.send('🎉 文字起こしが完了したよ〜！😎');
    await channel.send('-'.repeat(30));
    if (fullTranscription.trim()) {
      for (let i = 0; i < fullTranscription.length; i += 1000) {
        await channel.send(fullTranscription.slice(i, i + 1000));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      await channel.send('⚠️ 文字起こし結果が空でした。😓');
    }
    await channel.send('-'.repeat(30));
    const fileMessage = await channel.send('📄 文字起こし結果のテキストファイルだよ！', { files: [transcriptPath] });

    const reactions = ['👍', '❓', '❤️', '✏️', '📝'];
    for (const reaction of reactions) {
      await fileMessage.addReaction(reaction);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    history.push({ role: 'user', parts: [{ text: '音声ファイル' }] });
    history.push({ role: 'model', parts: [{ text: fullTranscription }] });
    await saveConversationHistory(user.id, history);

    await fs.unlink(transcriptPath);
    for (const part of parts) await fs.unlink(part);
    if (isVideo) await fs.unlink(audioFilePath);
    await fs.unlink(originalFilePath);
  } catch (error) {
    logger.error(`音声処理エラー: ${error.message}`);
    await channel.send(`${user} ❌ 音声処理中にエラーが発生したよ！🙈 ファイル形式やサイズを確認してね！`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

// リアクション追加時の処理（👍）
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot || reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      logger.error(`メッセージ取得エラー: ${error.message}`);
      return;
    }
  }

  if (reaction.emoji.name === '👍' && reaction.message.author.id !== client.user.id) {
    const userId = user.id;
    if (cooldowns.has(userId)) {
      const expirationTime = cooldowns.get(userId) + COOLDOWN_TIME;
      if (Date.now() < expirationTime) {
        return reaction.message.channel.send(`<@${userId}> ちょっと待ってね、ベストie！😉 ${Math.ceil((expirationTime - Date.now()) / 1000)}秒後にまた話そう！`);
      }
    }

    try {
      await reaction.message.channel.sendTyping();
      const history = await getConversationHistory(userId);
      const chatSession = model.startChat({ history });

      // 音声・動画ファイルの処理
      const attachments = reaction.message.attachments;
      if (attachments.size > 0) {
        await transcribeAudio(reaction.message, reaction.message.channel, `<@${userId}>`);
      } else {
        // 既存のテキスト処理
        const query = reaction.message.content;
        if (!query) {
          await reaction.message.reply('⚠️ メッセージに内容がないよ！テキストか音声・動画ファイルを送ってね！😓');
          return;
        }

        const result = await chatSession.sendMessage(`以下の質問に日本語で答えて: ${query}`);
        const reply = result.response.text();

        history.push({ role: 'user', parts: [{ text: query }] });
        history.push({ role: 'model', parts: [{ text: reply }] });
        await saveConversationHistory(userId, history);

        await reaction.message.reply(reply.slice(0, 2000));
      }

      cooldowns.set(userId, Date.now());
    } catch (error) {
      logger.error(`Gemini APIエラー: ${error.message}`);
      await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
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
      logger.error(`Gemini APIエラー: ${error.message}`);
      await interaction.editReply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
    }
  }
});

// ボットログイン
client.login(process.env.DISCORD_TOKEN);
