# AImolt Discord Bot

AImoltは、Gemini 1.5 FlashとSupabaseを活用した多機能Discordボットです。NestJSフレームワークを採用した堅牢なアーキテクチャにより、テキストメッセージへの応答、音声メッセージの文字起こし、メモ機能など、多彩な機能を提供します。

- **テキスト応答**: 👍リアクションに、会話履歴を考慮したAIが応答します。
- **音声文字起こし**: 🎤リアクションを付けるだけで、音声メッセージを文字に起こします（フィラー語除去対応）。
- **メモ機能**: 📝リアクションを付けると、メッセージ内容をObsidianのDailyメモにそのまま追加します。
- **人格システム**: VADモデルによる感情シミュレーションと関係性管理を行います。

## 🚀 主な機能

- **楽しい対話**: ウィットに富んだ20代女性「aimolt」として、親しみやすい日本語で応答します。
- **音声のテキスト化**: 音声形式のファイルを高精度に文字起こしし、フィラー語を自動除去します。
- **Obsidian統合**: メッセージ内容をObsidianのDailyメモにシンプルに追加し、知識管理を支援します。
- **文脈理解**: Supabaseに会話履歴を保存し、文脈に沿った応答を実現します。
- **NestJSアーキテクチャ**: モジュール化された設計により、高い保守性と拡張性を実現しています。
- **安定稼働**: PM2を使用した安定したプロセス管理が可能です。

## 🏗️ アーキテクチャ

NestJSフレームワークを使用し、ドメイン駆動設計（DDD）に基づいたモジュール構成になっています。

```
┌───────────────────────────────────────────────┐
│                 Cloud Services                │
│  ┌──────────────┐      ┌───────────────────┐  │
│  │ Discord API  │◄────►│   Supabase API    │  │
│  └──────────────┘      └───────────────────┘  │
│         ▲                        ▲            │
│         │                        │            │
│  ┌──────┴────────────────────────┴─────────┐  │
│  │             NestJS Application          │  │
│  │                                         │  │
│  │  [Core] [Personality] [Interaction]     │  │
│  │  [Discord Gateway]                      │  │
│  └─────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

## ✅ 必須環境

- **Node.js**: v22.x 以上
- **npm**: v10.x 以上
- **Discord Bot Token**: [Discord Developer Portal](https://discord.com/developers/applications) で取得
- **Gemini API Key**: [Google AI Studio](https://makersuite.google.com/) で取得
- **Supabase Project**: [Supabase](https://supabase.com/) でプロジェクトを作成

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

5.  **Botをビルド**:
    ```bash
    npm run build
    ```

6.  **Botを起動**:
    - PM2を利用する場合 (本番推奨):
      ```bash
      npm run pm2:start
      ```
    - 直接Node.jsで実行する場合:
      ```bash
      npm run start:prod
      ```
    - 開発モード（ホットリロード）:
      ```bash
      npm run start:dev
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
| `OBSIDIAN_URL` | Obsidian REST API URL | `http://localhost:27123` | ❌ |
| `OBSIDIAN_API` | Obsidian REST API キー | `your_api_key_here` | ❌ |

### 📝 メモ機能 (Obsidian統合)

1. **Obsidian REST API プラグインのインストール**
2. **環境変数の設定** (`OBSIDIAN_URL`, `OBSIDIAN_API`)
3. **機能の使用**: 📝リアクションを付けると、ObsidianのDailyメモに追加されます。

### AIプロンプトの設定

すべてのプロンプトを`app/prompt/`ディレクトリで一元管理しています。

| ファイル名 | 用途 | 説明 |
| :--- | :--- | :--- |
| `system.txt` | システム基本指示 | Botの基本的な性格・応答スタイルを定義 |
| `like.txt` | 👍リアクション応答 | フレンドリーでカジュアルな応答スタイル |
| `transcribe.txt` | 🎤音声文字起こし | フィラー語除去などの指示 |

## 使い方

1.  **テキスト応答**:
    - メッセージに👍リアクションを付けます。

2.  **音声文字起こし**:
    - 音声ファイルを添付し、🎤リアクションを付けます。

3.  **メモ機能**:
    - メッセージに📝リアクションを付けます。

4.  **人格管理**:
    - `!personality status`: 感情・関係性状態の確認

## 🗂️ プロジェクト構造 (NestJS)

```
aimolt/
├── app/
│   ├── src/
│   │   ├── main.ts                    # エントリーポイント
│   │   ├── app.module.ts              # メインモジュール
│   │   ├── core/                      # コアモジュール (Config, Gemini, Supabase)
│   │   ├── personality/               # 人格・感情管理
│   │   │   ├── domain/                # エンティティ定義
│   │   │   ├── application/           # サービスロジック (VAD)
│   │   │   ├── infrastructure/        # リポジトリ実装
│   │   │   └── interface/             # Discord Gateway, Commands
│   │   ├── interaction/               # インタラクション (Like, Memo, Transcribe)
│   │   └── discord/                   # Discord接続基盤
│   ├── dist/                          # ビルド成果物 (自動生成)
│   ├── prompt/                        # プロンプトファイル
│   ├── test/                          # テスト
│   ├── nest-cli.json                  # NestJS設定
│   ├── tsconfig.json                  # TypeScript設定
│   └── package.json
├── .gitignore
└── README.md
```

## 📦 利用可能なスクリプト

`app/package.json`参照:

```bash
npm run build            # NestJSビルド
npm run start            # NestJS起動
npm run start:dev        # 開発モード (Watch)
npm run start:prod       # 本番モード (dist/main.js実行)
npm run pm2:start        # PM2で起動
npm run test             # テスト実行
```

### 📄 ライセンス


## 🦕 Deno Migration (v3.0)

2026年2月、アーキテクチャを **Deno + Discordeno** に移行しました。
旧NestJS版は `app/` ディレクトリに残されていますが、現在の推奨環境は `discord/deno-bot/` です。

### 主な変更点
- **Runtime**: Node.js -> Deno v2.x
- **Framework**: NestJS -> Discordeno v21
- **Platform**: Deno Deploy へのデプロイを想定

### Deno版のディレクトリ構造
```
aimolt/
├── deno-bot/                  # Deno版ソースコード
│   ├── main.ts                # エントリーポイント
│   ├── deno.json              # 設定・依存関係
│   ├── src/                   # ソースコード
│   │   ├── services/          # ビジネスロジック
│   │   ├── events/            # イベントハンドラ
│   │   └── config.ts          # 環境変数設定
│   └── DEPLOYMENT.md          # デプロイ手順書
└── app/                       # (旧) NestJS版ソースコード
```

### Deno版の起動方法

1. **Denoのインストール**:
   https://docs.deno.com/runtime/manual

2. **ディレクトリ移動**:
   ```bash
   cd deno-bot
   ```

3. **起動**:
   ```bash
   deno task start
   ```

### デプロイ
Deno Deploy へのデプロイ方法は `deno-bot/DEPLOYMENT.md` を参照してください。