# Aimolt Discord Bot

Aimolt is a Discord bot powered by Gemini AI (gemini-1.5-flash) and Supabase, designed to respond to text messages, transcribe voice messages, and explain content. It supports:

- **Text Responses**: Reply to messages with 👍 reactions or `/ask` slash command, using Gemini AI with conversation history stored in Supabase/PostgreSQL.
- **Voice Transcription**: Transcribe `.ogg` voice messages with 🎤 reactions.
- **Content Explanation**: Explain messages with ❓ reactions, providing detailed insights in an Embed format.

## Features

- Responds to text messages via 👍 reactions or `/ask` command with context-aware replies in a fun, casual Japanese tone (emulating a witty 20s female, "aimolt").
- Transcribes `.ogg` voice messages when reacted with 🎤, posting results with "🎉 文字起こしが完了したよ〜！".
- Explains message content with ❓ reactions, using clear and beginner-friendly explanations.
- Stores conversation history in Supabase or local PostgreSQL for contextual responses.
- Uses PM2 for process management in production.

## Prerequisites

- **Node.js**: v18.x or later (tested with v18.20.0).
- **Discord Bot Token**: Create a bot on [Discord Developer Portal](https://discord.com/developers/applications) with `Guilds`, `GuildMessages`, `GuildMessageReactions`, and `MessageContent` intents.
- **Gemini API Key**: Obtain from [Google AI Studio](https://makersuite.google.com/).
- **Supabase Project**: Set up with a `conversations` table (see Database Schema below).
- **PostgreSQL**: Local instance (via Docker, `postgres:15`) for conversation history backup.
- **PM2**: For running the bot in production (`npm install -g pm2`).
- **Docker**: For running the PostgreSQL container.

## Installation

1. **Clone or Initialize the Repository**:
   ```bash
   git clone https://github.com/litoma/aimolt.git
   cd aimolt
   ```
   Or initialize a new repository:
   ```bash
   cd /home/ubuntu/discord
   git init
   ```

2. **Install Dependencies**:
   ```bash
   cd app
   npm install
   ```

3. **Set Up Environment Variables**:
   - Copy `.env.example` to `app/.env`:
     ```bash
     cp app/.env.example app/.env
     ```
   - Edit `app/.env` with your credentials:
     ```plaintext
     DISCORD_TOKEN=your_discord_bot_token
     DISCORD_APPLICATION_ID=your_application_id
     DISCORD_GUILD_ID=your_guild_id
     GEMINI_API_KEY=your_gemini_api_key
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     POSTGRES_HOST=localhost
     POSTGRES_PORT=5432
     POSTGRES_USER=postgres
     POSTGRES_PASSWORD=aimolt
     POSTGRES_DB=aimolt
     CONVERSATION_LIMIT=1000
     ```

4. **Set Up PostgreSQL**:
   - Start the Docker container:
     ```bash
     cd db
     docker compose up -d
     ```
   - Initialize the schema:
     ```bash
     psql -h localhost -U postgres -d aimolt -f db/init.sql
     ```

5. **Create Temp Directory**:
   ```bash
   mkdir -p app/temp
   chmod 755 app/temp
   ```

6. **Configure System Instruction**:
   - Edit `app/src/config.js` for Gemini AI's system instruction:
     ```javascript
     module.exports = {
       systemInstruction: 'あなたは「aimolt」、エネルギッシュでウィットに富んだ20代の女性！日本語で楽しく、親しみやすいトーンで応答してね。カジュアルな言葉遣いで、たまに軽いジョークや絵文字を入れて、まるで親友とチャットしてるみたいに！英語の入力があっても、日本語で答えてね！'
     };
     ```

7. **Run the Bot**:
   - Using PM2 (recommended):
     ```bash
     cd app
     pm2 start ecosystem.config.js
     pm2 save
     ```
   - Or directly:
     ```bash
     node src/index.js
     ```

## Usage

1. **Text Interaction**:
   - Send a message (e.g., "こんにちは！") and add a 👍 reaction to get a fun response (e.g., "やっほー！元気じゃん！😎").
   - Use the `/ask` command: `/ask query: Hello, how are you?`
   - The bot maintains conversation history for contextual replies.

2. **Voice Transcription**:
   - Send a `.ogg` voice message and add a 🎤 reaction.
   - Results are posted with "🎉 文字起こしが完了したよ〜！".

3. **Content Explanation**:
   - Add a ❓ reaction to a message to get a detailed explanation in an Embed format.
   - Example: "💡 解説が完了したよ〜！" with a structured breakdown.

4. **PM2 Commands**:
   - Start: `pm2 start ecosystem.config.js`
   - Stop: `pm2 stop aimolt`
   - Restart: `pm2 restart aimolt`
   - View logs: `pm2 logs aimolt`
   - Save configuration: `pm2 save`
   - Delete process: `pm2 delete aimolt`

## Dependencies

- `@google/generative-ai`: ^0.24.1 (Gemini AI for text and audio processing)
- `@supabase/supabase-js`: ^2.50.1 (Conversation history storage)
- `discord.js`: ^14.20.0 (Discord bot functionality)
- `dotenv`: ^16.5.0 (Environment variable management)
- `pg`: ^8.13.0 (PostgreSQL client)

Install with:
```bash
cd app
npm install @google/generative-ai @supabase/supabase-js discord.js dotenv pg
```

## Project Structure

- `app/`: Node.js application
  - `src/`: Source code
    - `index.js`: Main bot logic (slash commands, reaction handling, history storage).
    - `react.js`: Handles 👍 reactions for text responses.
    - `transcribe.js`: Handles 🎤 reactions for voice transcription.
    - `explain.js`: Handles ❓ reactions for content explanation.
    - `config.js`: Gemini AI system instruction.
  - `prompt/`: Prompt files
    - `like_reaction.txt`: Prompt for 👍 reactions (fun, casual tone).
    - `question_explain.txt`: Prompt for ❓ reactions (detailed, beginner-friendly explanations).
  - `temp/`: Temporary storage for `.ogg` files (auto-deleted after transcription).
  - `package.json`, `package-lock.json`, `node_modules/`: Node.js dependencies.
  - `ecosystem.config.js`: PM2 configuration.
  - `.env`: Environmentვ

## Database Schema

The bot uses both a local PostgreSQL instance and Supabase for conversation history. The `conversations` table is defined as follows:

```sql
-- 会話履歴テーブル（1会話1レコード）
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY,
    user_id TEXT NOT NULL,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_created ON conversations (user_id, created_at DESC);
```

To query the history:
```bash
psql -h localhost -U postgres -d aimolt -c "SELECT COUNT(*) FROM conversations;"
```

For Supabase, the same schema is used. Ensure `SUPABASE_URL` and `SUPABASE_KEY` are set in `app/.env`.

# 🐳 Docker Deployment Guide

## Prerequisites for Docker

- **Docker**: v20.10+ 
- **Docker Compose**: v2.0+
- **Node.js v22.x**: Required for development (optional for production)
- **Git**: For cloning the repository

## 🚀 Quick Start

### 1. Automated Setup (Recommended)
```bash
# Clone the repository
git clone https://github.com/litoma/aimolt.git
cd aimolt

# Run the setup script
chmod +x setup-docker.sh
./setup-docker.sh
```

### 2. Manual Setup
```bash
# Create required directories
mkdir -p app/temp app/logs db/data
chmod 755 app/temp app/logs db/data

# Copy environment template
cp app/.env.docker app/.env
# Edit app/.env with your actual credentials

# Build and start
docker-compose up --build -d
```

## 📋 Environment Variables

### Required Variables
| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | `MTxxxxx.xxxxx.xxxxx` |
| `DISCORD_APPLICATION_ID` | Discord application ID | `1234567890123456789` |
| `GEMINI_API_KEY` | Google Gemini AI API key | `AIxxxxxxxxxxxxx` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | Supabase anon key | `eyxxxxxx` |

### Docker-specific Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | Container name for PostgreSQL |
| `NODE_ENV` | `production` | Environment mode |
| `CONVERSATION_LIMIT` | `1000` | Max conversation history |

## 🏗️ Container Architecture

```
┌─────────────────────────────────────────┐
│               Docker Network           │
│  ┌─────────────────┐ ┌───────────────┐ │
│  │   Discord Bot   │ │  PostgreSQL   │ │
│  │   (Node.js 22)  │ │  (postgres:17)│ │
│  │   + PM2         │ │               │ │
│  │   + Gemini AI   │ │               │ │
│  └─────────────────┘ └───────────────┘ │
└─────────────────────────────────────────┘
```

## 🔧 Development vs Production

### Production Mode
```bash
# Production deployment
docker compose -f compose.yaml up -d --build

# Or set environment
NODE_ENV=production docker compose up -d
```

Features:
- Optimized image size
- Security hardening
- Resource limits
- Health checks
- Graceful shutdown

## 📊 Monitoring & Logs

### View Logs
```bash
# Real-time logs
docker-compose logs -f discord-bot

# PostgreSQL logs
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 discord-bot
```

### Health Checks
```bash
# Check container status
docker-compose ps

# Detailed health info
docker inspect $(docker-compose ps -q discord-bot) | jq '.[0].State.Health'
```

### PM2 Monitoring (Inside Container)
```bash
# Access container shell
docker-compose exec discord-bot sh

# PM2 commands
pm2 list
pm2 logs
pm2 monit
pm2 restart aimolt
```

## 🔧 Troubleshooting

### Common Issues

#### Bot Not Starting
```bash
# Check logs
docker compose logs discord-bot

# Common causes:
# - Invalid Discord token
# - Missing .env file
# - Database connection failed
```

#### Database Connection Issues
```bash
# Test PostgreSQL connection
docker compose exec postgres psql -U postgres -d aimolt -c "SELECT 1;"

# Check network connectivity
docker compose exec discord-bot ping postgres
```

#### Permission Issues
```bash
# Fix temp directory permissions
sudo chown -R 1001:1001 app/temp app/logs
chmod 755 app/temp app/logs
```

#### Memory Issues
```bash
# Check resource usage
docker stats $(docker-compose ps -q)

# Restart with memory limit
docker compose up -d --scale discord-bot=1
```

### Debug Mode
```bash
# Enable Node.js debugging
docker compose -f docker-compose.yml -f docker-compose.override.yml up

# Connect debugger to localhost:9229
```

## 🔐 Security Considerations

### Container Security
- Non-root user execution (nodejs:1001)
- Read-only filesystem where possible
- Minimal base image (Alpine Linux)
- Regular security updates

### Network Security
- Internal Docker network
- No unnecessary port exposure
- Environment variable encryption

### Data Security
- PostgreSQL data persistence
- Secure credential management
- Conversation history protection

## 📈 Performance Optimization

### Resource Limits
```yaml
# In docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### Caching Strategy
- Docker layer caching
- npm dependency caching
- PM2 process clustering (if needed)

## 🚀 Production Deployment

### Prerequisites
- Docker Swarm or Kubernetes
- Load balancer (if scaling)
- Monitoring solution (Prometheus/Grafana)
- Log aggregation (ELK Stack)

### Docker Swarm Example
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml aimolt

# Scale service
docker service scale aimolt_discord-bot=3
```

### Kubernetes Deployment
```bash
# Convert to Kubernetes manifests
kompose convert

# Apply manifests
kubectl apply -f .
```

## 🔄 Updates & Maintenance

### Update Bot Code
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose up --build -d
```

### Database Maintenance
```bash
# Backup database
docker compose exec postgres pg_dump -U postgres aimolt > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres aimolt < backup.sql
```

### Clean Up
```bash
# Remove unused images
docker image prune -a

# Remove all containers and volumes
docker compose down -v

# Clean build cache
docker builder prune
```

## 📞 Support

For Docker-specific issues:
1. Check container logs: `docker compose logs discord-bot`
2. Verify environment variables: `docker compose config`
3. Test database connectivity: `docker compose exec postgres pg_isready`
4. Create GitHub issue with logs and configuration

## 🎯 Next Steps

- [ ] Set up monitoring with Prometheus
- [ ] Implement log rotation
- [ ] Add backup automation
- [ ] Configure SSL/TLS certificates
- [ ] Set up CI/CD pipeline

## Troubleshooting

- **Bot not responding**:
  - Check logs: `pm2 logs aimolt`.
  - Verify `app/.env` credentials and `app/src/config.js`.
  - Ensure `DISCORD_TOKEN`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY` are valid.
- **Transcription errors**:
  - Ensure `.ogg` files are valid and under 100MB.
  - Check `app/temp/` permissions: `chmod -R 755 app/temp`.
- **Conversation history issues**:
  - Query Supabase or PostgreSQL: `SELECT user_id, message FROM conversations WHERE user_id = '<your_user_id>';`.
  - Verify database credentials in `app/.env`.
- **PM2 errors**:
  - If `Cannot find module '/home/ubuntu/discord/index.js'`, ensure `ecosystem.config.js` points to `app/src/index.js` and `cwd` is `/home/ubuntu/discord/app`.
  - If `ReferenceError: path is not defined`, add `const path = require('path');` at the top of `app/src/index.js`.
  - If `プロンプトの読み込みに失敗しました！🙈`, check if `app/prompt/like_reaction.txt` exists and has correct permissions (`chmod 644`).

## Future Improvements

- **New Commands**:
  - `/history`: Display a user's conversation history.
  - `/clear`: Clear conversation history for a user (with confirmation).
- **Additional Reactions**:
  - 😎 for cool, humorous responses.
  - 📝 for summarizing long messages.
- **Performance Optimizations**:
  - Cache Gemini API responses to reduce latency.
  - Implement batch processing for conversation history to handle high traffic.
- **Error Handling**:
  - Add retry logic for Gemini API rate limits.
  - Improve logging for debugging (e.g., structured JSON logs).
- **Monitoring**:
  - Add health checks for Supabase/PostgreSQL connectivity.
  - Monitor `app/temp/` disk usage to prevent overflow.

## License

ISC License. See `app/package.json` for details.