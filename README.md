# Aimolt Discord Bot

Aimolt is a Discord bot powered by Gemini AI and Supabase, designed to respond to text messages, provide detailed explanations, and transcribe voice messages. It supports:

- **Text Responses**: Reply to messages with 👍 reactions or `/ask` slash command, using Gemini AI with conversation history stored in Supabase.
- **Explanations**: Provide detailed explanations for messages with ❓ reactions, including embedded content.
- **Voice Transcription**: Transcribe `.ogg` voice messages with 🎤 reactions, powered by Gemini AI.

## Features

- Responds to text messages via 👍 reactions or `/ask` command with context-aware replies.
- Explains message content in detail with ❓ reactions, including embedded content, using a custom prompt.
- Transcribes `.ogg` voice messages when reacted with 🎤, displaying results in the chat.
- Stores conversation history in Supabase for contextual responses.
- Uses PM2 for process management in production.

## Prerequisites

- **Node.js**: v18 or later.
- **Discord Bot Token**: Create a bot on [Discord Developer Portal](https://discord.com/developers/applications).
- **Gemini API Key**: Obtain from [Google AI Studio](https://makersuite.google.com/).
- **Supabase Project**: Set up a project with a `conversations` table (`user_id: string`, `message: jsonb`, `created_at: timestamp`).
- **PM2**: For running the bot in production (`npm install -g pm2`).
- **Git**: For version control and GitHub deployment.

## Installation

1. **Clone the Repository** (if starting from scratch):
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
     DISCORD_BOT_TOKEN=your_discord_bot_token
     DISCORD_APPLICATION_ID=your_application_id
     DISCORD_GUILD_ID=your_guild_id
     GEMINI_API_KEY=your_gemini_api_key
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     ```

4. **Create Temp Directory**:
   - For voice transcription storage:
     ```bash
     mkdir temp
     chmod 755 temp
     ```

5. **Configure systemInstruction**:
   - Edit `config.js` to define `systemInstruction` for Gemini AI:
     ```javascript
     module.exports = {
       systemInstruction: { parts: [{ text: 'You are Aimolt, a friendly Discord bot. Respond in Japanese with a fun tone, using emojis like 😄 and 😉.' }] }
     };
     ```

## Deploy to GitHub

To share your project on GitHub, follow these steps:

1. **Install Git** (if not already installed):
   - Verify installation:
     ```bash
     git --version
     ```
   - Install Git if needed (e.g., on Ubuntu):
     ```bash
     sudo apt update
     sudo apt install git
     ```

2. **Create a `.gitignore` File**:
   - Create a `.gitignore` file in the project root to exclude sensitive or temporary files:
     ```bash
     echo -e "node_modules/\n.env\ntemp/" > .gitignore
     ```

3. **Initialize a Git Repository**:
   - Initialize a local Git repository:
     ```bash
     git init
     ```

4. **Add Files to Git**:
   - Add all project files (excluding those in `.gitignore`):
     ```bash
     git add .
     ```

5. **Commit Changes**:
   - Create an initial commit:
     ```bash
     git commit -m "Initial commit of Aimolt Discord Bot"
     ```

6. **Create a GitHub Repository**:
   - Go to [GitHub](https://github.com/new) and create a new repository (e.g., `aimolt`).
   - Choose public or private based on your preference.
   - Do **not** initialize with a README, `.gitignore`, or license (as they are already in your project).

7. **Link Local Repository to GitHub**:
   - Add the remote repository (replace `<your-username>` and `aimolt` with your GitHub username and repository name):
     ```bash
     git remote add origin https://github.com/<your-username>/aimolt.git
     ```

8. **Push to GitHub**:
   - Push your local repository to GitHub:
     ```bash
     git push -u origin main
     ```
   - If prompted, authenticate with your GitHub credentials or a personal access token.

9. **Verify on GitHub**:
   - Visit `https://github.com/<your-username>/aimolt` to confirm your files are uploaded.

## Usage

1. **Run the Bot**:
   - Using PM2 (recommended for production):
     ```bash
     pm2 start ecosystem.config.js
     pm2 save
     ```
   - Or directly:
     ```bash
     npm start
     ```

2. **Text Interaction**:
   - Send a message and add a 👍 reaction to get a response.
   - Use the `/ask` slash command: `/ask query: Hello, how are you?`
   - Add a ❓ reaction to get a detailed explanation of a message.
   - The bot maintains conversation history for contextual replies.

3. **Voice Transcription**:
   - Send a `.ogg` voice message and add a 🎤 reaction.
   - The bot transcribes the audio and posts the text in the chat, prefixed with "🎉 文字起こしが完了したよ〜！".

4. **Restarting the Bot**:
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
npm install @google/generative-ai@0.24.1 @supabase/supabase-js@2.50.1 discord.js@14.20.0 dotenv@16.5.0
```

## Project Structure

- `index.js`: Main bot logic (slash commands, reaction handling).
- `explain.js`: Handles ❓ reactions for detailed message explanations.
- `react.js`: Handles 👍 reactions for text responses.
- `transcribe.js`: Handles 🎤 reactions for voice transcription.
- `config.js`: System instruction for Gemini AI.
- `prompt/like_reaction.txt`: Prompt for 👍 reactions.
- `prompt/question_explain.txt`: Prompt for ❓ reactions.
- `package.json`: Project metadata and dependencies.
- `.env`: Environment variables (not committed).
- `temp/`: Temporary storage for `.ogg` files (auto-deleted after transcription).
- `.gitignore`: Excludes `node_modules/`, `.env`, and `temp/`.

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
- **GitHub push errors**:
  - Ensure Git is installed and configured: `git config --global user.name "Your Name"` and `git config --global user.email "your.email@example.com"`.
  - Check remote URL: `git remote -v`.
  - If authentication fails, generate a personal access token in GitHub settings and use it for `git push`.

## License

ISC License. See `package.json` for details.
