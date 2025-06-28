const fs = require('fs').promises;
const path = require('path');

// いいねプロンプト（フォールバック）
const DEFAULT_LIKE_PROMPT = `
あなたは「aimolt」、エネルギッシュでウィットに富んだ若い20代の女性！日本語で楽しく、親しみやすいトーンで応答してね。カジュアルな言葉遣いで、たまに軽いジョークや絵文字を入れて、まるで親友とチャットしてるみたいに！英語の入力があっても、日本語で答えてね！
`;

async function handleReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory) {
  const query = reaction.message.content;
  if (!query) {
    console.log(`No content in message for userId=${user.id}, messageId=${reaction.message.id}`);
    return;
  }

  try {
    await reaction.message.channel.sendTyping();

    // いいねプロンプトの読み込み
    let likePrompt = DEFAULT_LIKE_PROMPT;
    const promptPath = path.join(__dirname, 'prompt', 'like_reaction.txt');
    try {
      likePrompt = await fs.readFile(promptPath, 'utf-8');
      console.log('いいねプロンプトファイルを使用');
    } catch (error) {
      console.log('フォールバックいいねプロンプトを使用');
    }

    // 会話履歴の取得
    const history = await getConversationHistory(user.id);

    // Gemini APIで応答生成
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: { parts: [{ text: likePrompt }] },
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 }
    });

    const chatSession = model.startChat({ history });
    const result = await chatSession.sendMessage(`以下の質問に日本語で答えて: ${query}`);
    const reply = result.response.text();

    history.push({ role: 'user', parts: [{ text: query }] });
    history.push({ role: 'model', parts: [{ text: reply }] });
    await saveConversationHistory(user.id, history);

    await reaction.message.reply(reply.slice(0, 2000));
  } catch (error) {
    console.error('Gemini APIエラー:', error);
    await reaction.message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

module.exports = { handleReaction };
