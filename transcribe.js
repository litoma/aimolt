const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// 音声ファイルをダウンロード
async function downloadAudio(url, filePath, fallbackUrl) {
  const urlsToTry = [url, fallbackUrl].filter(Boolean);
  const tempDir = path.dirname(filePath);
  try {
    await fs.mkdir(tempDir, { recursive: true });
    await fs.access(tempDir, fs.constants.W_OK);
    console.log(`ダウンロード用ディレクトリ確認: ${tempDir} (書き込み可能)`);
  } catch (error) {
    console.error(`ダウンロード用ディレクトリ作成/権限エラー: ${tempDir}, エラー:`, error);
    throw error;
  }

  console.log(`試行するURL: ${JSON.stringify(urlsToTry)}`);
  if (urlsToTry.length === 0) {
    console.error('有効なURLがありません: urlとfallbackUrlがどちらもundefinedまたは空');
    throw new Error('有効なURLがありません');
  }

  for (const tryUrl of urlsToTry) {
    console.log(`ダウンロード開始: ${tryUrl} -> ${filePath}`);
    try {
      try {
        new URL(tryUrl);
        console.log(`URL形式検証: ${tryUrl} (有効)`);
      } catch (urlError) {
        console.error(`無効なURL: ${tryUrl}, エラー:`, urlError);
        throw new Error(`無効なURL: ${tryUrl}`);
      }

      await new Promise((resolve, reject) => {
        const fileStream = require('fs').createWriteStream(filePath);
        const request = https.get(tryUrl, {
          headers: { 'User-Agent': 'Node.js aimolt bot' },
          timeout: 30000,
        }, (response) => {
          console.log(`レスポンス受信: ${tryUrl}, ステータス: ${response.statusCode}`);
          if (response.statusCode !== 200) {
            fileStream.close();
            return reject(new Error(`HTTPステータスエラー: ${response.statusCode}`));
          }
          response.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            console.log(`ファイル書き込み完了: ${filePath}`);
            resolve();
          });
          fileStream.on('error', (err) => {
            fileStream.close();
            console.error(`ファイル書き込みエラー: ${err.message}`);
            reject(err);
          });
        });
        request.on('error', (err) => {
          fileStream.close();
          console.error(`リクエストエラー: ${err.message}, URL: ${tryUrl}`);
          reject(err);
        });
        request.on('timeout', () => {
          request.destroy();
          fileStream.close();
          console.error(`リクエストタイムアウト: ${tryUrl}`);
          reject(new Error('リクエストタイムアウト'));
        });
      });

      const stats = await fs.stat(filePath);
      console.log(`ファイル存在確認: ${filePath} (サイズ: ${stats.size} bytes)`);
      return;
    } catch (error) {
      console.error(`ダウンロードエラー: ${error.message}, URL: ${tryUrl}`);
      if (tryUrl === urlsToTry[urlsToTry.length - 1]) {
        throw new Error(`すべてのURLでダウンロード失敗: ${error.message}`);
      }
    }
  }
  throw new Error('ダウンロード試行がすべて失敗');
}

// 音声文字起こし
async function transcribeAudio(message, channel, user, genAI, getConversationHistory, saveConversationHistory) {
  const audioExts = ['.ogg'];
  let targetAttachment = null;

  console.log(`添付ファイル数: ${message.attachments.size}`);
  message.attachments.forEach((attachment, index) => {
    console.log(`添付ファイル ${index + 1}: ${JSON.stringify({
      id: attachment.id,
      filename: attachment.filename,
      name: attachment.name,
      contentType: attachment.contentType,
      size: attachment.size,
      url: attachment.url,
      proxyUrl: attachment.proxyUrl
    })}`);
  });

  for (const attachment of message.attachments.values()) {
    const filename = attachment.filename || attachment.name || 'voice-message.ogg';
    const filenameLower = filename.toLowerCase();
    console.log(`処理中のファイル名: ${filenameLower}`);
    console.log(`URL詳細: url=${attachment.url}, proxyUrl=${attachment.proxyUrl}`);

    if (audioExts.some(ext => filenameLower.endsWith(ext))) {
      targetAttachment = attachment;
      break;
    }
  }

  if (!targetAttachment) {
    console.error('適切な音声ファイルが見つかりません');
    await channel.send(`<@${user.id}> ⚠️ 音声ファイルが見つかりません。対応形式: ogg`);
    return;
  }

  const maxSize = 100 * 1024 * 1024; // 100MB
  if (targetAttachment.size > maxSize) {
    console.error(`ファイルサイズ超過: ${targetAttachment.size} bytes, 制限: ${maxSize} bytes`);
    await channel.send(`<@${user.id}> ❌ ファイルサイズが100MBを超えています。`);
    return;
  }

  const filename = targetAttachment.filename || targetAttachment.name || `voice-message-${Date.now()}.ogg`;
  const filePath = path.join(__dirname, 'temp', `original_${Date.now()}.ogg`);
  const mimeType = 'audio/ogg';

  try {
    console.log(`ダウンロード処理開始: ${filePath}`);
    await downloadAudio(targetAttachment.proxyUrl, filePath, targetAttachment.url);

    const userId = user.id;
    console.log(`文字起こし用userId: ${userId}`);
    const history = await getConversationHistory(userId);
    const transcriptionModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: '' });
    const chatSession = transcriptionModel.startChat({ history });

    console.log(`音声文字起こし開始: ${filePath}`);
    const audioData = await fs.readFile(filePath);
    const audioFile = {
      inlineData: {
        data: audioData.toString('base64'),
        mimeType,
      },
    };
    const result = await chatSession.sendMessage([
      '以下の音声を日本語のテキストに変換するだけ',
      audioFile,
    ]);
    const transcription = result.response.text();
    console.log(`文字起こし完了: ${transcription}`);

    await channel.send('🎉 文字起こしが完了したよ〜！');
    if (transcription.trim()) {
      for (let i = 0; i < transcription.length; i += 1000) {
        await channel.send(transcription.slice(i, i + 1000));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      await channel.send(`<@${userId}> ⚠️ 文字起こし結果が空でした。😓`);
    }

    history.push({ role: 'user', parts: [{ text: '音声ファイル' }] });
    history.push({ role: 'model', parts: [{ text: transcription }] });
    await saveConversationHistory(userId, history);

    try {
      await fs.unlink(filePath);
      console.log(`音声ファイル削除: ${filePath}`);
    } catch (error) {
      console.error(`音声ファイル削除エラー: ${filePath}, エラー:`, error);
    }
  } catch (error) {
    console.error(`音声処理エラー: ${error.message}`);
    await channel.send(`<@${user.id}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
  }
}

module.exports = { transcribeAudio };
