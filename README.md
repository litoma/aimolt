# Aimolt Discord Bot

Aimolt is a Discord bot powered by Gemini AI and Supabase, designed to respond to text messages and transcribe voice messages. It supports:

- **Text Responses**: Reply to messages with 👍 reactions or `/ask` slash command, using Gemini AI with conversation history stored in Supabase.
- **Voice Transcription**: Transcribe `.ogg` voice messages with 🎤 reactions, powered by Gemini AI.

## Features

- Responds to text messages via 👍 reactions or `/ask` command with context-aware replies.
- Transcribes `.ogg` voice messages when reacted with 🎤, displaying results in the chat.
- Stores conversation history in Supabase for contextual responses.
- Uses PM2 for process management in production.

## Prerequisites

- **Node.js**: v18 or later.
- **Discord Bot Token**: Create a bot on [Discord Developer Portal](https://discord.com/developers/applications).
- **Gemini API Key**: Obtain from [Google AI Studio](https://makersuite.google.com/).
- **Supabase Project**: Set up a project with a `conversations` table (`user_id: string`, `message: jsonb`, `created_at: timestamp`).
- **PM2**: For running the bot in production.

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/aimolt.git
   cd aimolt
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` with your credentials:
     ```plaintext
     DISCORD_TOKEN=your_discord_bot_token
     DISCORD_APPLICATION_ID=your_application_id
     DISCORD_GUILD_ID=your_guild_id
     GEMINI_API_KEY=your_gemini_api_key
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     ```

4. **Create Temp Directory**:
   ```bash
   mkdir temp
   chmod 755 temp
   ```

5. **Configure systemInstruction**:
   - Edit `config.js` to define `systemInstruction` for Gemini AI:
     ```javascript
     module.exports = {
       systemInstruction: 'You are Aimolt, a friendly Discord bot. Respond in Japanese with a fun tone, using emojis like 😄 and 😉.'
     };
     ```

6. **Run the Bot**:
   - Using PM2 (recommended for production):
     ```bash
     pm2 start ecosystem.config.js
     pm2 save
     ```
   - Or directly:
     ```bash
     npm start
     ```

## Usage

1. **Text Interaction**:
   - Send a message and add a 👍 reaction to get a response.
   - Use the `/ask` slash command: `/ask query: Hello, how are you?`
   - The bot maintains conversation history for contextual replies.

2. **Voice Transcription**:
   - Send a `.ogg` voice message and add a 🎤 reaction.
   - The bot transcribes the audio and posts the text in the chat, prefixed with "🎉 文字起こしが完了したよ〜！".

3. **Restarting the Bot**:
   ```bash
   pm2 stop aimolt || true && pm2 start ecosystem.config.js && pm2 save
   ```

## Dependencies

- `@google/generative-ai`: ^0.24.1 (Gemini AI for text and audio processing)
- `@supabase/supabase-js`: ^2.50.1 (Conversation history storage)
- `discord.js`: ^14.20.0 (Discord bot functionality)
- `dotenv`: ^16.5.0 (Environment variable management)

Install with:
```bash
npm install @google/generative-ai @supabase/supabase-js discord.js dotenv
```

## Project Structure

- `index.js`: Main bot logic (slash commands, reaction handling).
- `transcribe.js`: Handles 🎤 reactions for voice transcription.
- `react.js`: Handles 👍 reactions for text responses.
- `config.js`: System instruction for Gemini AI.
- `package.json`: Project metadata and dependencies.
- `.env`: Environment variables (not committed).
- `temp/`: Temporary storage for `.ogg` files (auto-deleted after transcription).

## Troubleshooting

- **Bot not responding**:
  - Check logs: `pm2 logs aimolt`.
  - Verify `.env` credentials and `config.js`.
- **Transcription errors**:
  - Ensure `.ogg` files are valid and under 100MB.
  - Check `temp/` permissions: `chmod -R 755 temp`.
- **Conversation history issues**:
  - Query Supabase: `SELECT user_id, message FROM conversations WHERE user_id = '<your_user_id>';`.
  - Verify Supabase credentials in `.env`.

## License

ISC License. See `package.json` for details.
