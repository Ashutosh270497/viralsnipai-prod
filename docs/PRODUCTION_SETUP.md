# ViralSnipAI — Production Setup Guide

Last updated: 2026-04-25

This guide covers a complete production deployment of the V1 core video-repurposing launch.
V2/V3 modules stay off by default; their feature flags are documented in `.env.example`.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20 LTS or later |
| pnpm | 9 or later |
| Prisma CLI | bundled via `pnpm --filter web exec prisma` |

---

## 1. Database — Supabase PostgreSQL

### Create a Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project.
2. Choose the **Singapore** region (lowest latency from India) or the region closest to your users.
3. Set a strong database password and save it — you will need it in the connection string.

### Get the connection string

1. Supabase Dashboard → **Settings** → **Database** → **Connection String** → **Prisma** tab.
2. Copy the **direct** (non-pooled) URL. It looks like:
   ```
   postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
   ```
3. Set this as `DATABASE_URL` in `apps/web/.env.local` (local) or in your deployment platform's env secrets (production).

> **Do not use the pgbouncer/pooled URL** for `DATABASE_URL`. NextAuth requires a direct connection for database sessions. If you need connection pooling for background jobs, use a separate `DATABASE_POOL_URL` variable.

### Apply the schema

```bash
pnpm --filter web exec prisma generate
pnpm --filter web exec prisma db push
```

`db push` applies the Prisma schema directly without migration history. For a production-grade flow,
use `prisma migrate deploy` instead if you have migrations set up.

### Seed demo data (optional)

```bash
pnpm seed
```

This creates a demo user and sample clips. Skip in production unless you want demo data.

---

## 2. Auth — NextAuth

### Configuration

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` and paste the output |
| `NEXTAUTH_URL` | Your production domain, e.g. `https://viralsnipai.com` |

### Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application type).
3. Add an authorised redirect URI: `https://yourdomain.com/api/auth/callback/google`
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 3. Storage

### Supabase Storage (recommended for V1)

1. Supabase Dashboard → **Storage** → **New bucket**.
2. Name it `viralsnipai-uploads`. Set it to **private** (the app generates signed URLs).
3. Get S3-compatible credentials from: Supabase Dashboard → **Settings** → **Storage** → **S3 Connection**.
4. Set in env:

```env
STORAGE_DRIVER="s3"
S3_ENDPOINT="https://<project-ref>.supabase.co/storage/v1/s3"
S3_BUCKET="viralsnipai-uploads"
S3_REGION="ap-south-1"
S3_PUBLIC_URL="https://<project-ref>.supabase.co/storage/v1/object/public"
S3_ACCESS_KEY_ID="<storage-access-key>"
S3_SECRET_ACCESS_KEY="<storage-secret-key>"
```

### Alternative: AWS S3 / Cloudflare R2

Set the same `S3_*` variables pointing at your chosen bucket provider.

---

## 4. AI Providers

### OpenRouter (primary text models)

1. Sign up at [openrouter.ai](https://openrouter.ai) and create an API key.
2. Set `OPENROUTER_API_KEY` and `OPENROUTER_ENABLED="true"`.
3. Optionally override per-feature model names using `OPENROUTER_*_MODEL` variables (see `.env.example`).

Current V1 model defaults:

```env
OPENROUTER_VIDEO_INGEST_MODEL="google/gemini-3-flash-preview"
OPENROUTER_HIGHLIGHTS_MODEL="google/gemini-3.1-pro-preview"
OPENROUTER_CAPTIONS_MODEL="google/gemini-3.1-flash-lite-preview"
OPENROUTER_HOOKS_MODEL="anthropic/claude-sonnet-4.6"
OPENROUTER_SCRIPTS_MODEL="anthropic/claude-sonnet-4.6"
```

Model routing rationale is documented in `docs/OPENROUTER_MODEL_ROUTING.md`.

### OpenAI Media Endpoints

1. Create a key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Set `OPENAI_API_KEY`.
3. Defaults: `TTS_MODEL=tts-1`, `WHISPER_MODEL=whisper-1`.

OpenAI is not used as a text/model fallback. V1 model generation is OpenRouter-only.

---

## 5. Billing — Razorpay

1. Create a Razorpay account at [dashboard.razorpay.com](https://dashboard.razorpay.com).
2. Activate your account (KYC) to enable live payments.
3. Get API keys: Dashboard → **Settings** → **API Keys**.
4. Create webhook: Dashboard → **Webhooks** → **Add New Webhook**.
   - URL: `https://yourdomain.com/api/webhooks/razorpay`
   - Events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.captured`
   - Copy the webhook secret.
5. Create subscription plans (one per tier × currency):
   - Dashboard → **Subscriptions** → **Plans** → **Create Plan**
   - Plans: `starter`, `creator`, `studio` in INR (and USD if needed)
   - Paste the plan IDs into `RAZORPAY_PLAN_ID_STARTER_INR`, etc.

```env
RAZORPAY_KEY_ID="rzp_live_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_..."
```

---

## 6. Inngest (Background Jobs)

1. Sign up at [inngest.com](https://www.inngest.com).
2. Create an app and copy the **Event Key** and **Signing Key**.
3. Set:

```env
INNGEST_EVENT_KEY="<your-inngest-event-key>"
INNGEST_SIGNING_KEY="<your-inngest-signing-key>"
```

4. The Inngest endpoint is served at `/api/inngest`. Register it in the Inngest dashboard after deployment.

---

## 7. Environment Variables — V1 Minimal Set

Use `.env.v1.example` as your starting template. The complete reference is in `.env.example`.

Required for V1:

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXTAUTH_SECRET
NEXTAUTH_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENROUTER_API_KEY
OPENAI_API_KEY
STORAGE_DRIVER + S3_* variables
RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET + NEXT_PUBLIC_RAZORPAY_KEY_ID
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_V1_CORE_ENABLED=true
NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false
NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false
UI_V2_ENABLED=true
NEXT_PUBLIC_UI_V2_ENABLED=true
MAX_UPLOAD_MB=500
MAX_VIDEO_DURATION_SECONDS=3600
V1_FREE_MONTHLY_UPLOAD_LIMIT=3
V1_FREE_MONTHLY_EXPORT_LIMIT=5
```

Production must use `STORAGE_DRIVER="s3"`. The upload API rejects production uploads when `STORAGE_DRIVER="local"` to avoid writing user media to ephemeral app disk.

---

## 8. Deployment

### Vercel (simplest)

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to `apps/web`.
4. Set **Framework** to `Next.js`.
5. Add all env variables from `.env.v1.example` (with real values) in **Settings → Environment Variables**.
6. Deploy.

After deploy, run the Prisma schema push via a one-off command runner or locally pointing at the production `DATABASE_URL`:

```bash
DATABASE_URL="<production-url>" pnpm --filter web exec prisma db push
```

### Coolify / VPS

1. Create a new app from the git repo.
2. Set build command: `pnpm --filter web build`
3. Set start command: `pnpm --filter web start`
4. Set the working directory to the repo root (Coolify handles monorepos via pnpm workspaces).
5. Inject all env variables from `.env.v1.example`.
6. Run the Prisma schema push after the first deployment:
   ```bash
   pnpm --filter web exec prisma db push
   ```

---

## 9. FFmpeg

The app ships with `ffmpeg-static` and `ffprobe-static` binaries. No action required for most deployments.

If you hit codec permission errors on the server:

1. Install native FFmpeg on the server.
2. Set `FFMPEG_PATH="/usr/bin/ffmpeg"` (or the correct path) in your env.

---

## 10. Production Checklist

```
[ ] DATABASE_URL points at the direct (non-pooled) Supabase connection string
[ ] prisma db push or prisma migrate deploy has been run against production DB
[ ] NEXTAUTH_SECRET is a unique 32-byte random string (never reuse dev secret)
[ ] NEXTAUTH_URL matches the production domain exactly (no trailing slash)
[ ] Google OAuth redirect URI is registered for the production domain
[ ] Razorpay account is activated (KYC complete) and using live keys
[ ] Razorpay webhook is registered and points at /api/webhooks/razorpay
[ ] Razorpay subscription plan IDs are set in env
[ ] S3/Supabase Storage bucket exists and S3_* variables are set
[ ] STORAGE_DRIVER="s3" (not "local") in production
[ ] OPENROUTER_API_KEY is set and OPENROUTER_ENABLED="true"
[ ] OPENAI_API_KEY is set (required for Whisper + TTS)
[ ] NEXT_PUBLIC_APP_URL matches production domain
[ ] NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED="false"
[ ] NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED="false"
[ ] No real secrets in .env.example or committed to git
[ ] Secrets previously committed have been rotated
[ ] Deployment platform env variables are set (not .env.local file)
[ ] Health check: GET /api/health returns 200
```

---

## Security Notes

- **No real secrets should ever be committed** to the repository, including `.env`, `.env.local`, or `.env.example` files.
- **Rotate any previously committed secrets.** If a key appeared in a commit, treat it as compromised:
  - Supabase: rotate from Settings → API → Reset keys
  - NextAuth: generate a new `NEXTAUTH_SECRET` (invalidates all sessions)
  - Google OAuth: rotate in Google Cloud Console
  - Razorpay: rotate in Dashboard → Settings → API Keys
  - OpenAI/OpenRouter: delete and re-create the key
- **Production secrets live only in the deployment platform** (Vercel env vars, Coolify secrets, VPS env injection). Never bake them into Docker images or deployment scripts.
