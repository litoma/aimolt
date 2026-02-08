# AImolt Discord Bot (NestJS + Docker)

AImoltは、**Gemini 3 Flash Preview** と **Supabase (PostgreSQL)** を活用した多機能Discordボットです。
**NestJS** で構築されており、**Koyeb** (またはDocker対応プラットフォーム) 上で常駐プロセスとして動作し、WebSocket (Gateway) によるリアルタイム応答を実現します。

## 🚀 主な機能

- **テキスト応答**: 👍リアクションでAIが応答 (Gemini 3 Flash Preview)
- **音声文字起こし**: 🎤リアクションで音声ファイルを文字起こし (Gemini)
- **人格システム (復元完了)**:
  - **Conversation Analysis**: メッセージの感情・トピック・重要度を分析
  - **User Memory**: ユーザーの好みや重要な事実を記憶・蓄積
  - **Relationship History**: 好感度・信頼度の変化を追跡し、関係性を深化
- **Docker対応**: マルチステージビルドにより軽量化されたコンテナで動作

## 📂 プロジェクト構造

```
aimolt/
├── src/                   # NestJS ソースコード
│   ├── discord/           # Discord.js Gateway & Events
│   ├── ai/                # Gemini Service
│   └── ...
├── Dockerfile             # マルチステージビルド用設定
├── ecosystem.config.js    # PM2 設定
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