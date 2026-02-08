# AImolt Discord Bot (NestJS + Docker)

AImolt is a multi-functional Discord bot powered by **Gemini 1.5 Pro/Flash** and **Supabase (PostgreSQL)**, built with **NestJS**.
Designed for deployment on **Koyeb** (or any Docker-compatible platform) to ensure persistent WebSocket connections for real-time interactions.

## 🚀 Features

- **Text Response**: Intelligent replies using Gemini API (context-aware).
- **Voice Transcription**: 🎤 React to voice messages to transcribe them (using Gemini).
- **Memo**: 📝 React to save messages to Obsidian (via local proxy or API).
- **Personality System**: VAD-based emotion simulation and relationship management.
- **Dockerized**: Fully containerized for easy deployment.

## 📂 Project Structure

```
aimolt/
├── src/                   # NestJS Source Code
│   ├── discord/           # Discord.js Gateway & Events
│   ├── ai/                # Gemini Service
│   └── ...
├── Dockerfile             # Multi-stage Docker build
├── ecosystem.config.js    # PM2 Configuration
├── nest-cli.json          # NestJS Config
└── README.md
```

## 🛠️ Setup & Development

### Prerequisites
- Node.js v22+
- Docker (optional, for container testing)
- PostgreSQL (Supabase)

### Local Dev
1.  **Configure Environment**:
    Create `.env` based on your project settings.
    ```env
    DISCORD_TOKEN=...
    GEMINI_API_KEY=...
    SUPABASE_URL=...
    SUPABASE_KEY=...
    ```

2.  **Install & Run**:
    ```bash
    npm install
    npm run start:dev
    ```

## ☁️ Deployment (Koyeb)

This repository is optimized for **Koyeb**.

1.  **Push to GitHub**.
2.  Create a new App on [Koyeb](https://app.koyeb.com).
3.  Select this repository.
4.  Set Environment Variables (`DISCORD_TOKEN`, etc.).
5.  **Deploy**.
    - Koyeb automatically builds using the `Dockerfile`.
    - PM2 manages the process inside the container.

## 🐳 Docker (Local)

```bash
# Build
docker build -t aimolt .

# Run
docker run --env-file .env aimolt
```

## 📄 License
ISC License