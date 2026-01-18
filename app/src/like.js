const { prompts } = require('./prompt');
const AimoltProfileSync = require('./profile-sync');
const { personalityManagerV2 } = require('./personality/manager-v2');
const { retryGeminiApiCall } = require('./utils/retry');

// プロファイル同期インスタンス（グローバル）
const profileSync = new AimoltProfileSync();

async function handleLikeReaction(reaction, user, genAI, getConversationHistory, saveConversationHistory) {
  const message = reaction.message;
  const userId = user.id;

  // メッセージ内容をサニタイズ（絵文字を保持）
  const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/[\x00-\x1F\x7F\"]/g, '').replace(/\\/g, '\\\\').replace(/,/g, '\\,');
  };

  const userMessage = sanitizeText(message.content);
  if (!userMessage) {
    return message.reply('メッセージが空か無効です！😅');
  }

  // 動的プロンプトを取得（人格システム統合）
  let enhancedPrompt;
  try {
    enhancedPrompt = await prompts.getDynamicLike(userId, userMessage);
  } catch (error) {
    console.error('Error loading dynamic like prompt:', error.message);
    // フォールバック：静的プロンプトを使用
    try {
      enhancedPrompt = await prompts.getLike();
    } catch (fallbackError) {
      console.error('Error loading fallback prompt:', fallbackError.message);
      return message.reply('プロンプトの読み込みに失敗しました！🙈');
    }
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

    // プロファイル拡張を適用（既存システムとの互換性のため）
    let finalPrompt = enhancedPrompt;
    try {
      const profile = await profileSync.getProfile();
      if (profile) {
        const profileExtension = profileSync.generateLikePromptExtension(profile, userMessage);
        if (profileExtension) {
          finalPrompt = `${enhancedPrompt}${profileExtension}`;
          console.log('📋 Personal profile applied to like reaction (adaptive mode)');
        }
      }
    } catch (error) {
      console.warn('⚠️ Profile load failed, using personality system only:', error.message);
    }

    // Gemini APIで応答を生成
    const model = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      systemInstruction: `${systemInstruction}\n\n${finalPrompt}`,
      generationConfig: {
        maxOutputTokens: 2000,  // 文章の途中切れを防止
        temperature: 1.0,       // デフォルト値: 創造性と自然さ重視
        topP: 0.95             // 多様性確保
      },
    });

    const chatSession = model.startChat({ history: await getConversationHistory(userId) });

    // プロンプトにユーザーメッセージを埋め込む
    const promptWithMessage = `ユーザーのメッセージに対するポジティブな応答を生成してください。メッセージ: ${userMessage}`;

    // リトライ機能付きでGemini API呼び出し
    const result = await retryGeminiApiCall(
      async () => await chatSession.sendMessage(promptWithMessage),
      '👍 Like応答生成',
      { maxRetries: 3, baseDelay: 1000, maxDelay: 8000 }
    );

    const reply = sanitizeText(result.response.text());

    // 会話履歴を保存
    await saveConversationHistory(userId, userMessage, reply);

    // 人格システムv2.0を更新（非同期で実行）
    personalityManagerV2.updatePersonalityFromConversation(
      userId,
      userMessage,
      reply,
      message.id
    ).catch(error => {
      console.error('Error updating personality system:', error);
    });

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
