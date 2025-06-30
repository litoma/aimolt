# Node.js 22.x LTS
FROM node:22-alpine

# メタデータ
LABEL maintainer="litoma" \
      description="Aimolt Discord Bot with Gemini AI" \
      version="1.0.0"

# 環境変数設定
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=warn \
    NPM_CONFIG_COLOR=false \
    PM2_PUBLIC_KEY="" \
    PM2_SECRET_KEY=""

# 作業ディレクトリを設定
WORKDIR /app

# セキュリティ向上: 必要なパッケージのみインストール
RUN apk add --no-cache \
    dumb-init \
    git \
    tini \
    && rm -rf /var/cache/apk/*

# 非rootユーザーを先に作成
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# package.jsonとpackage-lock.jsonをコピー
COPY --chown=nodejs:nodejs package*.json ./

# PM2を最初にインストール（グローバル）
RUN npm install -g pm2@latest

# 依存関係のインストール
RUN npm ci --only=production && \
    npm cache clean --force && \
    rm -rf ~/.npm

# アプリケーションのソースコードをコピー
COPY --chown=nodejs:nodejs src/ ./src/
COPY --chown=nodejs:nodejs ecosystem.config.js ./

# 必要なディレクトリを作成
RUN mkdir -p temp logs prompt && \
    chmod 755 temp logs prompt && \
    chown -R nodejs:nodejs temp logs prompt

# 非rootユーザーに切り替え
USER nodejs

# ヘルスチェック（より詳細な確認）
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD pm2 list | grep -q "online" || exit 1

# Graceful shutdown のためのシグナル処理
STOPSIGNAL SIGTERM

# 起動時にtiniを使用してPID 1問題を回避
ENTRYPOINT ["tini", "--"]

# アプリケーションの起動
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
