# AImolt Discord Bot

AImoltは、Gemini 2.5 Pro/FlashとSupabaseを活用した多機能Discordボットです。テキストメッセージへの応答、音声メッセージの文字起こし、コンテンツの解説など、多彩な機能を提供します。

- **テキスト応答**: 👍リアクションに、会話履歴を考慮したAIが応答します。
- **音声文字起こし**: 🎤リアクションを付けるだけで、`.ogg`形式の音声メッセージを文字に起こします（フィラー語除去）。
- **コンテンツ解説**: ❓リアクションを付けると、メッセージの内容をAIが分かりやすく解説します。
- **メモ機能**: 📝リアクションを付けると、メッセージ内容をObsidianのDailyメモにそのまま追加します。

## 🚀 主な機能

- **楽しい対話**: ウィットに富んだ20代女性「aimolt」として、親しみやすい日本語で応答します。
- **音声のテキスト化**: `.ogg`形式の音声ファイルを高精度に文字起こしし、フィラー語を自動除去します。
- **分かりやすい解説**: 難しい文章や専門用語も、初心者向けに丁寧に解説します。
- **Obsidian統合**: メッセージ内容をObsidianのDailyメモにシンプルに追加し、知識管理を支援します。
- **文脈理解**: Supabase/PostgreSQLに会話履歴を保存し、文脈に沿った応答を実現します。
- **プロンプト一元管理**: すべてのAIプロンプトを`app/prompt/`ディレクトリで一元管理し、保守性を向上。
- **🤖 プロアクティブメッセージ**: ボット主導で自然なタイミングで会話を開始。エンハンスド会話履歴システムにより、重要な記憶・関係性を活用した高品質なメッセージを生成。自動ユーザー選出、応答要件チェック、100件拡張履歴分析により、パーソナライズされたインテリジェントな対話を実現。
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
│  │  + Simple         │ │  + Personality    │  │
│  │    Reactions      │ │    - Emotions     │  │
│  │                   │ │    - Memories     │  │
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

#### プロアクティブメッセージ機能 (追加環境変数)

| 変数名 | 説明 | デフォルト値 | 必須 |
| :--- | :--- | :--- | :--- |
| `PROACTIVE_TARGET_CHANNEL` | プロアクティブメッセージの送信先チャンネル名 | `general` | ❌ |
| `PROACTIVE_MIN_CONVERSATION_GAP` | 最後の会話から最低経過時間（時間）| `72` | ❌ |
| `PROACTIVE_DEBUG_MODE` | デバッグモード（短縮間隔でテスト可能） | `false` | ❌ |
| `PROACTIVE_CRON_PATTERN` | プロアクティブ実行のcronパターン | `0 */1 * * *` | ❌ |
| `PROACTIVE_AUTO_START` | ボット起動時の自動開始 | `true` | ❌ |

#### 新しいランダムタイミング制御システム

プロアクティブメッセージの送信タイミングは以下の式で決定されます：

```
次回送信時間 = 最後の会話時刻 + 最低経過時間(72時間) + ランダム時間(1-100時間)
```

- **最低経過時間**: 72時間（デフォルト、`PROACTIVE_MIN_CONVERSATION_GAP`で調整可能）
- **ランダム時間**: 1-100時間の範囲でランダムに決定
- **デバッグモード**: 最低経過時間10分、ランダム時間6分-2時間に短縮


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

#### 同期対象テーブル（v2.0対応）

- **conversations**: 会話履歴
- **emotion_states**: 感情状態（VADモデル対応）
- **user_memories**: 記憶システム
- **conversation_analysis**: 会話分析結果
- **user_relationships**: 関係性管理（v2.0新機能）

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

- **シンプル保存**: メッセージ内容をそのままObsidianに保存
- **メタデータ付与**: 時刻、Discord メッセージへのリンクを自動で追加
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
    - メッセージ内容がObsidianのDailyメモにそのまま追加されます（時刻とリンク付き）。

5.  **プロアクティブメッセージ管理**:
    - `!proactive status` でプロアクティブシステムの状態確認
    - `!proactive check` で手動実行チェック
    - `!proactive start/stop` でシステムの開始・停止

6.  **Supabase同期管理**:
    - `!sync status` で同期システムの状態を確認
    - `!sync manual [table]` で手動同期を実行
    - `!sync stats` で詳細な統計情報を表示

## 🗂️ プロジェクト構造

```
aimolt/
├── app/                                 # Node.jsアプリケーション
│   ├── src/                             # ソースコード
│   │   ├── index.js                     # Botのメインロジック
│   │   ├── like.js                      # 👍リアクション処理
│   │   ├── transcribe.js                # 🎤リアクション処理
│   │   ├── explain.js                   # ❓リアクション処理
│   │   ├── memo.js                      # 📝メモ機能（Obsidian統合）
│   │   ├── prompt.js                    # プロンプト管理システム
│   │   ├── profile-sync.js              # プロファイル同期システム
│   │   ├── supabase-sync.js             # 🔄 Supabase疑似レプリケーション
│   │   ├── utils/                       # ユーティリティ関数
│   │   │   └── retry.js                 # Gemini API リトライ機能
│   │   ├── personality/                 # 🧠 v2.0動的人格システム
│   │   │   ├── manager-v2.js            # v2.0統合人格マネージャー
│   │   │   ├── vad-emotion.js           # VAD感情システム（valence/arousal/dominance）
│   │   │   ├── relationship-manager.js  # 関係性管理システム
│   │   │   ├── core-personality.js      # Big Five人格特性管理
│   │   │   ├── adaptive-response.js     # 適応的応答エンジン
│   │   │   ├── memory.js                # 記憶蓄積システム
│   │   │   ├── analyzer.js              # 会話分析エンジン
│   │   │   └── generator.js             # 動的プロンプト生成
│   │   └── proactive/                   # 🤖 プロアクティブメッセージシステム
│   │       ├── scheduler.js             # cron実行スケジューラー
│   │       ├── timing-controller.js     # タイミング制御ロジック
│   │       ├── message-generator.js     # AI メッセージ生成エンジン
│   │       ├── discord-sender.js        # Discord送信システム
│   │       ├── response-handler.js      # 応答検出・記録システム
│   │       ├── database-helpers.js      # DB操作ヘルパー
│   │       └── management-commands.js   # Discord管理コマンド
│   ├── prompt/                          # AIプロンプト（一元管理）
│   │   ├── system.txt                   # 基本システム指示
│   │   ├── like.txt                     # 👍リアクション用
│   │   ├── transcribe.txt               # 🎤音声文字起こし用
│   │   ├── explain.txt                  # ❓リアクション用
│   │   └── memo.txt                     # 📝メモ機能用
│   ├── temp/                            # 音声ファイルの一時保存場所
│   ├── profile/                         # プロファイルキャッシュ保存場所
│   ├── initialize-personality-v2.js     # 🧠 v2.0過去履歴分析スクリプト
│   ├── .npmrc                           # npm設定
│   ├── Dockerfile                       # アプリケーション用Dockerfile
│   ├── ecosystem.config.js              # PM2設定ファイル
│   ├── PERSONALITY_SETUP.md             # 人格システムセットアップガイド
│   └── package.json
├── db/                                  # データベース関連
│   ├── init.sql                         # テーブル初期化スキーマ（v2.0人格システム統合済み）
│   └── data/                            # (ローカル)DBデータ
├── compose.yaml                         # Docker Compose設定ファイル
├── .gitignore
└── README.md                            # このファイル
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
-- conversationsテーブル: 会話履歴を保存（プロアクティブメッセージ対応）
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    message_type VARCHAR(30) DEFAULT 'user_initiated',  -- user_initiated/proactive/response_to_proactive
    initiator VARCHAR(10) DEFAULT 'user',               -- user/bot
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **🧠 v2.0動的人格システム用テーブル**
```sql
-- emotion_states: VADモデル対応感情状態管理
CREATE TABLE IF NOT EXISTS emotion_states (
    user_id VARCHAR(20) PRIMARY KEY,
    -- 旧システム（後方互換性）
    energy_level INTEGER DEFAULT 50,      -- 元気度 (0-100)
    intimacy_level INTEGER DEFAULT 0,     -- 親密度 (0-100)
    interest_level INTEGER DEFAULT 50,    -- 興味度 (0-100)
    mood_type VARCHAR(20) DEFAULT 'neutral',
    -- VADモデル（v2.0新機能）
    valence INTEGER DEFAULT 50,           -- 快不快 (0-100)
    arousal INTEGER DEFAULT 50,           -- 覚醒度 (0-100)
    dominance INTEGER DEFAULT 50,         -- 支配度 (0-100)
    conversation_count INTEGER DEFAULT 0,
    last_interaction TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- user_relationships: 関係性管理（v2.0新機能）
CREATE TABLE IF NOT EXISTS user_relationships (
    user_id VARCHAR(20) PRIMARY KEY,
    affection_level INTEGER DEFAULT 50,   -- 親密度 (0-100)
    trust_level INTEGER DEFAULT 50,       -- 信頼度 (0-100)
    respect_level INTEGER DEFAULT 70,     -- 敬意レベル (0-100)
    comfort_level INTEGER DEFAULT 40,     -- 快適度 (0-100)
    relationship_stage VARCHAR(20) DEFAULT 'stranger', -- stranger/acquaintance/friend/close_friend
    conversation_count INTEGER DEFAULT 0,
    meaningful_interactions INTEGER DEFAULT 0,
    preferred_formality VARCHAR(15) DEFAULT 'casual',
    communication_pace VARCHAR(15) DEFAULT 'normal',
    humor_receptivity INTEGER DEFAULT 50,
    known_interests TEXT[],
    avoided_topics TEXT[],
    positive_triggers TEXT[],
    negative_triggers TEXT[],
    first_interaction TIMESTAMP DEFAULT NOW(),
    last_interaction TIMESTAMP DEFAULT NOW(),
    last_mood_detected VARCHAR(20),
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
CREATE INDEX IF NOT EXISTS idx_conversations_message_type ON conversations (message_type);
CREATE INDEX IF NOT EXISTS idx_conversations_initiator ON conversations (initiator);

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

## 🧠 v2.0動的人格システム

AImoltの最も革新的な機能の一つが、最新の心理学研究に基づくv2.0動的人格システムです。

### **主な特徴**

#### **1. VAD感情モデル（v2.0新機能）**
2024-2025年の感情心理学研究に基づく3次元感情モデル：
- **Valence（快不快）**: ポジティブ-ネガティブ感情の軸 (0-100)
- **Arousal（覚醒度）**: 興奮-平静の軸 (0-100)
- **Dominance（支配度）**: 主導性-従属性の軸 (0-100)

#### **2. Big Five人格特性モデル**
- **Openness（開放性）**: 新しい経験への開放度
- **Conscientiousness（誠実性）**: 責任感と組織性
- **Extraversion（外向性）**: 社交性とエネルギッシュさ
- **Agreeableness（協調性）**: 協力的で信頼的な傾向
- **Neuroticism（神経症傾向）**: 感情的不安定性

#### **3. 関係性管理システム（v2.0新機能）**
- **関係段階**: stranger → acquaintance → friend → close_friend
- **信頼度**: ユーザーとの信頼関係を数値化
- **快適度**: 会話の居心地良さを管理
- **コミュニケーション最適化**: 個人の好みに合わせたやり取りスタイル

#### **4. 後方互換性**
v1システムとの互換性を維持：
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

#### **過去履歴の分析（v2.0対応）**
新規導入時に既存の会話履歴を分析し、v2.0初期人格を構築できます：

```bash
# 過去の全会話履歴をv2.0システムで分析
POSTGRES_HOST=localhost node initialize-personality-v2.js
```

#### **人格システム管理コマンド（v2.0新機能）**

```
!personality              # 現在の人格状態を表示（VAD + 関係性）
!personality help         # ヘルプメッセージを表示
!personality analyze      # 詳細分析結果を表示
```

#### **システムの監視（v2.0対応）**
v2.0人格システムの状態を確認できます：

```bash
# PostgreSQL内でv2.0状態確認
SELECT user_id, valence, arousal, dominance, energy_level, intimacy_level FROM emotion_states WHERE user_id = 'YOUR_USER_ID';
SELECT user_id, relationship_stage, trust_level, affection_level, comfort_level FROM user_relationships WHERE user_id = 'YOUR_USER_ID';
SELECT COUNT(*) FROM user_memories WHERE user_id = 'YOUR_USER_ID';
SELECT COUNT(*) FROM conversation_analysis WHERE user_id = 'YOUR_USER_ID';
SELECT COUNT(*) FROM relationship_history WHERE user_id = 'YOUR_USER_ID';
```

### **技術的な詳細**

- **キャッシュ管理**: 多層キャッシュでパフォーマンス最適化
- **非同期処理**: 応答速度に影響しない背景処理
- **エラーハンドリング**: 人格システムの障害時も通常機能を維持
- **データ整合性**: CHECK制約とトリガーでデータ品質を保証

## 🔄 v2.0アップグレード情報

### **v2.0の主な改善点**

1. **科学的根拠に基づく感情モデル**: VAD（Valence-Arousal-Dominance）モデル採用
2. **Big Five人格特性**: 心理学的に確立された5因子モデル統合
3. **関係性管理**: ユーザーとの関係性を段階的に管理
4. **適応的応答**: 個人の特性に合わせた柔軟な応答生成
5. **後方互換性**: v1システムとの互換性を維持

### **v2.0マイグレーション**

既存のv1データを保持したままv2.0にアップグレード済み：
- VAD列の追加（valence, arousal, dominance）
- 関係性管理テーブルの追加（user_relationships, relationship_history）
- Supabase同期システムの拡張
- 既存データの完全保持

## 🤖 プロアクティブメッセージシステム

AImoltの最新機能であるプロアクティブメッセージシステムは、ボット主導で自然なタイミングで会話を開始する革新的な機能です。

### **主要機能**

#### **1. ランダムタイミング制御システム**
- **基本間隔**: 最後の会話から72時間の最低経過時間
- **ランダム要素**: 1-100時間のランダム時間を追加（自然な送信間隔）
- **シンプル制御**: 複雑な条件を排除し、直感的でわかりやすいタイミング制御
- **デバッグモード**: 開発・テスト用の短縮間隔モード（10分+6分-2時間ランダム）

#### **2. エンハンスド会話履歴システム**
- **インテリジェント履歴選択**: 重要度・記憶関連性・時系列を統合した最適な会話履歴抽出
- **動的人格データ活用**: conversation_analysisとuser_memoriesテーブルを活用
- **スマート重複排除**: スコアベースの重複排除と優先度付け
- **100件拡張履歴**: 従来の20件から100件に拡張、より豊富なコンテキスト

#### **3. 自動ユーザー選出システム**
- **データベース駆動選出**: 環境変数依存を排除し、会話履歴から自動選出
- **条件フィルタリング**: 5回以上の会話実績があるユーザーを対象
- **最適化アルゴリズム**: 最終会話時刻と会話頻度を総合評価

#### **4. AI駆動メッセージ生成**
- **コンテキスト統合**: エンハンスド履歴、ユーザープロファイル、v2.0人格システムを活用
- **個人化**: ユーザーの関心や特徴に基づいた内容生成
- **自然な口調**: VAD感情モデルに基づいた適切な表現
- **固定AI設定**: gemini-2.5-pro、2000トークン、0.95温度で最適化

#### **5. 応答要件チェックシステム**
- **前回応答チェック**: 前回のプロアクティブメッセージへの応答を確認
- **応答必須制御**: 未応答時は新しいプロアクティブメッセージを停止
- **継続的エンゲージメント**: ユーザーの積極的参加を促進

#### **6. 応答追跡システム**
- **応答検出**: ユーザーからの返答を自動的に検出・分類
- **統計管理**: 応答率、反応時間、会話継続率を追跡
- **メッセージタイプ分類**: `user_initiated`、`proactive`、`response_to_proactive`

#### **7. 包括的管理システム**
Discord上でのリアルタイム管理とモニタリングが可能：

```
!proactive status          # システム状態の確認
!proactive check           # 手動実行チェック
!proactive start/stop      # システム制御
!proactive restart         # 再起動
!proactive config          # 設定状態表示
!proactive stats           # 詳細統計情報
!proactive debug           # デバッグ情報表示
```

### **技術アーキテクチャ**

#### **Phase 1: データベース基盤**
- `conversations`テーブルの拡張（`message_type`、`initiator`列追加）
- プロアクティブメッセージ専用のデータ構造

#### **Phase 2: タイミング制御システム**
- 複雑な条件ロジック（会話間隔、プロアクティブ間隔）
- cron-based スケジューラー（`node-cron`）
- 環境変数による柔軟な設定

#### **Phase 3: メッセージ生成エンジン**
- Gemini-2.5-Pro API統合
- 多層コンテキスト収集（履歴、プロファイル、人格状態）
- 後処理によるメッセージ最適化

#### **Phase 4: Discord送信システム**
- タイピング表示付き自然な送信
- リトライ機能とエラーハンドリング
- 権限確認と送信統計

### **🚀 エンハンスド会話履歴システム（詳細仕様）**

プロアクティブメッセージの品質を劇的に向上させる革新的なシステム：

#### **インテリジェント履歴選択アルゴリズム**
1. **重要な会話** (conversation_analysis基準)
   - importance_score >= 5 の重要度の高い会話
   - confidence_score >= 0.6 の信頼性のある分析結果
   - 最大6件まで選択

2. **記憶関連会話** (user_memories連携)
   - importance_score >= 4 の記憶から抽出されたキーワード
   - important_event、fact、preference タイプの記憶を優先
   - キーワードマッチによる関連会話検索

3. **最近の会話** (フレッシュネス確保)
   - 直近の基本的な会話履歴
   - タイムラインの一貫性を維持

#### **スマート重複排除システム**
- **ユニーク化**: user_message + created_at による重複検出
- **スコア最適化**: 同一会話で最高スコアのソースを優先選択
- **時系列ソート**: 最終的に古い順で整列、自然な流れを実現

#### **セクション別整形出力**
```
【重要な会話】
[3日前] (positive) ユーザー: "新しいプロジェクト開始した..." → ボット: "素晴らしいですね..."

【記憶関連会話】 
[1週間前] ユーザー: "Python好きなんだ..." → ボット: "Pythonの魅力は..."

【最近の会話】
[昨日] ユーザー: "今日は疲れた..." → ボット: "お疲れ様です..."
```

#### **システム改善効果**
エンハンスド会話履歴システムにより実現された改善：

**Before（従来システム）**:
```
"こんにちは！最近どうしてる？😊"
```

**After（エンハンスドシステム）**:
```
"Pythonプロジェクトの進捗はどう？前回話してたAPIの実装、
上手くいってる？何か困ったことがあったら聞かせて！"
```

**主な改善点**:
- 🎯 **具体性向上**: 過去の会話内容を具体的に参照
- 🔗 **関連性強化**: ユーザーの興味・関心に基づく話題選択
- 💭 **記憶活用**: 重要な出来事や好みを会話に反映
- 📈 **品質向上**: 一般的な挨拶から個人化されたメッセージへ

### **運用仕様**

#### **デフォルト設定**
- **対象ユーザー**: 会話履歴から自動選出（5回以上の会話実績が条件）
- **送信チャンネル**: `#general`
- **基本間隔**: 72時間（最後の会話からの最低経過時間）
- **ランダム時間**: 1-100時間（基本間隔に追加される）
- **実行頻度**: 1時間毎チェック（`0 */1 * * *`）
- **エンハンスド履歴**: 最大12件（重要6件+記憶関連2件+直近4件）

#### **デバッグモード**
```env
PROACTIVE_DEBUG_MODE=true
PROACTIVE_DEBUG_CONVERSATION_GAP_MIN=10    # 10分（基本間隔）
# ランダム時間: 6分-2時間（自動設定）
```

#### **カスタマイズ可能な設定**
主要な環境変数による動作制御：
- **タイミング制御**: 基本会話間隔、ランダム時間範囲、実行頻度
- **AI生成**: 固定最適化設定（gemini-2.5-pro、2000トークン、0.95温度）
- **Discord送信**: タイムアウト、リトライ、メッセージ長制限
- **履歴制御**: 拡張100件履歴、エンハンスド選択アルゴリズム

### **統計とモニタリング**

システムは包括的な統計を収集・追跡：

```
📊 プロアクティブメッセージ統計
🤖 送信済み: 145件 | ✅ 応答率: 78.6%
⏱️ 平均応答時間: 3.2時間 | 🎯 送信成功率: 100%
📈 会話継続率: 67.4% | 🕐 稼働時間: 72時間
```

### **データベーススキーマ拡張**

```sql
-- conversationsテーブルの拡張
ALTER TABLE conversations 
ADD COLUMN message_type VARCHAR(30) DEFAULT 'user_initiated',
ADD COLUMN initiator VARCHAR(10) DEFAULT 'user';

-- パフォーマンス用インデックス
CREATE INDEX idx_conversations_message_type ON conversations (message_type);
CREATE INDEX idx_conversations_initiator ON conversations (initiator);
```

### **Supabase同期対応**

プロアクティブメッセージシステムは完全にSupabase同期システムと統合されており、リアルタイム同期により全てのプロアクティブメッセージデータがクラウドに自動保存されます。

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

## 🏥 ヘルスチェック機能

### **Supabase Health Check**

AImoltは、Supabaseデータベースの接続状態を定期的に監視するヘルスチェック機能を提供します。

#### **GitHub Actions 自動ヘルスチェック**

毎日午前0時UTC（日本時間午前9時）に自動実行される定期ヘルスチェック：

- **実行内容**: conversationsテーブルから最新5件のレコードを取得
- **スケジュール**: `cron: '0 0 * * *'` による毎日実行
- **通知**: 失敗時にGitHubメール通知で異常を検知
- **手動実行**: GitHub Actions画面から手動トリガー可能

#### **ヘルスチェック出力例**

```bash
🚀 Supabase Health Check 開始
📅 実行時刻: 2025-08-02T13:18:07.289Z
🔗 Supabase接続を開始...
✅ Supabase接続成功
📊 取得レコード数: 5件
📄 最新レコード情報:
  1. ID: 145, User: 493069905059381255, 作成日時: 2025-08-02T10:54:12.301+00:00
  2. ID: 144, User: 493069905059381255, 作成日時: 2025-07-29T03:00:24.609+00:00
  3. ID: 143, User: 493069905059381255, 作成日時: 2025-07-25T13:59:52.326+00:00
  4. ID: 139, User: 493069905059381255, 作成日時: 2025-07-24T13:10:00.246+00:00
  5. ID: 138, User: 493069905059381255, 作成日時: 2025-07-24T00:04:27.73+00:00
📈 conversationsテーブル総レコード数: 145件
🎉 ヘルスチェック完了: すべて正常
✨ ヘルスチェック正常終了
```

#### **ローカル実行**

開発・デバッグ目的でローカルでヘルスチェックを実行することも可能：

```bash
# 環境変数を設定してローカル実行
SUPABASE_URL="your_supabase_url" SUPABASE_KEY="your_supabase_key" node scripts/supabase-health-check.js
```

#### **技術仕様**

- **ワークフローファイル**: `.github/workflows/supabase-health-check.yml`
- **スクリプト**: `scripts/supabase-health-check.js`
- **環境変数**: GitHub Secrets の `SUPABASE_URL`, `SUPABASE_KEY`
- **Node.js**: v22.x
- **依存関係**: `@supabase/supabase-js`

#### **監視対象**

- **接続性**: Supabaseへの基本接続確認
- **データ取得**: conversationsテーブルからのクエリ実行
- **レコード状態**: 最新レコードの存在確認
- **テーブル統計**: 総レコード数の取得

この機能により、Supabaseの接続障害やデータの異常を早期に検知し、システムの安定性を確保しています。

## 🚀 今後の改善案

詳細な改善案は [GitHub Issues](https://github.com/litoma/aimolt/issues) で管理しています。

## 📄 ライセンス

このプロジェクトはISCライセンスです。詳細は`app/package.json`を参照してください。