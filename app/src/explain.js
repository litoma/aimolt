const { EmbedBuilder } = require('discord.js');
const { prompts } = require('./prompt');
const { cleanJsonResponse } = require('./utils/json-cleaner');
const { retryGeminiApiCall } = require('./utils/retry');
const { GEMINI_MODEL } = require('./config');

// Embed内容の抽出
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

// URL検出と警告
async function checkContentForUrls(contentText, user, channel) {
  const urlPattern = /https?:\/\/[^\s]+/g;
  const urls = contentText.match(urlPattern) || [];

  if (urls.length) {
    const warningMsg = `${user} ⚠️ URLが含まれたコンテンツを検出しました\n📝 URLの中身は読み取ることができませんが、このまま処理を続行します\n🔗 検出されたURL: ${urls.length}個`;
    await channel.send(warningMsg);
  }
  return contentText;
}

// 解説処理
async function handleExplainReaction(message, channel, user, genAI, getConversationHistory, saveConversationHistory) {
  try {
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

    // URL検出・警告
    await checkContentForUrls(inputText, user, channel);

    // 処理開始メッセージ
    const messageLink = `https://discord.com/channels/${message.guildId}/${channel.id}/${message.id}`;
    await channel.send(`${user} 🤔 投稿内容について詳しく解説するね〜！ちょっと待っててね\n📎 元メッセージ: ${messageLink}`);

    // 静的解説プロンプトの読み込み
    let explainPrompt;
    try {
      explainPrompt = await prompts.getExplain();
      console.log('静的解説プロンプトを使用');
    } catch (error) {
      console.error('解説プロンプト取得エラー:', error.message);
      await channel.send(`${user} ❌ プロンプトの読み込みに失敗しました。`);
      return;
    }

    // Gemini APIで解説生成（gemini-2.5-pro: 正確性と論理性重視）
    try {
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        systemInstruction: { parts: [{ text: explainPrompt }] },
        generationConfig: {
          maxOutputTokens: 1200,  // 的確で簡潔な解説
          temperature: 0.6,       // 正確性重視
          topP: 0.9              // 安定した解説品質
        }
      });

      // 新しいチャットセッションを開始（履歴なし）
      const chatSession = model.startChat({ history: [] });

      // リトライ機能付きでGemini API呼び出し
      const result = await retryGeminiApiCall(
        async () => await chatSession.sendMessage(inputText),
        '❓ 解説生成',
        { maxRetries: 3, baseDelay: 1500, maxDelay: 10000 }
      );
      let explanation = result.response.text();
      if (explanation.length > 1500) {
        explanation = explanation.substring(0, 1500) + '...';
      }

      // 会話履歴には保存しない（要件通り）


      // 結果を送信
      const embed = new EmbedBuilder()
        .setTitle('🤔 AI解説')
        .setDescription(explanation)
        .setColor(0xFF6B35)
        .addFields({
          name: '📝 元の投稿',
          value: message.content.length > 200 ? message.content.substring(0, 200) + '...' : message.content || '（内容なし）'
        });

      await channel.send({ content: '💡 解説が完了したよ〜！', embeds: [embed] });
    } catch (error) {
      console.error(`Gemini API エラー (解説機能): ${error.message}`);
      await channel.send(`${user} ❌ 解説の生成中にエラーが発生しました。`);
    }
  } catch (error) {
    console.error(`解説処理エラー: ${error.message}`);
  }
}

module.exports = { handleExplainReaction };
