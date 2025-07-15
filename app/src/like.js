const { prompts } = require('./prompt');
const AimoltProfileSync = require('./profile-sync');

// プロファイル同期インスタンス（グローバル）
const profileSync = new AimoltProfileSync();

async function handleLikeReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory) {
  const message = reaction.message;
  const userId = user.id;

  // 基本プロンプトを読み込む
  let basePrompt;
  try {
    basePrompt = await prompts.getLike();
  } catch (error) {
    console.error('Error loading like prompt:', error.message);
    return message.reply('プロンプトの読み込みに失敗しました！🙈');
  }

  // メッセージ内容をサニタイズ（絵文字を保持）
  const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/[\x00-\x1F\x7F\"]/g, '').replace(/\\/g, '\\\\').replace(/,/g, '\\,');
  };

  const userMessage = sanitizeText(message.content);
  if (!userMessage) {
    return message.reply('メッセージが空か無効です！😅');
  }

  try {
    // システム指示を取得
    const systemInstruction = await prompts.getSystem();
    
    // 個人プロファイルを取得（like.js実行時のみ、適応型）
    let profileExtension = '';
    try {
      const profile = await profileSync.getProfile();
      if (profile) {
        profileExtension = profileSync.generateLikePromptExtension(profile, userMessage);
        if (profileExtension) {
          console.log('📋 Personal profile applied to like reaction (adaptive mode)');
        }
      }
    } catch (error) {
      console.warn('⚠️ Profile load failed, using default prompts:', error.message);
      // プロファイル取得に失敗してもメイン機能は継続
    }

    // 統合プロンプトを構築
    const enhancedPrompt = `${basePrompt}${profileExtension}`;
    
    // Gemini APIで応答を生成
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: `${systemInstruction}\n\n${enhancedPrompt}`,
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
    console.error('Error in handleLikeReaction:', error);
    await message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

// プロファイル状態確認関数（デバッグ用）
async function getProfileStatus() {
  return profileSync.getStatus();
}

// プロファイル強制更新関数（管理用）
async function forceRefreshProfile() {
  return await profileSync.forceRefresh();
}

module.exports = { 
  handleLikeReaction,
  getProfileStatus,
  forceRefreshProfile
};