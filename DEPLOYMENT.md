# Deno Deploy Deployment Guide

## 1. Prerequisites
- Deno Account (Created)
- GitHub Account (Recommended for automatic deployment)

## 2. Environment Variables
You must set the following names in your Deno Deploy Project Settings:

| Key | Value Source | Description |
| :--- | :--- | :--- |
| `DISCORD_BOT_TOKEN` | `.env` | **Important**: Use the Bot Token, not ID. |
| `SUPABASE_URL` | `.env` | URL of your Supabase instance. |
| `SUPABASE_KEY` | `.env` | Anon (public) key for Supabase. |
| `GEMINI_API_KEY` | `.env` | Google Gemini API Key. |
| `GEMINI_AI_MODEL` | `.env` | e.g., `gemini-pro` or `gemini-1.5-flash`. |
| `OBSIDIAN_URL` | `.env` | **Note**: Only works if Deno Deploy can reach this URL (e.g. via Tunnel/Tailscale). If localhost, it won't work on Deploy. |
| `OBSIDIAN_API` | `.env` | API Token for Obsidian Local REST. |
| `CONVERSATION_LIMIT` | `100` | Optional. |

> **⚠️ Important regarding Obsidian**:
> `OBSIDIAN_URL` pointing to `http://localhost:...` or a private IP will **NOT** work on Deno Deploy because it runs in the cloud. You would need a secure tunnel (like Cloudflare Tunnel or ngrok) to expose your local Obsidian API, or accept that Memo feature only works locally.

## 3. Deployment Methods

### Option A: Connect via GitHub (Recommended)
1. Push this `deno-bot` directory to a GitHub repository.
2. Go to [Deno Deploy Dashboard](https://dash.deno.com).
3. Click **"New Project"**.
4. Select **"Git Hub"** and choose your repository.
5. Select **Entrypoint**: `main.ts` (Repository Root).
6. Click **"Link"**.
7. Go to **Settings** -> **Environment Variables** and add the keys listed above.

### Option B: Deploy via CLI (`deployctl`)
If you want to deploy from this terminal directly:

1. Install `deployctl`:
   ```bash
   deno install -AArgf jsr:@deno/deployctl
   ```
2. Create an Access Token at [Deno Deploy Access Tokens](https://dash.deno.com/user/access-tokens).
3. Run deployment:
   ```bash
   deployctl deploy --project=<project-name> --entrypoint=main.ts --include=src,deno.json
   ```
   (You will be prompted for the token or setting `DENO_DEPLOY_TOKEN` env var).

## 4. Verification
- After deployment, Discordeno should connect automatically.
- Check the **Logs** tab in Deno Deploy to see `[Main] Logged in as ...`.
