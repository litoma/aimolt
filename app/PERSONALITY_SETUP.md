# AImolt 動的人格システム セットアップガイド

## 概要

このガイドでは、AImolt Discord Botに新しく追加された動的人格システムの設定と使用方法について説明します。

## 新機能の特徴

### 1. 感情状態管理
- ユーザーとの会話に基づいてAImoltの感情状態（元気度、親密度、興味度）が動的に変化
- 時間経過による感情の自然な減衰
- ムードタイプ（excited, happy, curious, tired, melancholy, neutral）の自動判定

### 2. 記憶蓄積システム
- 重要な会話内容の自動保存と要約
- ユーザーの特徴、好み、重要な出来事の学習
- キーワードベースの記憶検索

### 3. 会話分析エンジン
- リアルタイムでの感情・センチメント分析
- 話題カテゴリの自動分類
- 重要度スコアの算出

### 4. 動的プロンプト生成
- 感情状態、記憶、分析結果に基づく個人化されたプロンプト
- 既存の静的プロンプトとの統合
- 状況に応じた応答スタイルの調整

## セットアップ手順

### 1. データベースの準備

#### PostgreSQLに新しいテーブルを作成

```bash
# PostgreSQLに接続
psql -h localhost -U postgres -d aimolt_db

# または、Docker環境の場合
docker exec -it discord-db-1 psql -U postgres -d aimolt_db
```

```sql
-- 提供されたスキーマファイルを実行
\i /path/to/discord/db/personality_schema.sql
```

#### テーブル作成の確認

```sql
-- 作成されたテーブルの確認
\dt

-- テーブル構造の確認
\d emotion_states
\d user_memories
\d conversation_analysis
```

### 2. 既存の依存関係の確認

人格システムは既存の依存関係を使用するため、追加のnpmパッケージは不要です。

### 3. 環境変数の確認

既存の環境変数がすべて設定されていることを確認してください：

```bash
# 必須環境変数
DISCORD_BOT_TOKEN=your_bot_token
GEMINI_API_KEY=your_gemini_api_key
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=aimolt_db
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# オプション環境変数
CONVERSATION_LIMIT=1000  # デフォルト値
GITHUB_TOKEN=your_github_token  # プロファイル同期用
```

### 4. ボットの起動

```bash
# 開発モード
npm run dev

# 本番モード
npm start

# PM2での起動
npm run pm2:start
```

## テスト手順

### 1. 基本機能テスト

#### データベース接続テスト
1. ボットを起動し、エラーログをチェック
2. 人格システム関連のエラーがないことを確認

#### 基本会話テスト
1. Discord上でボットに何かメッセージを送信
2. 👍リアクションを追加
3. 通常通り応答が返ることを確認

### 2. 人格システム機能テスト

#### 感情状態変化テスト
```sql
-- ユーザーの感情状態を確認
SELECT * FROM emotion_states WHERE user_id = 'YOUR_DISCORD_USER_ID';
```

1. ポジティブなメッセージを送信し、👍リアクションを追加
2. 複数回会話してenergy_levelやintimacy_levelの変化を確認
3. ネガティブなメッセージでも同様にテスト

#### 記憶システムテスト
```sql
-- 保存された記憶を確認
SELECT * FROM user_memories WHERE user_id = 'YOUR_DISCORD_USER_ID' ORDER BY created_at DESC;
```

1. 「私はプログラミングが好きです」などの個人情報を含むメッセージを送信
2. 重要度の高いメッセージ（質問、相談など）を送信
3. データベースに適切に記憶が保存されることを確認

#### 会話分析テスト
```sql
-- 分析結果を確認
SELECT * FROM conversation_analysis WHERE user_id = 'YOUR_DISCORD_USER_ID' ORDER BY analyzed_at DESC LIMIT 5;
```

1. 感情的なメッセージ（嬉しい、悲しいなど）を送信
2. 特定の話題（プログラミング、ゲームなど）について話す
3. 適切にsentiment、emotion_detected、topic_categoryが設定されることを確認

### 3. 動的プロンプトテスト

#### 応答の個人化確認
1. 初回会話時の応答をメモ
2. 数回会話を重ねた後、同様の内容で会話
3. 応答スタイルや内容が個人化されていることを確認

#### リアクション別テスト
- 👍リアクション：ポジティブで支援的な応答
- ❓リアクション：説明的で分かりやすい応答  
- 🎤リアクション：音声文字起こし
- 📝リアクション：メモ整理

## トラブルシューティング

### よくある問題

#### 1. データベース接続エラー
```
Error: Failed to connect to PostgreSQL
```
**解決策：**
- PostgreSQLサービスが起動していることを確認
- 環境変数が正しく設定されていることを確認
- ファイアウォール設定を確認

#### 2. テーブル作成エラー
```
Error: relation "emotion_states" does not exist
```
**解決策：**
- `personality_schema.sql`が正しく実行されたかを確認
- テーブル作成権限があることを確認

#### 3. 人格システムが動作しない
```
Error loading dynamic like prompt
```
**解決策：**
- personalityManagerが正しくインポートされているかを確認
- フォールバック機能により静的プロンプトが使用される

### デバッグ機能

#### 人格システムの状態確認
ボットのコンソールで以下のコマンドを実行（開発環境）:

```javascript
// ユーザーの人格状態を確認
const { personalityManager } = require('./src/personality/manager');
const snapshot = await personalityManager.getPersonalitySnapshot('USER_ID');
console.log(JSON.stringify(snapshot, null, 2));

// システム統計を確認
const stats = await personalityManager.getSystemStats();
console.log(stats);
```

## パフォーマンス最適化

### キャッシュ管理
- 感情状態：5分間キャッシュ
- 記憶：10分間キャッシュ  
- プロンプト生成：3分間キャッシュ

### 手動キャッシュクリア
```javascript
// 特定ユーザーのキャッシュクリア
personalityManager.clearUserCache('USER_ID');

// 全キャッシュクリア
personalityManager.clearAllCache();
```

## 運用上の注意点

### 1. データ増加への対応
- `user_memories`テーブルは自動的に古い記憶を削除（ユーザーあたり最大100件）
- 定期的な`conversation_analysis`テーブルのクリーンアップを推奨

### 2. プライバシーへの配慮
- ユーザーの個人情報が記憶に保存される可能性があります
- 必要に応じてデータ削除機能の実装を検討してください

### 3. システムの無効化
緊急時に人格システムを無効化する場合：
```javascript
const { personalityManager } = require('./src/personality/manager');
personalityManager.disable();
```

## 今後の拡張可能性

- ユーザーごとの人格設定カスタマイズ
- より高度な感情分析の実装
- 長期記憶の重要度による自動調整
- 複数ユーザー間の関係性分析

---

## サポート

問題や質問がある場合は、開発者にお問い合わせください。
ログファイルとエラーメッセージを含めて報告していただけると、より迅速な対応が可能です。