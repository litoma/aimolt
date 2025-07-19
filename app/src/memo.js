const { EmbedBuilder } = require('discord.js');
const { prompts } = require('./prompt');
const { personalityManager } = require('./personality/manager');
const { retryGeminiApiCall } = require('./utils/retry');
const https = require('https');
const http = require('http');

// Obsidian REST API設定
const OBSIDIAN_URL = process.env.OBSIDIAN_URL;
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API;

// Embed内容の抽出（explain.jsと同様の処理）
function extractEmbedContent(message) {
  try {
    if (!message.embeds.length) return null;

    let embedContent = '';
    for (const embed of message.embeds) {
      if (embed.title) embedContent += `# ${embed.title}\n\n`;
      if (embed.description) embedContent += `${embed.description}\n\n`;
      for (const field of embed.fields) {
        if (field.name && field.value) {
          const fieldValue = field.value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
          embedContent += `**${field.name}**: ${fieldValue}\n\n`;
        }
      }
    }

    if (embedContent.trim()) {
      console.log(`Embed内容を抽出: ${embedContent.length}文字`);
      return embedContent.trim();
    }
    return null;
  } catch (error) {
    console.error(`Embed内容抽出エラー: ${error.message}`);
    return null;
  }
}

// Obsidian REST API呼び出し
async function appendToObsidianDaily(content) {
  return new Promise((resolve, reject) => {
    try {
      // URLをパースしてプロトコルを確認
      let parsedUrl;
      try {
        parsedUrl = new URL(`${OBSIDIAN_URL}/periodic/daily/`);
      } catch (urlError) {
        reject(new Error(`Invalid URL format: ${OBSIDIAN_URL}/periodic/daily/ - ${urlError.message}`));
        return;
      }
      
      const isHttps = parsedUrl.protocol === 'https:';
      const requestModule = isHttps ? https : http;
      
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OBSIDIAN_API_KEY}`,
          'Content-Type': 'text/markdown'
        }
      };

      const req = requestModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request error: ${error.message}`));
      });

      req.write(content);
      req.end();
    } catch (error) {
      reject(new Error(`Setup error: ${error.message}`));
    }
  });
}

// メモリアクション処理
async function handleMemoReaction(message, channel, user, genAI) {
  try {
    // 環境変数の確認
    console.log('環境変数確認:', {
      OBSIDIAN_URL: OBSIDIAN_URL,
      OBSIDIAN_API_KEY: OBSIDIAN_API_KEY ? '設定済み' : '未設定'
    });
    
    if (!OBSIDIAN_URL) {
      await channel.send(`${user} ❌ OBSIDIAN_URLが設定されていません。`);
      return;
    }
    
    if (!OBSIDIAN_API_KEY) {
      await channel.send(`${user} ❌ OBSIDIAN_APIが設定されていません。`);
      return;
    }

    // メッセージ内容収集
    let inputText = message.content || '';
    const embedContent = extractEmbedContent(message);
    if (embedContent) {
      inputText += inputText ? `\n\n【Embed内容】\n${embedContent}` : embedContent;
      console.log('Embed内容を追加');
    }

    if (!inputText.trim()) {
      await channel.send(`${user} ⚠️ メッセージに内容がありません。`);
      return;
    }

    // 処理開始メッセージ
    const messageLink = `https://discord.com/channels/${message.guildId}/${channel.id}/${message.id}`;
    const processingMsg = await channel.send(`${user} 📝 メッセージをObsidianのDailyメモに追加中...`);

    // 動的メモプロンプトの読み込み（人格システム統合）
    let memoPrompt;
    try {
      memoPrompt = await prompts.getDynamicMemo(user.id, inputText);
      console.log('動的メモプロンプトを人格システムから取得');
    } catch (error) {
      console.error('動的メモプロンプト取得エラー:', error.message);
      // フォールバック：静的プロンプトを使用
      try {
        memoPrompt = await prompts.getMemo();
        console.log('フォールバック：静的メモプロンプトを使用');
      } catch (fallbackError) {
        console.error('フォールバックメモプロンプト取得エラー:', fallbackError.message);
        // フォールバック用のプロンプト
        memoPrompt = `
メッセージ内容を自然で読みやすい形に整形してください。
重要な情報は保持しつつ、不要な要素は除去してください。
Obsidianのマークダウン形式で出力してください。
        `;
      }
    }

    // Gemini APIでメッセージを整形
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: { parts: [{ text: memoPrompt }] },
        generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
      });

      const chatSession = model.startChat({ history: [] });
      
      // リトライ機能付きでGemini API呼び出し
      const result = await retryGeminiApiCall(
        async () => await chatSession.sendMessage(inputText),
        '📝 メモ整形',
        { maxRetries: 3, baseDelay: 1000, maxDelay: 8000 }
      );
      let formattedContent = result.response.text();

      // メタデータを付与
      const timeOnly = new Date().toLocaleString('ja-JP', { 
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const finalContent = `[${timeOnly}](${messageLink}) ${formattedContent}\n\n`;

      // Obsidian REST APIを呼び出してDailyメモに追加
      await appendToObsidianDaily(finalContent);

      // 人格システムを更新（非同期で実行）
      personalityManager.updatePersonalityFromConversation(
        user.id, 
        inputText, 
        formattedContent, 
        message.id
      ).catch(error => {
        console.error('Error updating personality system:', error);
      });

      // 成功メッセージ
      await processingMsg.edit('✅ Obsidian Daily Note追加完了');

    } catch (error) {
      console.error(`メモ処理エラー: ${error.message}`);
      await processingMsg.edit({
        content: '',
        embeds: [{
          title: '❌ メモ追加失敗',
          description: 'メモの追加中にエラーが発生しました。',
          color: 0xff0000,
          fields: [
            { name: 'エラー詳細', value: `\`${error.message}\``, inline: false },
            { name: 'Obsidian URL', value: `\`${OBSIDIAN_URL}\``, inline: false },
            { name: 'デバッグ情報', value: 'REST APIプラグインが有効で、正しいAPIキーが設定されているか確認してください。', inline: false }
          ],
          timestamp: new Date().toISOString(),
          footer: { text: 'AImolt Memo System' }
        }]
      });
    }
  } catch (error) {
    console.error(`メモリアクション処理エラー: ${error.message}`);
    await channel.send(`${user} ❌ メモ機能でエラーが発生しました。`);
  }
}

module.exports = { handleMemoReaction };