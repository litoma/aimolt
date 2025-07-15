const { prompts } = require('./prompt');

async function handleReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory) {
  const message = reaction.message;
  const userId = user.id;

  // プロンプトを読み込む
  let prompt;
  try {
    prompt = await prompts.getLikeReaction();
  } catch (error) {
    console.error('Error loading like reaction prompt:', error.message);
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

  try {
    // システム指示を取得
    const systemInstruction = await prompts.getSystemInstruction();
    
    // Gemini APIで応答を生成
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `${systemInstruction}\n\n${prompt}`,
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    });
    
    const chatSession = model.startChat({ history: await getConversationHistory(userId) });

    // プロンプトにユーザーメッセージを埋め込む
    const promptWithMessage = `ユーザーのメッセージに対するポジティブな応答を生成してください。メッセージ: ${userMessage}`;
    const result = await chatSession.sendMessage(promptWithMessage);
    const reply = sanitizeText(result.response.text());

    // 会話履歴を保存
    await saveConversationHistory(userId, userMessage, reply);

    // 応答を送信（2000文字制限）
    await message.reply(reply.slice(0, 2000));

  } catch (error) {
    console.error('Error in handleReaction:', error);
    await message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

module.exports = { 
  handleReaction
};
