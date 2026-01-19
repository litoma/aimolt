const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { prompts } = require('./prompt');
const { retryGeminiApiCall } = require('./utils/retry');
const { GEMINI_MODELS } = require('./config');

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

// ケバ取り用の後処理関数
function removeFillerWords(text) {
  // 一般的なフィラー語のパターン
  const fillerPatterns = [
    /\b(あー|ああ|あああ)+\b/g,
    /\b(えー|ええ|えええ)+\b/g,
    /\b(うー|ううん|うう)+\b/g,
    /\b(おー|おお)+\b/g,
    /\b(んー|んん)+\b/g,
    /\b(まあ|まー)+\b/g,
    /\b(そのー|その)+\b/g,
    /\b(なんか|なんて)+\b/g,
    /\b(ちょっと)+\b/g,
    // 繰り返し表現
    /(.)\\1{2,}/g, // 同じ文字が3回以上連続
    // 余分な空白
    /\s+/g
  ];

  let cleanText = text;
  fillerPatterns.forEach(pattern => {
    if (pattern.source === '\\\\s+') {
      cleanText = cleanText.replace(pattern, ' ');
    } else if (pattern.source === '(.)\\\\1{2,}') {
      cleanText = cleanText.replace(pattern, '$1$1');
    } else {
      cleanText = cleanText.replace(pattern, '');
    }
  });

  return cleanText.trim();
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

    // 静的文字起こしプロンプトを取得
    let systemInstruction;
    try {
      systemInstruction = await prompts.getTranscribe();
      console.log('静的文字起こしプロンプトを使用');
    } catch (error) {
      console.error('文字起こしプロンプト取得エラー:', error.message);
      // フォールバック用のプロンプト
      systemInstruction = `
音声を日本語のテキストに変換してください。以下の点に注意してください：
- フィラー語（あー、えー、うー、んー、まあ、そのー等）は除去する
- 意味のない繰り返しや言い直しは除去する
- 自然で読みやすい文章にする
- 句読点を適切に配置する
- 重要な内容のみを抽出する
      `;
    }

    const transcriptionModel = genAI.getGenerativeModel({
      model: GEMINI_MODELS.FLASH_2_5,
      systemInstruction: systemInstruction
    });

    const chatSession = transcriptionModel.startChat();

    const audioData = await fs.readFile(filePath);
    const audioFile = {
      inlineData: {
        data: audioData.toString('base64'),
        mimeType,
      },
    };

    // リトライ機能付きでGemini API呼び出し
    const result = await retryGeminiApiCall(
      async () => await chatSession.sendMessage([
        '以下の音声を日本語のテキストに変換し、フィラー語を除去して自然な文章にしてください。',
        audioFile,
      ]),
      '🎤 音声文字起こし',
      { maxRetries: 3, baseDelay: 2000, maxDelay: 12000 }
    );

    let transcription = result.response.text();

    // 追加の後処理でケバ取り
    transcription = removeFillerWords(transcription);


    await channel.send('🎉 文字起こしが完了したよ〜！');
    if (transcription.trim()) {
      // 引用ブロックで囲んで送信
      const quotedText = `>>> ${transcription}`;

      for (let i = 0; i < quotedText.length; i += 1000) {
        await channel.send(quotedText.slice(i, i + 1000));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      await channel.send(`<@${user.id}> ⚠️ 文字起こし結果が空でした。😓`);
    }

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
