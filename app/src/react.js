// react.js
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

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

// Obsidianクライアントの初期化
let obsidian = null;
if (process.env.OBSIDIAN_URL && process.env.OBSIDIAN_API_KEY) {
  obsidian = new ObsidianAPI(process.env.OBSIDIAN_URL, process.env.OBSIDIAN_API_KEY);
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

// 関連メモ検索
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

// Geminiへのプロンプト構築（Obsidianメモ付き）
function buildPromptWithContext(originalPrompt, userMessage, relevantNotes) {
  if (!relevantNotes || relevantNotes.length === 0) {
    return originalPrompt;
  }

  let contextPrompt = originalPrompt + '\n\n';
  contextPrompt += '以下のメモを参考情報として活用してください：\n\n';

  relevantNotes.forEach((note, index) => {
    contextPrompt += `【参考メモ${index + 1}: ${note.filename}】\n${note.content}\n\n`;
  });

  contextPrompt += `上記のメモの内容も参考にしつつ、ユーザーのメッセージに対してポジティブで有用な応答を生成してください。`;

  return contextPrompt;
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
    // 関連メモ検索（Obsidian連携）
    const relevantNotes = await findRelevantNotes(userMessage);
    
    // プロンプトにObsidianメモのコンテキストを追加
    const enhancedPrompt = buildPromptWithContext(prompt, userMessage, relevantNotes);
    
    // Gemini 2.5用のモデル設定（動的思考を有効化）
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: enhancedPrompt,
      generationConfig: { 
        maxOutputTokens: 2000, 
        temperature: 0.7,
        // Gemini 2.5の動的思考機能を有効化
        thinkingBudget: -1  // 無制限の思考トークン
      },
    });
    
    const chatSession = model.startChat({ history: await getConversationHistory(userId) });

    // プロンプトにユーザーメッセージを埋め込む
    const promptWithMessage = `ユーザーのメッセージに対するポジティブな応答を生成してください。メッセージ: ${userMessage}`;
    const result = await chatSession.sendMessage(promptWithMessage);
    const reply = sanitizeText(result.response.text());

    // 会話履歴を保存
    await saveConversationHistory(userId, userMessage, reply);

    // 応答を送信（関連メモがある場合は追記）
    let finalReply = reply.slice(0, 1800); // 少し余裕を持たせる
    if (relevantNotes.length > 0) {
      const notesList = relevantNotes.map(note => note.filename).join(', ');
      finalReply += `\n\n📝 参考メモ: ${notesList}`;
    }

    await message.reply(finalReply.slice(0, 2000));

  } catch (error) {
    console.error('Error in handleReaction:', error);
    await message.reply('うわっ、なんかミスっちゃったみたい！🙈 もう一回試してみてね！');
  }
}

module.exports = { handleReaction };