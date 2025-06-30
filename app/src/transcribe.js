const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// 音声ファイルのダウンロード関数
async function downloadAudio(url, filePath, fallbackUrl) {
  return new Promise((resolve, reject) => {
    const downloadUrl = url || fallbackUrl;
    const file = require('fs').createWriteStream(filePath);
    
    https.get(downloadUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
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
  const filePath = path.join(__dirname, '../temp', `original_${Date.now()}.ogg`);
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

    // 新しいシグネチャに合わせて保存
    await saveConversationHistory(userId, '音声ファイル', transcription);

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