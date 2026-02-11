# AImolt Discord Bot

AImoltは、**Gemini** と **Supabase** を活用した、高度な対話能力と長期記憶を持つDiscordボットです。
**NestJS** で構築されており、**Koyeb** 上で常駐プロセスとして動作します。

## 🚀 主な機能

### 1. 高度な対話 (Gemini API)
- **テキスト応答**: 👍リアクションでAIが応答。文脈を理解し、過去の会話や関連情報を踏まえた回答を行います。
- **音声文字起こし**: 🎤リアクションでボイスメッセージや音声ファイルを文字起こし。
- **画像認識**: 画像付きメッセージに対しても内容を理解して応答可能。

### 2. 人格・記憶システム (Personality System)
AImoltは単なるチャットボットではなく、ユーザーとの対話を通じて感情や関係性が変化する「人格」を持っています。

#### ❤️ 感情モデル (VAD Model)
心理学の **VADモデル (Valence, Arousal, Dominance)** をベースに、AIの感情状態を数値化して管理しています。
- **Valence (快/不快)**: ポジティブな会話で上昇、ネガティブな会話で下降。
- **Arousal (覚醒度)**: 驚きや興奮で上昇、落ち着いた会話で下降。
- **Dominance (支配性)**: 主体的な会話で上昇、受動的な会話で下降。
これら3つの数値を組み合わせ、「喜び (Happy)」「怒り (Angry)」「平静 (Calm)」などのムードを動的に決定し、応答の口調や内容に反映させます。

#### 🤝 理解・メンターシステム (Understanding & Mentor System)
**LLM (Gemini) が会話内容から動的に関係性を分析・更新する**システムです。

- **Impression Summary**: ユーザーの性格、現在の悩み、興味関心などをAIが分析し、要約して記憶します。
- **Mentor Focus**: AIが現在どのようなスタンスでユーザーに接すべきか（例: "Listen" - 聞き役, "Challenge" - 挑戦を促す）を決定します。
- **Understanding Score**: 会話の深さや自己開示の度合い応じて、AIの「理解度」が蓄積されていきます（青天井）。
- **Affection Score**: ユーザーからの感謝や好意的な言葉によって上下する「好感度」スコアです (-100 〜 +100)。

ユーザーの文脈を深く理解し、長期的なメンターやパートナーとして振る舞うための仕組みです。

### 3. ベクトル検索と長期記憶 (Vector Search & Memory)
過去の膨大な会話ログから、現在の文脈に関連する情報を瞬時に検索・想起します。

- **Embeddings**: `gemini-embedding-001` を使用して全会話・文字起こしデータをベクトル化。
- **pgvector**: Supabaseの `pgvector` 拡張機能を使用し、高速な類似度検索を実現。
- **ハイブリッド検索**:
  - **Conversations**: 過去のやり取りから関連する文脈を検索。
  - **Transcripts**: 過去の音声文字起こしデータからも検索可能。
- **安全策**: API制限を考慮し、日本語入力は適切に切り詰め (Truncate) 処理を行っています。

### 4. アドバイス生成 (Advice Generation)
音声文字起こし機能に連動して、ユーザーの発言に対する有用なアドバイスをAIが自動生成します。

- **Web Search**: `Tavily API` を使用して最新のWeb情報を検索。
- **Vector Search**: 過去の記憶から関連情報を取得。
- **Synthesis**: これらを統合し、Geminiが最適なアドバイスを作成してDiscordに返信します。

## 📂 プロジェクト構造

```
aimolt/
├── src/
│   ├── core/                  # Core Services (Gemini, Supabase, Prompt)
│   ├── discord/               # Discord Client & Event Handlers
│   ├── interaction/           # Interaction Logic (Like, Transcribe, Memo)
│   ├── personality/           # Personality Engine (Analysis, VAD, Relationship)
│   └── scripts/               # Maintenance Scripts (Backfill etc.)
├── Dockerfile                 # Multi-stage build configuration
├── nest-cli.json              # NestJS config
└── README.md
```

## 🛠️ セットアップ & 開発

### 必須環境
- Node.js v22+
- Docker
- PostgreSQL (Supabase with `pgvector` enabled)

### 環境変数 (.env)
```env
DISCORD_TOKEN=...
GEMINI_API_KEY=...
GEMINI_AI_MODEL="gemini-3-flash-preview"
GEMINI_AI_MODEL_EMBEDDING="gemini-embedding-001"
SUPABASE_URL=...
SUPABASE_KEY=...
TAVILY_API_KEY=...
```

### データベース (Supabase)
本プロジェクトは **Supabase (PostgreSQL)** を使用しています。
`relationships` テーブルには以下のカラムが必要です（マイグレーション済み）:
- `impression_summary` (text)
- `mentor_focus` (text)
- `understanding_score` (int)
- `affection_score` (int)
```

### ローカル起動
```bash
npm install
npm run start:dev
```

## ☁️ デプロイ (Koyeb)
本リポジトリは **Koyeb** へのデプロイに最適化されています。
GitHub連携後、自動的に `Dockerfile` が検出され、ビルド・デプロイが行われます。

## 🐳 Docker (ローカル実行)
```bash
docker build -t aimolt .
docker run --env-file .env aimolt
```

## 📄 ライセンス
ISC License