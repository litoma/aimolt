# プロファイル連携機能を追加

## 環境変数の追加

```bash
# app/.env に以下を追加
GITHUB_TOKEN=ghp_your_personal_access_token_here
```

## セットアップ手順

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

## 機能概要

- **適応型プロファイル連携**: メッセージ内容に応じて関連する個人特性を自動選択
- **12時間キャッシュ**: GitHub API呼び出しを最小化
- **フォールバック機能**: プロファイル取得失敗時も通常通り動作
- **👍リアクション限定**: like.js実行時のみプロファイル機能を使用

## 管理コマンド（index.js に追加可能）

```javascript
// プロファイル状態確認
if (message.content === '!profile status') {
    const { getProfileStatus } = require('./src/like');
    const status = await getProfileStatus();
    await message.reply(`プロファイル: ${status.hasProfile ? '✅' : '❌'} | キャッシュ: ${status.cacheAgeHours || 0}h前`);
}

// プロファイル強制更新
if (message.content === '!profile refresh') {
    const { forceRefreshProfile } = require('./src/like');
    await forceRefreshProfile();
    await message.reply('プロファイルを更新しました！✅');
}
```

## 動作確認

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