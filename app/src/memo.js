const { EmbedBuilder } = require('discord.js');
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
async function handleMemoReaction(message, channel, user) {
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
    
    // 引用ブロック（>>> テキスト）の処理
    if (inputText.startsWith('>>> ')) {
      inputText = inputText.substring(4); // ">>> "を除去
      console.log('引用ブロック形式のテキストを処理');
    }
    
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
    const processingMsg = await channel.send(`${user} 📝 メッセージをObsidian Daily Noteに追加中...`);

    // メタデータを付与してObsidianに追加
    try {
      const timeOnly = new Date().toLocaleString('ja-JP', { 
        timeZone: 'Asia/Tokyo',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const finalContent = `- [${timeOnly}](${messageLink}) ${inputText}\n\n`;

      // Obsidian REST APIを呼び出してDailyメモに追加
      await appendToObsidianDaily(finalContent);

      // 成功メッセージ
      await processingMsg.edit({
        content: '',
        embeds: [{
          title: '✅ Obsidian追加完了',
          description: 'Daily Noteに追加しました。',
          color: 0x00ff00
        }]
      });

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