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

  for (const attachment of message.attachments.values()) {
    const filename = attachment.filename || attachment.name || 'voice-message.ogg';
    const filenameLower = filename.toLowerCase();

    if (audioExts.some(ext => filenameLower.endsWith(ext))) {
      targetAttachment = attachment;
      break;
    }
  }

  if (!targetAttachment) {
    await channel.send(`<@${user.id}> ⚠️ 音声ファイルが見つかりません。対応形式: ogg`);
    return;
  }

  const maxSize = 100 * 1024 * 1024; // 100MB
  if (targetAttachment.size > maxSize) {
    await channel.send(`<@${user.id}> ❌ ファイルサイズが100MBを超えています。`);
    return;
  }

  const filename = targetAttachment.filename || targetAttachment.name || `voice-message-${Date.now()}.ogg`;
  const filePath = path.join(__dirname, '../temp', `original_${Date.now()}.ogg`);
  const mimeType = 'audio/ogg';

  try {
    await downloadAudio(targetAttachment.proxyUrl, filePath, targetAttachment.url);

    const transcriptionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: '' });
    // 会話履歴を使用せずに直接文字起こし処理
    const chatSession = transcriptionModel.startChat();

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

    await channel.send('🎉 文字起こしが完了したよ〜！');
    if (transcription.trim()) {
      for (let i = 0; i < transcription.length; i += 1000) {
        await channel.send(transcription.slice(i, i + 1000));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      await channel.send(`<@${user.id}> ⚠️ 文字起こし結果が空でした。😓`);
    }

    // 会話履歴の保存を無効化（コメントアウト）
    // await saveConversationHistory(userId, '音声ファイル', transcription);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      // ファイル削除エラーは静かに処理
    }
  } catch (error) {
    await channel.send(`<@${user.id}> ❌ 音声処理中にエラーが発生したよ！🙈 詳細: ${error.message}`);
  }
}

module.exports = { transcribeAudio };