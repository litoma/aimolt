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
├── main.ts                # Deno Entrypoint
├── deno.json              # Deno Config
├── src/                   # Deno Source Code
├── app/                   # Legacy NestJS App (Archive)
└── README.md
```

## 🦕 Deno版のセットアップ

### 必須環境
- [Deno](https://docs.deno.com/runtime/manual) v2.x 以上

### 起動方法

1. **環境変数設定**:
   `.env` ファイルを作成してください。

2. **起動**:
   ```bash
   deno task start
   ```

## ☁️ デプロイ (Deno Deploy)

**Entrypoint**: `main.ts` (ルート直下)
詳細は `DEPLOYMENT.md` を参照してください。

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