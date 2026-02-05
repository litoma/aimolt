# AImolt Discord Bot

AImoltは、Gemini 3 Flash PreviewとSupabaseを活用した多機能Discordボットです。テキストメッセージへの応答、音声メッセージの文字起こし、メモ機能など、多彩な機能を提供します。

- **テキスト応答**: 👍リアクションに、会話履歴を考慮したAIが応答します。
- **音声文字起こし**: 🎤リアクションを付けるだけで、`.ogg`形式の音声メッセージを文字に起こします（フィラー語除去）。
- **メモ機能**: 📝リアクションを付けると、メッセージ内容をObsidianのDailyメモにそのまま追加します。

## 🚀 主な機能

- **楽しい対話**: ウィットに富んだ20代女性「aimolt」として、親しみやすい日本語で応答します。
- **音声のテキスト化**: `.ogg`形式の音声ファイルを高精度に文字起こしし、フィラー語を自動除去します。
- **Obsidian統合**: メッセージ内容をObsidianのDailyメモにシンプルに追加し、知識管理を支援します。
- **文脈理解**: Supabaseに会話履歴を保存し、文脈に沿った応答を実現します。
- **プロンプト一元管理**: すべてのAIプロンプトを`app/prompt/`ディレクトリで一元管理し、保守性を向上。
- **安定稼働**: 本番環境ではPM2やDockerを利用して安定したプロセス管理が可能です。

## 🏗️ アーキテクチャ

Node.jsアプリケーションがDiscord GatewayおよびSupabase APIと連携して動作します。

```
┌───────────────────────────────────────────────┐
│                 Cloud Services                │
│  ┌──────────────┐      ┌───────────────────┐  │
│  │ Discord API  │◄────►│   Supabase API    │  │
│  └──────────────┘      └───────────────────┘  │
│         ▲                        ▲            │
│         │                        │            │
│  ┌──────┴────────────────────────┴─────────┐  │
│  │             Node.js Application         │  │
│  │           (Discord Bot Service)         │  │
│  │  + Gemini AI                            │  │
│  │  + Personality V2 (VAD Model)           │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## ✅ 必須環境

- **Node.js**: v22.x 以上
- **npm**: v10.x 以上
- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) で取得
- **Gemini API Key**: [Google AI Studio](https://makersuite.google.com/) で取得
- **Supabase Project**: [Supabase](https://supabase.com/) でプロジェクトを作成
- **GitHub Personal Access Token** (プロファイル連携用・オプション): [GitHub Settings](https://github.com/settings/tokens) で取得

## 🛠️ セットアップ

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

5.  **Botを起動**:
    - PM2を利用する場合 (本番推奨):
      ```bash
      npm run pm2:start
      ```
    - 直接Node.jsで実行する場合:
      ```bash
      npm start
      ```
    - 開発モード（ホットリロード）:
      ```bash
      npm run dev
      ```

### 🐳 Dockerでのセットアップ

1.  **リポジトリをクローン**:
    ```bash
    git clone https://github.com/litoma/aimolt.git
    cd aimolt
    ```

2.  **環境変数を設定**:
    - `app/.env`ファイルを作成し、APIキー等を設定します。

3.  **コンテナをビルドして起動**:
    ```bash
    npm run docker:up
    ```

## ⚙️ 設定

### 環境変数 (`app/.env`)

Botの動作には以下の環境変数が必要です。

| 変数名 | 説明 | 例 | 必須 |
| :--- | :--- | :--- | :--- |
| `DISCORD_BOT_TOKEN` | Discordボットのトークン | `MTxxxxx.xxxxx.xxxxx` | ✅ |
| `DISCORD_APPLICATION_ID` | DiscordアプリケーションのID | `1234567890123456789` | ✅ |
| `DISCORD_GUILD_ID` | Botを導入するサーバー(Guild)のID | `1234567890123456789` | ✅ |
| `GEMINI_API_KEY` | Google Gemini AIのAPIキー | `AIxxxxxxxxxxxxx` | ✅ |
| `SUPABASE_URL` | SupabaseプロジェクトのURL | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_KEY` | SupabaseのAnonキー | `eyxxxxxx` | ✅ |
| `CONVERSATION_LIMIT` | 参照する会話履歴の最大件数 | `1000` | ✅ |
| `GITHUB_TOKEN` | GitHub Personal Access Token (プロファイル連携用) | `ghp_xxxxxxxxxxxxxxxx` | ❌ |
| `OBSIDIAN_URL` | Obsidian REST API URL | `http://localhost:27123` | ❌ |
| `OBSIDIAN_API` | Obsidian REST API キー | `your_api_key_here` | ❌ |

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

### AIプロンプトの設定

すべてのプロンプトを`app/prompt/`ディレクトリで一元管理しています。

| ファイル名 | 対応JSファイル | 用途 | 説明 |
| :--- | :--- | :--- | :--- |
| `system.txt` | `index.js` | システム基本指示 | Botの基本的な性格・応答スタイルを定義 |
| `like.txt` | `like.js` | 👍リアクション応答 | フレンドリーでカジュアルな応答スタイル |
| `transcribe.txt` | `transcribe.js` | 🎤音声文字起こし | フィラー語除去などの指示 |

## 使い方

1.  **テキスト応答**:
    - メッセージに👍リアクションを付けます。
    - プロファイル連携が有効な場合、メッセージ内容に応じて個人化された応答を提供します。

2.  **音声文字起こし**:
    - `.ogg`形式の音声メッセージを投稿し、それに🎤リアクションを付けます。
    - Botが自動で文字起こし結果を投稿します。

3.  **メモ機能**:
    - メッセージに📝リアクションを付けます。
    - メッセージ内容がObsidianのDailyメモにそのまま追加されます（時刻とリンク付き）。

4.  **人格システム管理**:
    - `!personality status` で現在の感情・関係性状態を確認
    - `!personality stats` で統計情報を表示

5.  **プロファイル管理**:
    - `!profile status` でプロファイル状態を確認
    - `!profile refresh` でプロファイルを強制更新

## 🗂️ プロジェクト構造

```
aimolt/
├── app/                                 # Node.jsアプリケーション
│   ├── src/                             # ソースコード
│   │   ├── index.js                     # Botのメインロジック
│   │   ├── like.js                      # 👍リアクション処理
│   │   ├── transcribe.js                # 🎤リアクション処理
│   │   ├── memo.js                      # 📝メモ機能（Obsidian統合）
│   │   ├── prompt.js                    # プロンプト管理システム
│   │   ├── profile-sync.js              # プロファイル同期システム
│   │   ├── personality-command-v2.js    # 人格システム管理コマンド
│   │   ├── utils/                       # ユーティリティ関数
│   │   │   ├── retry.js                 # Gemini API リトライ機能
│   │   │   └── supabase.js              # Supabaseクライアント
│   │   ├── personality/                 # 🧠 v2.0動的人格システム
│   │   │   ├── manager-v2.js            # v2.0統合人格マネージャー
│   │   │   ├── vad-emotion.js           # VAD感情システム
│   │   │   ├── relationship-manager.js  # 関係性管理システム
│   │   │   ├── core-personality.js      # Big Five人格特性管理
│   │   │   ├── adaptive-response.js     # 適応的応答エンジン
│   │   │   ├── memory.js                # 記憶蓄積システム
│   │   │   ├── analyzer.js              # 会話分析エンジン
│   │   │   └── generator.js             # 動的プロンプト生成
│   ├── prompt/                          # AIプロンプト（一元管理）
│   │   ├── system.txt                   # 基本システム指示
│   │   ├── like.txt                     # 👍リアクション用
│   │   ├── transcribe.txt               # 🎤音声文字起こし用
│   │   └── memo.txt                     # 📝メモ機能用
│   ├── temp/                            # 音声ファイルの一時保存場所
│   ├── profile/                         # プロファイルキャッシュ保存場所
│   ├── Dockerfile                       # アプリケーション用Dockerfile
│   ├── ecosystem.config.js              # PM2設定ファイル
│   └── package.json
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

## 💾 データベース (Supabase)

Supabase上のテーブル構造:

### **基本テーブル**
```sql
-- conversations: 会話履歴
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **🧠 v2.0動的人格システム用テーブル**
- **emotion_states**: VAD感情モデル (valence/arousal/dominance)
- **user_relationships**: 関係性ステータス (信頼度/親密度/ステージ)
- **user_memories**: ユーザーに関する記憶 (好み/事実/イベント)
- **conversation_analysis**: 会話内容の分析結果

## 🩺 トラブルシューティング

- **Botが起動しない**:
  - `docker compose logs discord-bot` (Docker) または `npm run pm2:logs` (ローカル) でログを確認します。
  - `app/.env`ファイルのトークンやAPIキーが正しいか確認してください。
- **データベースに接続できない**:
  - `Supabase URL`と`Key`が正しいか確認してください。
- **リアクションに反応しない**:
  - Botが必要な権限 (`Guilds`, `GuildMessages`, `GuildMessageReactions`, `MessageContent`) を持っているか、Discord Developer Portalで確認してください。
- **音声の文字起こしに失敗する**:
  - `app/temp`ディレクトリが存在し、書き込み権限があるか確認してください。

## 📄 ライセンス

このプロジェクトはISCライセンスです。詳細は`app/package.json`を参照してください。