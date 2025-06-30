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
   git clone https://github.com/<your-username>/aimolt.git
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
     POSTGRES_PASSWORD=your_postgres_password
     POSTGRES_DB=aimolt
     CONVERSATION_LIMIT=100
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
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY,
    user_id TEXT NOT NULL UNIQUE,
    message JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id);
```

- **id**: Auto-incrementing primary key (BIGINT).
- **user_id**: Discord user ID (TEXT, unique).
- **message**: Conversation history as JSONB (array of `{ role: string, parts: [{ text: string }]`).
- **created_at**: Timestamp of the last update.
- **idx_conversations_user_id**: Index on `user_id` for faster queries.

To query the history:
```bash
psql -h localhost -U postgres -d aimolt -c "SELECT user_id, array_length(message, 1) FROM conversations;"
```

For Supabase, the same schema is used. Ensure `SUPABASE_URL` and `SUPABASE_KEY` are set in `app/.env`.

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
- **Localization**:
  - Support English responses for non-Japanese users.
- **Monitoring**:
  - Add health checks for Supabase/PostgreSQL connectivity.
  - Monitor `app/temp/` disk usage to prevent overflow.

## For Grok Handover

To ensure seamless handover to another Grok session, the following details are provided:
- **Environment**: Ubuntu (e.g., 20.04), Node.js v18.x, Docker (postgres:15), PM2.
- **Deployment**: Runs in `/home/ubuntu/discord`. Use `app/ecosystem.config.js` for PM2 (`script: ./src/index.js`, `cwd: /home/ubuntu/discord/app`).
- **Database**: Local PostgreSQL (`db/data/`, `db/initial.sql`) and Supabase (`conversations` table).
- **Known Issues**:
  - 👍 reactions occasionally fail with "うわっ、なんかミスっちゃったみたい！🙈" (Gemini API or history errors; check logs).
  - Typing Indicator ("aimoltが返信中…") not always displayed (add `channel.startTyping()` as needed).
- **Logs**: Use `pm2 logs aimolt` for debugging. Key errors: `ENOENT` (file not found), `EACCES` (permission denied).
- **Maintenance**:
  - Clear `app/temp/` periodically: `find app/temp -type f -name "*.ogg" -mtime +1 -delete`.
  - Monitor Supabase storage (free tier: 500MB).
- **Contact**: For issues, ping the bot owner on Discord or check GitHub issues.

## License

ISC License. See `app/package.json` for details.
