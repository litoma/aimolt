async function handleReaction(reaction, user, model, getConversationHistory, saveConversationHistory) {
  const query = reaction.message.content;
  if (!query) {
    console.log(`No content in message for userId=${user.id}, messageId=${reaction.message.id}`);
    return;
  }

  try {
    await reaction.message.channel.sendTyping();
    const history = await getConversationHistory(user.id);
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
