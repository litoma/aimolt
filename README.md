# AImolt Discord Bot

AImoltは、Gemini 2.5 FlashとSupabaseを活用した多機能Discordボットです。テキストメッセージへの応答、音声メッセージの文字起こし、コンテンツの解説など、多彩な機能を提供します。

- **テキスト応答**: 👍リアクションに、会話履歴を考慮したAIが応答します。
- **音声文字起こし**: 🎤リアクションを付けるだけで、`.ogg`形式の音声メッセージを文字に起こします。
- **コンテンツ解説**: ❓リアクションを付けると、メッセージの内容をAIが分かりやすく解説します。
- **個人プロファイル連携**: 👍リアクション時に、ユーザーの個人特性に基づいた個人化された応答を提供します。

## 🚀 主な機能

- **楽しい対話**: ウィットに富んだ20代女性「aimolt」として、親しみやすい日本語で応答します。
- **音声のテキスト化**: `.ogg`形式の音声ファイルを高精度に文字起こしします。
- **分かりやすい解説**: 難しい文章や専門用語も、初心者向けに丁寧に解説します。
- **文脈理解**: Supabase/PostgreSQLに会話履歴を保存し、文脈に沿った応答を実現します。
- **プロンプト一元管理**: すべてのAIプロンプトを`app/prompt/`ディレクトリで一元管理し、保守性を向上。
- **適応型個人プロファイル**: メッセージ内容に応じて関連する個人特性を自動選択し、よりパーソナライズされた応答を提供。
- **安定稼働**: 本番環境ではPM2やDockerを利用して安定したプロセス管理が可能です。

## 🏗️ アーキテクチャ

Dockerコンテナ内でNode.jsアプリケーションとPostgreSQLデータベースが連携して動作します。

```
┌──────────────────────────────────────────┐
│              Docker Network              │
│  ┌─────────────────┐ ┌────────────────┐  │
│  │   Discord Bot   │ │  PostgreSQL    │  │
│  │   (Node.js 22)  │ │  (postgres:17) │  │
│  │   + PM2         │ │                │  │
│  │   + Gemini AI   │ │                │  │
│  │   + Profile     │ │                │  │
│  └─────────────────┘ └────────────────┘  │
└──────────────────────────────────────────┘
```

## ✅ 必須環境

- **Node.js**: v22.x 以上
- **npm**: v10.x 以上
- **Docker** & **Docker Compose**: v2.0 以上
- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) で取得
- **Gemini API Key**: [Google AI Studio](https://makersuite.google.com/) で取得
- **Supabase Project**: [Supabase](https://supabase.com/) でプロジェクトを作成
- **GitHub Personal Access Token** (プロファイル連携用・オプション): [GitHub Settings](https://github.com/settings/tokens) で取得

## 🛠️ セットアップ

ローカル環境またはDocker環境を選択してセットアップできます。

### 🐳 Dockerでのセットアップ (推奨)

1.  **リポジトリをクローン**:
    ```bash
    git clone https://github.com/litoma/aimolt.git
    cd aimolt
    ```

2.  **環境変数を設定**:
    - `app/.env`ファイルを作成し、ご自身のAPIキーやトークンを設定します。

3.  **コンテナをビルドして起動**:
    ```bash
    docker compose up --build -d
    ```
    これでBotが起動します。

4.  **動作確認**:
    ```bash
    # ログを確認
    docker compose logs -f discord-bot
    
    # データベース接続確認
    docker compose exec postgres psql -U postgres -d aimolt
    ```

### 💻 ローカル環境でのセットアップ

1.  **リポジトリをクローンし、ディレクトリを移動**:
    ```bash
    git clone https://github.com/litoma/aimolt.git
    cd aimolt/app
    ```

2.  **依存関係をインストール**:
    ```bash
    npm install
    ```

3.  **環境変数を設定**:
    - `app/.env`ファイルを作成し、必要なキーを記述します。
    - 詳細は「⚙️ 設定」のセクションを参照してください。

4.  **一時ディレクトリを作成**:
    ```bash
    mkdir -p temp profile
    chmod 755 temp profile
    ```

5.  **データベースを起動**:
    - Dockerを使用してローカルにPostgreSQLをセットアップします。
      ```bash
      cd ../db
      docker compose up -d
      ```
    - `init.sql`を使ってテーブルを初期化します。
      ```bash
      psql -h localhost -U postgres -d aimolt -f db/init.sql
      ```

6.  **Botを起動**:
    - PM2を利用する場合 (本番推奨):
      ```bash
      cd ../app
      npm run pm2:start
      ```
    - 直接Node.jsで実行する場合:
      ```bash
      npm start
      ```

## ⚙️ 設定

### 環境変数 (`app/.env`)

Botの動作には以下の環境変数が必要です。

| 変数名 | 説明 | 例 | 必須 |
| :--- | :--- | :--- | :--- |
| `DISCORD_TOKEN` | Discordボットのトークン | `MTxxxxx.xxxxx.xxxxx` | ✅ |
| `DISCORD_APPLICATION_ID` | DiscordアプリケーションのID | `1234567890123456789` | ✅ |
| `DISCORD_GUILD_ID` | Botを導入するサーバー(Guild)のID | `1234567890123456789` | ✅ |
| `GEMINI_API_KEY` | Google Gemini AIのAPIキー | `AIxxxxxxxxxxxxx` | ✅ |
| `SUPABASE_URL` | SupabaseプロジェクトのURL | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_KEY` | SupabaseのAnonキー | `eyxxxxxx` | ✅ |
| `POSTGRES_HOST` | PostgreSQLホスト名 | `localhost` (ローカル) / `postgres` (Docker) | ✅ |
| `POSTGRES_PORT` | PostgreSQLポート | `5432` | ✅ |
| `POSTGRES_USER` | PostgreSQLユーザー名 | `postgres` | ✅ |
| `POSTGRES_PASSWORD` | PostgreSQLパスワード | `aimolt` | ✅ |
| `POSTGRES_DB` | PostgreSQLデータベース名 | `aimolt` | ✅ |
| `CONVERSATION_LIMIT` | 参照する会話履歴の最大件数 | `1000` | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token (プロファイル連携用) | `ghp_xxxxxxxxxxxxxxxx` | ❌ |

### 🔧 プロファイル連携機能 (オプション)

#### セットアップ手順

1. **GitHub Personal Access Token の作成**
   - GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
   - 権限: `repo` (プライベートリポジトリアクセス用)
   - 生成されたトークンを `.env` ファイルの `GITHUB_TOKEN` に設定

2. **プロファイルディレクトリの作成**
   ```bash
   mkdir -p app/profile
   ```

3. **Bot の再起動**
   ```bash
   # Dockerの場合
   docker compose restart discord-bot
   
   # PM2の場合
   npm run pm2:restart
   ```

#### 機能概要

- **適応型プロファイル連携**: メッセージ内容に応じて関連する個人特性を自動選択
- **12時間キャッシュ**: GitHub API呼び出しを最小化
- **フォールバック機能**: プロファイル取得失敗時も通常通り動作
- **👍リアクション限定**: like.js実行時のみプロファイル機能を使用

#### 管理コマンド

以下のコマンドでプロファイル機能を管理できます：

```
!profile status   # プロファイル状態を確認
!profile refresh  # プロファイルを強制更新
```

#### 動作確認

1. プロファイル機能有効時のログ:
   ```
   📡 Fetching personal profile from GitHub...
   ✅ Personal profile fetched successfully
   💾 Personal profile cached locally (12h cache)
   📋 Personal profile applied to like reaction (adaptive mode)
   ```

2. プロファイル機能無効時（GITHUB_TOKEN未設定）:
   ```
   📋 Profile sync disabled (no GitHub token)
   ```

プロファイル機能はオプションなので、トークンが設定されていない場合でも通常通り動作します。

### AIプロンプトの設定

**新しいプロンプト管理システム**を採用し、すべてのプロンプトを`app/prompt/`ディレクトリで一元管理しています。

#### プロンプトファイル一覧

| ファイル名 | 対応JSファイル | 用途 | 説明 |
| :--- | :--- | :--- | :--- |
| `system.txt` | `index.js` | システム基本指示 | Botの基本的な性格・応答スタイルを定義 |
| `like.txt` | `like.js` | 👍リアクション応答 | フレンドリーでカジュアルな応答スタイル |
| `explain.txt` | `explain.js` | ❓リアクション解説 | 丁寧で分かりやすい解説スタイル |
| `explain_fallback.txt` | `explain.js` | 解説フォールバック | `explain.txt`が読み込めない場合の代替 |
| `transcribe.txt` | `transcribe.js` | 音声文字起こし | フィラー語除去などの指示 |

#### プロンプトのカスタマイズ

1. **プロンプトファイルを編集**:
   ```bash
   # 基本的な性格を変更
   nano app/prompt/system.txt
   
   # 👍リアクションの応答スタイルを変更
   nano app/prompt/like.txt
   ```

2. **Botを再起動**:
   ```bash
   # Dockerの場合
   docker compose restart discord-bot
   
   # PM2の場合
   npm run pm2:restart
   ```

3. **新しいプロンプトファイルを追加**:
   ```bash
   # カスタムプロンプトを作成
   echo "新しい機能のプロンプト" > app/prompt/custom_feature.txt
   ```

   ```javascript
   // コード内で使用
   const { prompts } = require('./prompt');
   const customPrompt = await prompts.getCustomPrompt('custom_feature');
   ```

## 使い方

1.  **テキスト応答**:
    - メッセージに👍リアクションを付けます。
    - プロファイル連携が有効な場合、メッセージ内容に応じて個人化された応答を提供します。

2.  **音声文字起こし**:
    - `.ogg`形式の音声メッセージを投稿し、それに🎤リアクションを付けます。
    - Botが自動で文字起こし結果を投稿します。

3.  **コンテンツ解説**:
    - 解説してほしいメッセージに❓リアクションを付けます。
    - Botが解説をEmbed形式で投稿します。

4.  **プロファイル管理**:
    - `!profile status` でプロファイル状態を確認
    - `!profile refresh` でプロファイルを強制更新

## 🗂️ プロジェクト構造

```
aimolt/
├── app/                         # Node.jsアプリケーション
│   ├── src/                     # ソースコード
│   │   ├── index.js             # Botのメインロジック
│   │   ├── like.js              # 👍リアクション処理
│   │   ├── transcribe.js        # 🎤リアクション処理
│   │   ├── explain.js           # ❓リアクション処理
│   │   ├── prompt.js            # プロンプト管理システム
│   │   └── profile-sync.js      # プロファイル同期システム
│   ├── prompt/                  # AIプロンプト（一元管理）
│   │   ├── system.txt           # 基本システム指示
│   │   ├── like.txt             # 👍リアクション用
│   │   ├── explain.txt          # ❓リアクション用
│   │   ├── explain_fallback.txt # 解説フォールバック
│   │   └── transcribe.txt       # 音声文字起こし用
│   ├── temp/                    # 音声ファイルの一時保存場所
│   ├── profile/                 # プロファイルキャッシュ保存場所
│   ├── .npmrc                   # npm設定
│   ├── Dockerfile               # アプリケーション用Dockerfile
│   ├── ecosystem.config.js      # PM2設定ファイル
│   └── package.json
├── db/                          # データベース関連
│   ├── init.sql                 # テーブル初期化スキーマ
│   └── data/                    # (ローカル)DBデータ
├── compose.yaml                 # Docker Compose設定ファイル
├── .gitignore
└── README.md                    # このファイル
```

## 📦 利用可能なスクリプト

`app/package.json`で定義されている便利なスクリプト:

```bash
# 基本操作
npm start                # Botを直接起動
npm run dev              # デバッグモードで起動

# PM2を使った本番運用
npm run pm2:start        # PM2でBotを起動
npm run pm2:stop         # PM2でBotを停止
npm run pm2:restart      # PM2でBotを再起動
npm run pm2:logs         # PM2のログを表示
npm run pm2:delete       # PM2からBotプロセスを削除

# Docker操作
npm run docker:build     # Dockerイメージをビルド
npm run docker:up        # Docker Composeで起動
npm run docker:down      # Docker Composeで停止
npm run docker:logs      # Discord Botコンテナのログを表示
```

## 💾 データベース

会話履歴を保存するために、SupabaseとローカルPostgreSQLを使用します。

```sql
-- conversationsテーブル: 会話履歴を保存
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- パフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations (user_id, created_at DESC);
```

## 🩺 トラブルシューティング

- **Botが起動しない**:
  - `docker compose logs discord-bot` (Docker) または `npm run pm2:logs` (ローカル) でログを確認します。
  - `app/.env`ファイルのトークンやAPIキーが正しいか確認してください。
- **データベースに接続できない**:
  - `POSTGRES_HOST`が環境に合わせて正しく設定されているか確認します (`localhost` or `postgres`)。
- **リアクションに反応しない**:
  - Botが必要な権限 (`Guilds`, `GuildMessages`, `GuildMessageReactions`, `MessageContent`) を持っているか、Discord Developer Portalで確認してください。
- **音声の文字起こしに失敗する**:
  - `app/temp`ディレクトリが存在し、書き込み権限があるか確認してください。
- **プロンプト読み込みエラー**:
  - `app/prompt/`ディレクトリ内のプロンプトファイルが存在し、読み取り権限があるか確認してください。
  - ログに「Prompt system initialized successfully」が表示されるか確認してください。
- **プロファイル機能が動作しない**:
  - `GITHUB_TOKEN`が正しく設定されているか確認してください。
  - `app/profile`ディレクトリが存在し、書き込み権限があるか確認してください。
  - `!profile status`コマンドで状態を確認してください。

## 🔄 開発とメンテナンス

### コードの更新とリビルド

`app`ディレクトリ内のソースコードを修正した場合、以下の手順で`discord-bot`コンテナのみを効率的にリビルド・再起動できます。

1.  **Botコンテナを停止**:
    ```bash
    docker compose stop discord-bot
    ```

2.  **Botコンテナをリビルドして起動**:
    ```bash
    docker compose up --build -d discord-bot
    ```
    `discord-bot`サービスのみを対象とすることで、データベースコンテナに影響を与えずに済みます。

3.  **ログを確認**:
    ```bash
    docker compose logs -f discord-bot
    # または
    npm run docker:logs
    ```

4.  **Botコンテナの再起動**:
    ```bash
    docker compose restart discord-bot
    ```

5.  **Botコンテナへのログイン**:
    ```bash
    docker compose exec discord-bot sh
    ```

6.  **DB接続**:
    ```bash
    docker compose exec postgres psql -U postgres -d aimolt
    ```

### プロンプトの管理

新しいプロンプト管理システムにより、プロンプトの編集・追加が簡単になりました：

**プロンプトの編集:**
```bash
# 基本システム指示を変更
nano app/prompt/system.txt

# 👍リアクションの応答を変更
nano app/prompt/like.txt

# 再起動（変更を反映）
docker compose restart discord-bot
```

**新しいプロンプトの追加:**
```bash
# 新しいプロンプトファイルを作成
echo "新しい機能のプロンプト" > app/prompt/new_feature.txt
```

```javascript
// コード内で使用
const { prompts } = require('./prompt');
const newPrompt = await prompts.getCustomPrompt('new_feature');
```

**プロンプトキャッシュの管理:**
```javascript
// 特定のプロンプトキャッシュをクリア
const { promptManager } = require('./prompt');
promptManager.clearCache('system');

// 全キャッシュをクリア
promptManager.clearCache();
```

## 🚀 今後の改善案

- `/history`コマンドで会話履歴を表示する機能
- `/clear`コマンドで会話履歴を削除する機能
- 📝リアクションで長文を要約する機能
- Gemini APIのレート制限に対するリトライ処理
- Prometheusなどによる詳細なモニタリング
- プロンプトのホットリロード機能（再起動なしでプロンプト変更を反映）
- プロファイル機能の他リアクション（explain.js等）への拡張

## 📄 ライセンス

このプロジェクトはISCライセンスです。詳細は`app/package.json`を参照してください。