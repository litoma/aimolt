# CLAUDE.md

このファイルは、このリポジトリでコードを操作する際にClaude Code (claude.ai/code)にガイダンスを提供します。

## プロジェクト概要

これは**AImolt**というDiscord Botで、GoogleのGemini AIと統合され、PostgreSQL/Supabaseをデータストレージとして使用します。このボットは音声文字起こし、AI支援応答、ユーザープロファイル管理を処理します。

## 開発コマンド

### 基本操作
- `npm start` - 本番モードでボットを起動
- `npm run dev` - 開発モードでボットを起動（9229ポートでインスペクター付き）

### プロセス管理（PM2）
- `npm run pm2:start` - PM2で開始
- `npm run pm2:stop` - PM2プロセスを停止
- `npm run pm2:restart` - PM2プロセスを再起動
- `npm run pm2:logs` - PM2ログを表示
- `npm run pm2:delete` - PM2プロセスを削除

### Dockerコマンド
- `npm run docker:build` - Dockerイメージをビルド
- `npm run docker:up` - コンテナをデタッチモードで起動
- `npm run docker:down` - コンテナを停止
- `npm run docker:logs` - コンテナログを表示

### テストとリンティング
- `npm test` - 現在は「テストが指定されていません」エラーを返す
- `npm run lint` - 現在は「リンティングが設定されていません」だが正常終了する

## アーキテクチャ

### コアコンポーネント

1. **メインボットハンドラー** (`src/index.js`)
   - 必要なIntentを持つDiscordクライアントのセットアップ
   - メッセージとリアクションイベントの処理
   - プロファイル管理コマンド（`!profile status`、`!profile refresh`、`!profile help`）
   - PostgreSQLとSupabaseバックアップでの会話履歴管理
   - クールダウンシステム（リアクション間5秒）

2. **AI統合モジュール**
   - **プロンプトシステム** (`src/prompt.js`): キャッシュ付きの集中プロンプト管理
   - **いいねハンドラー** (`src/like.js`): プロファイル対応応答で👍リアクションを処理
   - **文字起こし** (`src/transcribe.js`): 音声からテキストへの🎤リアクション処理
   - **説明ハンドラー** (`src/explain.js`): 説明用の❓リアクションを処理

3. **プロファイル管理** (`src/profile-sync.js`)
   - キャッシュ付きのGitHubプロファイル同期
   - ユーザープロファイルに基づく適応的プロンプト
   - ステータス監視と更新機能

### 主要機能

- **マルチリアクション対応**: 👍（いいね）、🎤（文字起こし）、❓（説明）
- **会話記憶**: PostgreSQLとSupabaseの両方にチャット履歴を保存
- **プロファイル統合**: パーソナライズされた応答のためのGitHubプロファイル同期
- **音声処理**: フィラー語除去付きのOGG音声ファイル文字起こし
- **タイピング表示**: 処理中にボットが「入力中」と表示
- **クールダウン保護**: 5秒のクールダウンでスパムを防止

### データベーススキーマ

ボットは二重ストレージを使用:
- **メイン**: `conversations`テーブルを持つローカルPostgreSQL
- **バックアップ**: 同じスキーマのSupabase
- **キャッシュ**: 設定可能な制限付きのメモリ内会話キャッシュ

### 必要な環境変数

- `DISCORD_BOT_TOKEN` - Discord botトークン
- `GEMINI_API_KEY` - Google Gemini APIキー
- `SUPABASE_URL` & `SUPABASE_KEY` - Supabase接続
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - PostgreSQL接続
- `GITHUB_TOKEN` - オプション、プロファイル同期機能用
- `CONVERSATION_LIMIT` - オプション、デフォルト1000メッセージ

### ファイル構造

```
src/
├── index.js          # メインボットエントリーポイント
├── prompt.js         # プロンプト管理システム
├── like.js           # 👍リアクションハンドラー
├── transcribe.js     # 🎤音声文字起こし
├── explain.js        # ❓説明ハンドラー
└── profile-sync.js   # GitHubプロファイル統合

prompt/
├── system.txt        # ベースシステム指示
├── like.txt          # 👍リアクションプロンプト
├── explain.txt       # ❓説明プロンプト
├── transcribe.txt    # 🎤文字起こしプロンプト
└── explain_fallback.txt # フォールバック説明プロンプト

temp/                 # 一時ファイル（音声処理）
profile/             # プロファイルキャッシュストレージ
```

## 重要な注意事項

- ボットはNode.js 22+を使用し、特定のDiscord Intentsが必要
- 音声ファイルは処理中に`temp/`ディレクトリに一時保存される
- プロファイル同期はオプションでGitHubトークンが必要
- すべてのプロンプトはパフォーマンスのためにキャッシュされる
- 本番環境ではプロセス管理にPM2を使用
- 適切なヘルスチェック付きのDockerサポートが利用可能