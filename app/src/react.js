// react.js
const fs = require('fs').promises;
const path = require('path');

async function loadPrompt(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    return data.trim();
  } catch (error) {
    throw new Error(`Failed to load prompt from ${filePath}: ${error.message}`);
  }
}

async function handleReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory) {
  const message = reaction.message;
  const userId = user.id;

  // プロンプトを読み込む
  let prompt;
  try {
    prompt = await loadPrompt(path.join(__dirname, '../prompt', 'like_reaction.txt'));
  } catch (error) {
    return message.reply('プロンプトの読み込みに失敗しました！🙈');
  }

  // メッセージ内容をサニタイズ（絵文字を保持）
  const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    // 制御文字と引用符のみエスケープ、絵文字（Unicode U+1F600以降）は保持
    return text.replace(/[\x00-\x1F\x7F"]/g, '').replace(/\\/g, '\\\\').replace(/,/g, '\\,');
  };

  const userMessage = sanitizeText(message.content);
  if (!userMessage) {
    return message.reply('メッセージが空か無効です！😅');
  }

  // Gemini APIで応答を生成
  try {
    // システムプロンプトを明示的に設定
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: prompt, // システムプロンプトとして適用
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    });
    const chatSession = model.startChat({ history: await getConversationHistory(userId) });

    // プロンプトにユーザーメッセージを埋め込む
    const promptWithMessage = `ユーザーのメッセージに対するポジティブな応答を生成してください。メッセージ: ${userMessage}`;
    const result = await chatSession.sendMessage(promptWithMessage);
    const reply = sanitizeText(result.response.text());

    // 会話履歴に追加
    const history = await getConversationHistory(userId);
    history.push({ role: 'user', parts: [{ text: userMessage }] });
    history.push({ role: 'model', parts: [{ text: reply }] });

    // 会話履歴を保存
    await saveConversationHistory(userId, history);

    // 応答を送信
    await message.reply(reply.slice(0, 2000));
  } catch (error) {
    console.error('Error in handleReaction:', error); // デバッグログ
    await message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

module.exports = { handleReaction };
