# AImolt Discord Bot (Deno)

AImoltは、Gemini 3 Flash PreviewとSupabaseを活用した多機能Discordボットです。
2026年2月より、**Deno + Discordeno** アーキテクチャに全面移行しました。

LegacyなNestJS版コードは `app/` ディレクトリにアーカイブされています。

## 🚀 主な機能

- **テキスト応答**: 👍リアクションでAIが応答 (会話履歴考慮)
- **音声文字起こし**: 🎤リアクションで音声ファイルを文字起こし (メモリ内処理)
- **メモ機能**: 📝リアクションでObsidianのDaily Noteに追記 (ローカル環境のみ)
- **人格システム**: VADモデルによる感情シミュレーションと関係性管理

## 📂 プロジェクト構造

```
aimolt/
├── deno-bot/                  # [推奨] Deno版ソースコード
│   ├── main.ts                # エントリーポイント
│   ├── src/
│   │   ├── services/          # ビジネスロジック (Gemini, Supabase, etc.)
│   │   ├── events/            # Discordイベントハンドラ
│   │   └── config.ts          # 設定ファイル
│   ├── prompt/                # AIプロンプト定義
│   └── DEPLOYMENT.md          # デプロイ手順書
│
└── app/                       # [旧] NestJS版 (Legacy)
```

## 🦕 Deno版のセットアップ

### 必須環境
- [Deno](https://docs.deno.com/runtime/manual) v2.x 以上
- Supabase プロジェクト
- Google Gemini API Key
- Discord Bot Token

### 起動方法

1. **ディレクトリ移動**:
   ```bash
   cd deno-bot
   ```

2. **環境変数設定**:
   `app/.env` を参考に、Deno Deployの環境変数設定または `.env` ファイルを作成してください。
   (ローカル実行時は `.env` を自動読み込みします)

3. **起動**:
   ```bash
   deno task start
   ```

## ☁️ デプロイ (Deno Deploy)

本番環境は **Deno Deploy** を推奨します。
詳細な手順は `deno-bot/DEPLOYMENT.md` を参照してください。

- **GitHub連携**: リポジトリを連携するだけで自動デプロイ可能です。
- **環境変数**: Deno Deployのダッシュボードで設定が必要です。

## 🛠️ 開発・テスト

- **Lint / Format**:
  Denoには標準で組み込まれています。
  ```bash
  deno lint
  deno fmt
  ```

- **テスト**:
  ```bash
  deno test
  ```

## 📄 ライセンス
ISC License