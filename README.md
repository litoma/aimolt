# AImolt Discord Bot

AImoltは、Gemini 2.5 FlashとSupabaseを活用した多機能Discordボットです。テキストメッセージへの応答、音声メッセージの文字起こし、コンテンツの解説など、多彩な機能を提供します。

- **テキスト応答**: 👍リアクションに、会話履歴を考慮したAIが応答します。
- **音声文字起こし**: 🎤リアクションを付けるだけで、`.ogg`形式の音声メッセージを文字に起こします。
- **コンテンツ解説**: ❓リアクションを付けると、メッセージの内容をAIが分かりやすく解説します。
- **メモ機能**: 📝リアクションを付けると、メッセージ内容をObsidianのDailyメモに自動で追加します。
- **個人プロファイル連携**: 👍リアクション時に、ユーザーの個人特性に基づいた個人化された応答を提供します。
- **🧠 動的人格システム**: 会話履歴から学習し、個人化された応答を提供する革新的な人格システムを搭載。

## 🚀 主な機能

- **楽しい対話**: ウィットに富んだ20代女性「aimolt」として、親しみやすい日本語で応答します。
- **音声のテキスト化**: `.ogg`形式の音声ファイルを高精度に文字起こしします。
- **分かりやすい解説**: 難しい文章や専門用語も、初心者向けに丁寧に解説します。
- **Obsidian統合**: メッセージ内容をObsidianのDailyメモに自動で追加し、知識管理を支援します。
- **文脈理解**: Supabase/PostgreSQLに会話履歴を保存し、文脈に沿った応答を実現します。
- **プロンプト一元管理**: すべてのAIプロンプトを`app/prompt/`ディレクトリで一元管理し、保守性を向上。
- **適応型個人プロファイル**: メッセージ内容に応じて関連する個人特性を自動選択し、よりパーソナライズされた応答を提供。
- **🧠 動的人格システム**: 会話履歴から学習し、感情状態・記憶・個人特性を管理する革新的なAI人格システム。
- **安定稼働**: 本番環境ではPM2やDockerを利用して安定したプロセス管理が可能です。

## 🏗️ アーキテクチャ

Dockerコンテナ内でNode.jsアプリケーションとPostgreSQLデータベースが連携して動作します。

```
┌───────────────────────────────────────────────┐
│                 Docker Network                │
│  ┌───────────────────┐ ┌───────────────────┐  │
│  │  Discord Bot      │ │  PostgreSQL       │  │
│  │  (Node.js 22)     │ │  (postgres:17)    │  │
│  │  + PM2            │ │                   │  │
│  │  + Gemini AI      │ │  Conversations    │  │
│  │  + Profile        │ │  + Personality    │  │
│  │  + Personality    │ │    - Emotions     │  │
│  │    System         │ │    - Memories     │  │
│  │                   │ │    - Analysis     │  │
│  └───────────────────┘ └───────────────────┘  │
└───────────────────────────────────────────────┘
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
    - 人格システムのテーブルが作成されているか確認します。
      ```bash
      docker exec -it aimolt-postgres psql -U postgres -d aimolt -c "\dt"
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
| `OBSIDIAN_URL` | Obsidian REST API URL | `http://localhost:27123` | ❌ |
| `OBSIDIAN_API` | Obsidian REST API キー | `your_api_key_here` | ❌ |

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

### 🧠 人格システム管理機能

#### 管理コマンド

動的人格システムの状態確認・管理が可能です：

```
!personality status [@ユーザー]  # 人格状態を確認
!personality stats              # システム統計を表示
!personality debug [@ユーザー]   # デバッグ情報を表示
!personality help               # ヘルプメッセージを表示
```

#### 機能概要

- **個人状態確認**: 感情状態（元気度・親密度・興味度・ムード）、記憶数、主な特徴を表示
- **システム統計**: 登録ユーザー数、総記憶数、分析回数、システム稼働状況を表示
- **デバッグ情報**: キャッシュ状況、最終更新時刻など技術的詳細を表示
- **ユーザー指定**: 自分の状態確認に加え、メンションで他ユーザーの状態も確認可能

#### 動作確認

1. 人格状態確認の例:
   ```
   🧠 人格システム状態
   💭 感情状態: 元気度85 | 親密度60 | 興味度75 | ムード: excited
   📊 統計: 会話数127回 | 記憶数5件
   🏷️ 主な特徴: プログラミング好き、好奇心旺盛...
   ```

2. システム統計の例:
   ```
   📊 人格システム統計
   👥 登録ユーザー: 15人 | 🧠 総記憶数: 342件
   📈 分析回数: 1,205回 | ⚙️ システム状態: ✅ 有効
   ```

人格システムは会話を通じて自動的に学習するため、特別な設定は不要です。

### 🔄 Supabase同期システム

#### 自動同期機能

PostgreSQL LISTEN/NOTIFY機能を使用した疑似レプリケーション：

```
PostgreSQL → リアルタイム同期 → Supabase
```

#### 管理コマンド

同期システムの状態確認・管理が可能です：

```
!sync status             # 同期システム状態を確認
!sync manual [table]     # 手動同期を実行
!sync stats              # 詳細統計をログ出力
!sync help               # ヘルプメッセージを表示
```

#### 同期対象テーブル

- **conversations**: 会話履歴
- **emotion_states**: 感情状態
- **user_memories**: 記憶システム
- **conversation_analysis**: 会話分析結果

#### 技術仕様

- **同期方式**: PostgreSQL INSERT/UPDATE/DELETE → 即座にSupabase反映
- **エラー処理**: 3回リトライ + 指数バックオフ（1秒→2秒→4秒）
- **監視機能**: 同期回数・エラー率・成功率・最終同期時刻
- **パフォーマンス**: 平均同期時間 100-500ms

#### 動作確認

1. 同期状態確認の例:
   ```
   🔄 Supabase同期システム状態
   ⚙️ システム状態: ✅ 稼働中
   📊 同期回数: 1,205回 | ❌ エラー回数: 3回
   📈 成功率: 99.8% | 📅 最終同期: 1分前
   ```

2. 手動同期実行例:
   ```
   !sync manual conversations  # 特定テーブルのみ
   !sync manual                # 全テーブル
   ```

同期システムはBot起動時に自動開始され、特別な設定は不要です。

### 📝 メモ機能 (Obsidian統合)

#### セットアップ手順

1. **Obsidian REST API プラグインのインストール**
   - Obsidian内で「REST API」プラグインを検索・インストール
   - プラグインを有効化し、APIキーを生成

2. **環境変数の設定**
   - `OBSIDIAN_URL`: Obsidian REST APIのURL（例: `http://localhost:27123`）
   - `OBSIDIAN_API`: 生成したAPIキー

3. **機能の使用**
   - メッセージに📝リアクションを付けると、内容がObsidianのDailyメモに自動で追加されます
   - メッセージは投稿者情報、時刻、リンクと共に整形されて保存されます

#### 機能概要

- **自動整形**: AIがメッセージ内容を読みやすい形に整形
- **メタデータ付与**: 投稿者、時刻、Discord メッセージへのリンクを自動で追加
- **Embed対応**: Discord の Embed 内容も抽出・保存
- **Daily メモ統合**: Obsidian の Daily メモ機能と連携

メモ機能もオプションなので、環境変数が設定されていない場合でも通常通り動作します。

### AIプロンプトの設定

**新しいプロンプト管理システム**を採用し、すべてのプロンプトを`app/prompt/`ディレクトリで一元管理しています。

#### プロンプトファイル一覧

| ファイル名 | 対応JSファイル | 用途 | 説明 |
| :--- | :--- | :--- | :--- |
| `system.txt` | `index.js` | システム基本指示 | Botの基本的な性格・応答スタイルを定義 |
| `like.txt` | `like.js` | 👍リアクション応答 | フレンドリーでカジュアルな応答スタイル |
| `explain.txt` | `explain.js` | ❓リアクション解説 | 丁寧で分かりやすい解説スタイル |
| `transcribe.txt` | `transcribe.js` | 🎤音声文字起こし | フィラー語除去などの指示 |
| `memo.txt` | `memo.js` | 📝メモ機能 | Obsidian メモ整形用の指示 |

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

4.  **メモ機能**:
    - メッセージに📝リアクションを付けます。
    - メッセージ内容がObsidianのDailyメモに自動で追加されます。

5.  **プロファイル管理**:
    - `!profile status` でプロファイル状態を確認
    - `!profile refresh` でプロファイルを強制更新

6.  **人格システム管理**:
    - `!personality status [@ユーザー]` で人格状態を確認（感情・記憶・特徴）
    - `!personality stats` でシステム全体の統計を表示
    - `!personality debug [@ユーザー]` でデバッグ情報を表示

7.  **Supabase同期管理**:
    - `!sync status` で同期システムの状態を確認
    - `!sync manual [table]` で手動同期を実行
    - `!sync stats` で詳細な統計情報を表示

## 🗂️ プロジェクト構造

```
aimolt/
├── app/                             # Node.jsアプリケーション
│   ├── src/                         # ソースコード
│   │   ├── index.js                 # Botのメインロジック
│   │   ├── like.js                  # 👍リアクション処理
│   │   ├── transcribe.js            # 🎤リアクション処理
│   │   ├── explain.js               # ❓リアクション処理
│   │   ├── memo.js                  # 📝メモ機能（Obsidian統合）
│   │   ├── prompt.js                # プロンプト管理システム
│   │   ├── profile-sync.js          # プロファイル同期システム
│   │   ├── supabase-sync.js         # 🔄 Supabase疑似レプリケーション
│   │   ├── utils/                   # ユーティリティ関数
│   │   │   └── retry.js             # Gemini API リトライ機能
│   │   └── personality/             # 🧠 動的人格システム
│   │       ├── manager.js           # 人格システム統合管理
│   │       ├── emotion.js           # 感情状態管理
│   │       ├── memory.js            # 記憶蓄積システム
│   │       ├── analyzer.js          # 会話分析エンジン
│   │       └── generator.js         # 動的プロンプト生成
│   ├── prompt/                      # AIプロンプト（一元管理）
│   │   ├── system.txt               # 基本システム指示
│   │   ├── like.txt                 # 👍リアクション用
│   │   ├── transcribe.txt           # 🎤音声文字起こし用
│   │   ├── explain.txt              # ❓リアクション用
│   │   └── memo.txt                 # 📝メモ機能用
│   ├── temp/                        # 音声ファイルの一時保存場所
│   ├── profile/                     # プロファイルキャッシュ保存場所
│   ├── initialize-personality.js    # 🧠 過去履歴分析スクリプト
│   ├── .npmrc                       # npm設定
│   ├── Dockerfile                   # アプリケーション用Dockerfile
│   ├── ecosystem.config.js          # PM2設定ファイル
│   ├── PERSONALITY_SETUP.md         # 人格システムセットアップガイド
│   └── package.json
├── db/                              # データベース関連
│   ├── init.sql                     # テーブル初期化スキーマ（人格システム含む）
│   ├── personality_schema.sql       # 人格システム専用スキーマ
│   ├── supabase_sync_triggers.sql   # Supabase同期用トリガー・ファンクション
│   └── data/                        # (ローカル)DBデータ
├── compose.yaml                     # Docker Compose設定ファイル
├── .gitignore
└── README.md                        # このファイル
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

### **基本テーブル**
```sql
-- conversationsテーブル: 会話履歴を保存
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **🧠 動的人格システム用テーブル**
```sql
-- emotion_states: 感情状態管理
CREATE TABLE IF NOT EXISTS emotion_states (
    user_id VARCHAR(20) PRIMARY KEY,
    energy_level INTEGER DEFAULT 50,      -- 元気度 (0-100)
    intimacy_level INTEGER DEFAULT 0,     -- 親密度 (0-100)
    interest_level INTEGER DEFAULT 50,    -- 興味度 (0-100)
    mood_type VARCHAR(20) DEFAULT 'neutral',
    conversation_count INTEGER DEFAULT 0,
    last_interaction TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- user_memories: 記憶蓄積システム
CREATE TABLE IF NOT EXISTS user_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    memory_type VARCHAR(30) NOT NULL,     -- 'trait', 'preference', 'important_event', 'fact'
    content TEXT NOT NULL,
    keywords TEXT[],
    importance_score INTEGER DEFAULT 5,   -- 重要度 (1-10)
    emotional_weight INTEGER DEFAULT 0,   -- 感情的重み (-10 to 10)
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL
);

-- conversation_analysis: 会話分析結果
CREATE TABLE IF NOT EXISTS conversation_analysis (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    message_id VARCHAR(50),
    user_message TEXT NOT NULL,
    sentiment VARCHAR(20) DEFAULT 'neutral', -- positive/negative/neutral
    emotion_detected VARCHAR(30),            -- joy/anger/sadness/excitement等
    topic_category VARCHAR(50),              -- 話題カテゴリ
    keywords TEXT[],
    importance_score INTEGER DEFAULT 1,      -- 重要度 (1-10)
    confidence_score DECIMAL(3,2) DEFAULT 0.50,
    analyzed_at TIMESTAMP DEFAULT NOW()
);
```

### **パフォーマンス向上のためのインデックス**
```sql
-- 基本インデックス
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations (user_id, created_at DESC);

-- 人格システム用インデックス
CREATE INDEX IF NOT EXISTS idx_emotion_states_user_id ON emotion_states(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_keywords ON user_memories USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_user_id ON conversation_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_keywords ON conversation_analysis USING GIN(keywords);
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

## 🧠 動的人格システム

AImoltの最も革新的な機能の一つが、会話履歴から学習する動的人格システムです。

### **主な特徴**

#### **1. 感情状態管理**
- **元気度**: 会話の頻度とポジティブ度から算出
- **親密度**: 長期的な関係性を数値化
- **興味度**: 話題への関心レベルを管理
- **ムード**: excited, happy, curious, tired, melancholy, neutral

#### **2. 記憶蓄積システム**
- **重要会話の自動抽出**: 重要度スコアに基づく保存
- **記憶タイプ分類**: trait（特徴）、preference（好み）、important_event（重要な出来事）、fact（事実）
- **キーワード検索**: 関連する記憶を効率的に検索
- **感情的重み**: 記憶の感情的な影響度を数値化

#### **3. 会話分析エンジン**
- **感情分析**: joy, sadness, excitement, curiosity等の感情を検出
- **センチメント分析**: positive/negative/neutralの判定
- **話題分類**: プログラミング、ゲーム、日常生活等のカテゴリ分析
- **重要度判定**: 1-10スケールでの重要度自動算出

#### **4. 動的プロンプト生成**
- **個人化**: ユーザーの特徴に基づくプロンプト調整
- **状況適応**: 時間帯、感情状態、会話文脈を考慮
- **記憶統合**: 関連する過去の記憶を応答に反映
- **フォールバック**: 人格システムが失敗しても通常動作を継続

### **初期化と運用**

#### **過去履歴の分析**
新規導入時に既存の会話履歴を分析し、初期人格を構築できます：

```bash
# 過去の全会話履歴を分析
POSTGRES_HOST=localhost node initialize-personality.js
```

#### **システムの監視**
人格システムの状態を確認できます：

```bash
# PostgreSQL内で状態確認
SELECT * FROM emotion_states WHERE user_id = 'YOUR_USER_ID';
SELECT COUNT(*) FROM user_memories WHERE user_id = 'YOUR_USER_ID';
SELECT COUNT(*) FROM conversation_analysis WHERE user_id = 'YOUR_USER_ID';
```

### **技術的な詳細**

- **キャッシュ管理**: 多層キャッシュでパフォーマンス最適化
- **非同期処理**: 応答速度に影響しない背景処理
- **エラーハンドリング**: 人格システムの障害時も通常機能を維持
- **データ整合性**: CHECK制約とトリガーでデータ品質を保証

詳細な設定方法は`PERSONALITY_SETUP.md`を参照してください。

## 🔄 信頼性とエラー処理

### **Gemini API リトライ機能**

AImoltは、Gemini APIの一時的な障害に対して自動的にリトライする機能を搭載しています。

#### **対応するエラー**
- **503 Service Unavailable**: サーバー過負荷
- **429 Too Many Requests**: レート制限
- **500 Internal Server Error**: サーバー内部エラー
- **502 Bad Gateway**: ゲートウェイエラー
- **504 Gateway Timeout**: タイムアウト

#### **リトライ設定**
- **最大リトライ回数**: 3回
- **指数バックオフ**: 1秒 → 2秒 → 4秒 → 8秒
- **最大待機時間**: 8-12秒（機能により異なる）

#### **ログ出力例**
```
🔄 👍 Like応答生成 実行中...
⚠️ Gemini API リトライ 1/3 - 1000ms 待機中...
⚠️ Gemini API リトライ 2/3 - 2000ms 待機中...
✅ 👍 Like応答生成 成功
```

## 🚀 今後の改善案

詳細な改善案は [GitHub Issues](https://github.com/litoma/aimolt/issues) で管理しています。

## 📄 ライセンス

このプロジェクトはISCライセンスです。詳細は`app/package.json`を参照してください。