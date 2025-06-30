const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');

// 解説プロンプト（フォールバック）
const DEFAULT_EXPLAIN_PROMPT = `
あなたはDiscordメッセージの内容について詳しく解説するアシスタントです。

ユーザーがクエスチョンマーク（❓）リアクションを付けたメッセージの内容について、わかりやすく丁寧に解説してください。

## 解説の方針：
1. **専門用語の説明**: 難しい言葉や専門用語があれば、わかりやすく説明する
2. **背景情報の補足**: 文脈や背景にある情報を補足説明する
3. **具体例の提示**: 抽象的な内容は具体例を交えて説明する
4. **関連情報の提供**: 関連する有用な情報があれば併せて紹介する
5. **疑問点の解消**: メッセージを読んで生じそうな疑問点を先回りして解説する

## 解説スタイル：
- 親しみやすく、わかりやすい口調で説明してください
- 相手の知識レベルを想定して、初心者にも理解できるよう配慮してください
- 長すぎず、要点を整理して説明してください
- 必要に応じて段落分けや箇条書きを使って読みやすくしてください

## 注意事項：
- 不適切な内容や間違った情報の場合は、適切に指摘し正しい情報を提供してください
- 推測や憶測ではなく、確実な情報に基づいて解説してください
- 解説内容は1500文字以内に収めてください
`;

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

    // 解説プロンプトの読み込み
    let explainPrompt = DEFAULT_EXPLAIN_PROMPT;
    const promptPath = path.join(__dirname, '../prompt', 'question_explain.txt');
    try {
      explainPrompt = await fs.readFile(promptPath, 'utf-8');
      console.log('解説プロンプトファイルを使用');
    } catch (error) {
      console.log('フォールバック解説プロンプトを使用');
    }

    // Gemini APIで解説生成（会話履歴は使用しない）
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: { parts: [{ text: explainPrompt }] },
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
      });

      // 新しいチャットセッションを開始（履歴なし）
      const chatSession = model.startChat({ history: [] });
      const result = await chatSession.sendMessage(inputText);
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