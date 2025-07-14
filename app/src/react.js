const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const ProfileProcessor = require('./profile-processor');

// Obsidian API クライアント
class ObsidianAPI {
  constructor(baseURL, apiKey) {
    this.baseURL = baseURL;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async searchNotes(query) {
    try {
      const response = await axios.post(`${this.baseURL}/search/simple/`, null, {
        headers: this.headers,
        params: { query },
        timeout: 5000 // 5秒タイムアウト
      });
      return response.data;
    } catch (error) {
      console.error('Obsidian search error:', error.message);
      return [];
    }
  }

  async getNote(filename) {
    try {
      const response = await axios.get(`${this.baseURL}/vault/${encodeURIComponent(filename)}`, {
        headers: this.headers,
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Obsidian get note error:', error.message);
      return null;
    }
  }
}

// Obsidianクライアントとプロファイルプロセッサーの初期化
let obsidian = null;
let profileProcessor = null;

if (process.env.OBSIDIAN_URL && process.env.OBSIDIAN_API) {
  obsidian = new ObsidianAPI(process.env.OBSIDIAN_URL, process.env.OBSIDIAN_API);
  profileProcessor = new ProfileProcessor();
}

async function loadPrompt(filePath) {
  try {
    const fullPath = path.resolve(__dirname, filePath);
    const data = await fs.readFile(fullPath, 'utf8');
    return data.trim();
  } catch (error) {
    throw new Error(`Failed to load prompt from ${filePath}: ${error.message}`);
  }
}

// キーワード抽出（簡易版）
function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word));
  
  return [...new Set(words)].slice(0, 3); // 重複除去して最初の3個
}

// 関連メモ検索（動的検索）
async function findRelevantNotes(userMessage, maxNotes = 2) {
  if (!obsidian) {
    return [];
  }

  const keywords = extractKeywords(userMessage);
  if (keywords.length === 0) {
    return [];
  }

  const relevantNotes = [];
  
  for (const keyword of keywords) {
    const searchResults = await obsidian.searchNotes(keyword);
    relevantNotes.push(...searchResults.slice(0, 1)); // 各キーワードにつき最大1件
  }
  
  // 重複除去
  const uniqueNotes = [];
  const seenFiles = new Set();
  
  for (const note of relevantNotes) {
    if (!seenFiles.has(note.filename)) {
      seenFiles.add(note.filename);
      uniqueNotes.push(note);
    }
  }
  
  return uniqueNotes.slice(0, maxNotes);
}

// 基本プロファイルを取得
async function getBasicProfile() {
  if (!profileProcessor) {
    return null;
  }
  
  try {
    return await profileProcessor.getCurrentProfile();
  } catch (error) {
    console.error('Error getting basic profile:', error);
    return null;
  }
}

// プロファイルをプロンプト用のテキストに変換
function formatProfileForPrompt(profile) {
  if (!profile || Object.keys(profile).length === 0) {
    return '';
  }
  
  let profileText = '\n\n【あなたの基本的な人物特性】\n';
  
  if (profile.values && profile.values.content) {
    profileText += `価値観: ${profile.values.content.join(', ')}\n`;
  }
  
  if (profile.interests && profile.interests.content) {
    profileText += `興味・関心: ${profile.interests.content.join(', ')}\n`;
  }
  
  if (profile.personality && profile.personality.content) {
    profileText += `性格特性: ${profile.personality.content.join(', ')}\n`;
  }
  
  if (profile.thinking_patterns && profile.thinking_patterns.content) {
    profileText += `思考パターン: ${profile.thinking_patterns.content.join(', ')}\n`;
  }
  
  profileText += '\n上記があなたの基本的な特性です。これらを踏まえて、あなたらしい応答を生成してください。';
  
  return profileText;
}

// Geminiへのプロンプト構築（ハイブリッド型：基本プロファイル + 動的検索）
async function buildEnhancedPrompt(originalPrompt, userMessage) {
  let enhancedPrompt = originalPrompt;
  
  // 1. 基本プロファイルを追加
  const basicProfile = await getBasicProfile();
  const profileText = formatProfileForPrompt(basicProfile);
  if (profileText) {
    enhancedPrompt += profileText;
  }
  
  // 2. 関連メモ検索（動的検索）
  const relevantNotes = await findRelevantNotes(userMessage, 2);
  if (relevantNotes && relevantNotes.length > 0) {
    enhancedPrompt += '\n\n【関連する具体的な情報】\n';
    relevantNotes.forEach((note, index) => {
      enhancedPrompt += `参考メモ${index + 1}: ${note.filename}\n${note.content}\n\n`;
    });
    enhancedPrompt += '上記のメモも参考にして、より具体的で個人的な応答を生成してください。';
  }
  
  return {
    enhancedPrompt,
    profileUsed: !!profileText,
    notesFound: relevantNotes.length
  };
}

// プロファイル処理の定期実行
async function runProfileProcessing(genAI) {
  if (!profileProcessor) {
    console.log('Profile processor not available');
    return;
  }
  
  try {
    console.log('Starting scheduled profile processing...');
    await profileProcessor.runFullProcess(genAI);
    console.log('Scheduled profile processing completed');
  } catch (error) {
    console.error('Error in scheduled profile processing:', error);
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

  try {
    // ハイブリッド型プロンプト生成（基本プロファイル + 動的検索）
    const { enhancedPrompt, profileUsed, notesFound } = await buildEnhancedPrompt(prompt, userMessage);
    
    // Gemini APIで応答を生成
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: enhancedPrompt, // ハイブリッド強化されたプロンプトを使用
      generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
    });
    
    const chatSession = model.startChat({ history: await getConversationHistory(userId) });

    // プロンプトにユーザーメッセージを埋め込む
    const promptWithMessage = `ユーザーのメッセージに対するポジティブな応答を生成してください。メッセージ: ${userMessage}`;
    const result = await chatSession.sendMessage(promptWithMessage);
    const reply = sanitizeText(result.response.text());

    // 会話履歴を保存
    await saveConversationHistory(userId, userMessage, reply);

    // 応答を送信
    let finalReply = reply.slice(0, 1800); // 少し余裕を持たせる
    
    // デバッグ情報を追加（必要に応じて）
    const debugInfo = [];
    if (profileUsed) debugInfo.push('🧠基本プロファイル');
    if (notesFound > 0) debugInfo.push(`📝関連メモ${notesFound}件`);
    
    if (debugInfo.length > 0) {
      finalReply += `\n\n💡 参考: ${debugInfo.join(', ')}`;
    }

    await message.reply(finalReply.slice(0, 2000));

  } catch (error) {
    console.error('Error in handleReaction:', error);
    await message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

// プロファイル処理の初期化と定期実行の設定
async function initializeProfileSystem(genAI) {
  if (!profileProcessor) {
    console.log('Profile system not available (missing Obsidian config)');
    return;
  }
  
  try {
    // 初回のプロファイル処理
    console.log('Initializing profile system...');
    await profileProcessor.initializeProfileTables();
    
    // 起動時に一度実行
    const initialDelaySeconds = parseInt(process.env.PROFILE_INITIAL_DELAY_SECONDS) || 5;
    setTimeout(async () => {
      await runProfileProcessing(genAI);
    }, initialDelaySeconds * 1000);
    
    // 定期実行間隔の設定（環境変数で制御可能）
    const intervalHours = parseFloat(process.env.PROFILE_UPDATE_INTERVAL_HOURS) || 1.0;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`Profile system: Initial delay ${initialDelaySeconds}s, Update interval ${intervalHours}h`);
    
    // 定期実行
    setInterval(async () => {
      await runProfileProcessing(genAI);
    }, intervalMs);
    
    console.log('Profile system initialized with scheduled processing');
  } catch (error) {
    console.error('Error initializing profile system:', error);
  }
}

module.exports = { 
  handleReaction,
  initializeProfileSystem,
  runProfileProcessing
};
