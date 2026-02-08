# AImolt Discord 

AImoltは、**Gemini** と **Supabase (PostgreSQL)** を活用した多機能Discordボットです。
**NestJS** で構築されており、**Koyeb** (またはDocker対応プラットフォーム) 上で常駐プロセスとして動作し、WebSocket (Gateway) によるリアルタイム応答を実現します。

## 🚀 主な機能

- **テキスト応答**: 👍リアクションでAIが応答 (Gemini 3 Flash Preview)
- **音声文字起こし**: 🎤リアクションで音声ファイルを文字起こし (Gemini)
- **人格・記憶システム**:
  - **Conversations**: 会話ログ、感情分析結果、ユーザーの記憶を1つのテーブルで統合管理
  - **Relationships**: ユーザーごとの現在の好感度・信頼度・関係性ステージを保持
  - **Emotions**: ユーザーごとの現在の感情状態 (VADモデル) を保持
- **Docker対応**: マルチステージビルドによる軽量コンテナ運用

## 📂 プロジェクト構造

```
aimolt/
├── src/                   # NestJS ソースコード
│   ├── discord/           # Discord.js Gateway & Events
│   ├── ai/                # Gemini Service
│   └── ...
├── Dockerfile             # マルチステージビルド用設定
├── nest-cli.json          # NestJS 設定
└── README.md
```

## 🛠️ セットアップ & 開発

### 必須環境
- Node.js v22+
- Docker (コンテナ動作確認用)
- PostgreSQL (Supabase)

### ローカルでの開発
1.  **環境変数の設定**:
    `.env` ファイルを作成してください。
    ```env
    DISCORD_TOKEN=...
    GEMINI_API_KEY=...
    GEMINI_AI_MODEL="gemini-3-flash-preview"
    SUPABASE_URL=...
    SUPABASE_KEY=...
    ```

2.  **インストールと起動**:
    ```bash
    npm install
    npm run start:dev
    ```

## ☁️ デプロイ (Koyeb)

本リポジトリは **Koyeb** へのデプロイに最適化されています。

1.  **GitHubへプッシュ**: このリポジトリをPushします。
2.  [Koyebのダッシュボード](https://app.koyeb.com) で新しいAppを作成します。
3.  このリポジトリを選択します。
4.  環境変数 (`DISCORD_TOKEN`, `GEMINI_API_KEY`, `GEMINI_AI_MODEL` 等) を設定します。
5.  **Deploy** をクリックします。
    - `Dockerfile` が自動的に検出され、ビルド・デプロイが行われます。
    - アプリケーションが `node dist/main` で起動します。

## 🐳 Docker (ローカル実行)

```bash
# ビルド
docker build -t aimolt .

# 実行
docker run --env-file .env aimolt
```

## 📄 ライセンス
ISC License