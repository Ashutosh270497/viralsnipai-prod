# Production Deployment Checklist — ViralSnipAI (X-First Launch)

> Last updated: 2026-03-17
> Stack: Next.js 14 + Prisma + PostgreSQL (Supabase) + Inngest + Razorpay + Coolify
> Server: Hostinger KVM 2 (2 vCPU / 8GB RAM / 100GB NVMe)
> Deployment tool: **Coolify Self-Hosted (free)** — recommended over Coolify Cloud for single-VPS setup

## Launch Gate

This checklist is for production deployment preparation, not proof that launch blockers are already closed.

Before treating the product as launch-ready, review:
- `docs/snipradar_wave0_baseline.md`
- `docs/snipradar_launch_execution_board.md`

Do not start the public launch until all `launch_blocker` items in the execution board are complete.

---

## PHASE 0 — Code Changes (Already Done)

- [x] YouTube ecosystem gated behind `NEXT_PUBLIC_YOUTUBE_ECOSYSTEM_ENABLED` flag
  - File: `apps/web/components/layout/ecosystem-select-screen.tsx`
  - Default: `"false"` — only X card is shown; YouTube card shows "Coming Soon"
  - To unlock YouTube later: set env to `"true"` in Coolify + redeploy (no code change needed)
- [x] OpenRouter-first routing added for the 5 remaining SnipRadar AI files
  - `lib/ai/growth-planner.ts`
  - `lib/ai/winner-loop.ts`
  - `lib/ai/growth-coach.ts`
  - `lib/ai/research-inbox.ts`
  - `lib/ai/profile-audit.ts`
- [ ] Remaining direct OpenAI fallback policy reviewed and either removed or explicitly accepted before launch
- [x] Diagnostics tab wired into SnipRadar Publish page
- [x] Pricing config — taglines, bullets, comparison table (15 rows)
- [x] Thread composer — mobile tip + preview toggle hidden on small screens
- [x] `.env.example` updated with `NEXT_PUBLIC_YOUTUBE_ECOSYSTEM_ENABLED`

---

## PHASE 1 — Pre-Launch: One-Time Secret Generation

Run these locally and save the output — you will paste them into Coolify env vars.

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# SNIPRADAR_SCHEDULER_CRON_SECRET
openssl rand -hex 32

# SNIPRADAR_MAINTENANCE_CRON_SECRET
openssl rand -hex 32

# KEYWORD_MAINTENANCE_CRON_SECRET
openssl rand -hex 32

# INGEST_SECRET
openssl rand -hex 32
```

- [ ] All 5 secrets generated and saved securely (password manager / notes)

---

## PHASE 2 — Third-Party Configuration

### 2A — Google OAuth
- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com) → your project → Credentials → OAuth 2.0 Client IDs
- [ ] Add **Authorized redirect URI**: `https://yourdomain.com/api/auth/callback/google`
- [ ] Remove `http://localhost:3000/api/auth/callback/google` from production OAuth client (or use a separate client for prod)

### 2B — X (Twitter) Developer Portal
- [ ] Go to [developer.twitter.com](https://developer.twitter.com) → your app → Settings
- [ ] Add **Callback URL**: `https://yourdomain.com/api/snipradar/callback`
- [ ] Add **Website URL**: `https://yourdomain.com`
- [ ] Confirm OAuth 2.0 with PKCE is enabled
- [ ] Copy updated `X_CLIENT_ID` and `X_CLIENT_SECRET`

### 2C — Razorpay Plans
- [ ] Log in to [dashboard.razorpay.com](https://dashboard.razorpay.com)
- [ ] Go to **Subscriptions → Plans → Create Plan**
- [ ] Create **Starter plan** (₹699/month):
  - Name: `ViralSnipAI Starter`
  - Billing amount: `69900` (paise — Razorpay uses smallest currency unit)
  - Period: `monthly` | Interval: `1`
  - Copy plan ID → `RAZORPAY_PLAN_ID_PLUS_INR`
- [ ] Create **Creator plan** (₹1499/month):
  - Name: `ViralSnipAI Creator`
  - Billing amount: `149900`
  - Copy plan ID → `RAZORPAY_PLAN_ID_PRO_INR`
- [ ] Note: USD plans (`RAZORPAY_PLAN_ID_PLUS_USD`, `RAZORPAY_PLAN_ID_PRO_USD`) are optional for India-first launch

### 2D — Inngest
- [ ] Create account at [app.inngest.com](https://app.inngest.com)
- [ ] Create a new app/environment (e.g. `viralsnipai-production`)
- [ ] Copy **Event Key** → `INNGEST_EVENT_KEY`
- [ ] Copy **Signing Key** → `INNGEST_SIGNING_KEY`

### 2E — OpenRouter
- [ ] Create account at [openrouter.ai](https://openrouter.ai)
- [ ] Generate API key → `OPENROUTER_API_KEY`
- [ ] Add billing credits (recommended: $20 to start)

---

## PHASE 3 — VPS Setup (Hostinger KVM 2)

### 3A — SSH Into Server
```bash
ssh root@<your-hostinger-vps-ip>
```

### 3B — System Update
```bash
apt update && apt upgrade -y
apt install -y curl git
```

### 3C — Install Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
docker --version   # verify
```

### 3D — Install Coolify
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

- Wait ~2 minutes for Coolify to start
- [ ] Open `http://<your-vps-ip>:8000` in browser
- [ ] Complete Coolify registration (first user = admin)
- [ ] Go to **Servers → Add Server → Localhost** and verify the server shows as healthy

### 3E — Configure Firewall
```bash
ufw allow 22      # SSH
ufw allow 80      # HTTP (Coolify handles redirect to HTTPS)
ufw allow 443     # HTTPS
ufw allow 8000    # Coolify dashboard (optional: restrict to your IP only)
ufw enable
```

---

## PHASE 4 — Domain + DNS

- [ ] Log in to your domain registrar
- [ ] Add DNS A record: `@` → `<your Hostinger KVM 2 IP>`
- [ ] Add DNS A record: `www` → `<your Hostinger KVM 2 IP>`
- [ ] Wait 5–30 minutes for propagation
- [ ] Verify: `dig yourdomain.com` should return your VPS IP

---

## PHASE 5 — Add App in Coolify

1. [ ] **Projects → New Project** → name: `viralsnipai`
2. [ ] **New Resource → Application → GitHub**
   - Connect GitHub account (Coolify OAuth or SSH deploy key)
   - Select the `clippers` repository
   - Branch: `main`
3. [ ] **Build settings:**
   - Build pack: `Nixpacks` (auto-detects Next.js + pnpm monorepo)
   - Root directory: `apps/web`
   - Build command: `pnpm build`
   - Start command: `pnpm start`
   - Port: `3000`
4. [ ] **Domains:** Add `yourdomain.com` and `www.yourdomain.com`
   - Coolify auto-provisions Let's Encrypt SSL
5. [ ] Enable **Auto-deploy on push** (optional — safe since you control the `main` branch)

---

## PHASE 6 — Environment Variables in Coolify

Go to your app → **Environment Variables** tab. Add each of the following.

> **Important:** Never commit real secrets to git. Set all sensitive values only in Coolify.

### Core App
```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
LOG_LEVEL=info
```

### Database (Supabase)
```
DATABASE_URL=<supabase connection string — Transaction mode pooler, port 6543>
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SECRET_KEY=<your service role key>
```

### Auth (NextAuth)
```
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generated in Phase 1>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

### X / SnipRadar
```
X_CLIENT_ID=<from X Developer Portal>
X_CLIENT_SECRET=<from X Developer Portal>
X_CALLBACK_URL=https://yourdomain.com/api/snipradar/callback
X_API_KEY=<from X Developer Portal>
X_API_SECRET=<from X Developer Portal>
X_CONSUMER_KEY=<from X Developer Portal>
X_ACCESS_TOKEN=<from X Developer Portal>
SNIPRADAR_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_ENABLED=true
SNIPRADAR_V2_OVERVIEW_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_OVERVIEW_ENABLED=true
SNIPRADAR_V2_ANALYTICS_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_ANALYTICS_ENABLED=true
SNIPRADAR_V2_CREATE_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_CREATE_ENABLED=true
SNIPRADAR_V2_DISCOVER_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_DISCOVER_ENABLED=true
SNIPRADAR_V2_PUBLISH_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_PUBLISH_ENABLED=true
SNIPRADAR_V2_GROWTH_PLAN_ENABLED=true
NEXT_PUBLIC_SNIPRADAR_V2_GROWTH_PLAN_ENABLED=true
SNIPRADAR_SCHEDULER_CRON_SECRET=<generated in Phase 1>
SNIPRADAR_MAINTENANCE_CRON_SECRET=<generated in Phase 1>
SNIPRADAR_SCHEDULER_USER_DISPATCH_LIMIT=200
SNIPRADAR_SCHEDULER_PER_USER_LIMIT=25
SNIPRADAR_SCHEDULER_CRON_CONCURRENCY=10
```

### Ecosystem Gates
```
NEXT_PUBLIC_YOUTUBE_ECOSYSTEM_ENABLED=false
```

### AI — OpenRouter (Primary)
```
OPENROUTER_API_KEY=<your openrouter key>
OPENROUTER_ENABLED=true
```

### AI — OpenAI (Fallback + DALL-E + Whisper)
```
OPENAI_API_KEY=<your openai key>
OPENAI_MODEL=gpt-5-mini
TTS_MODEL=tts-1
WHISPER_MODEL=whisper-1
DALLE_MODEL=dall-e-3
```

### Billing — Razorpay
```
RAZORPAY_KEY_ID=<from Razorpay dashboard>
RAZORPAY_KEY_SECRET=<from Razorpay dashboard>
RAZORPAY_WEBHOOK_SECRET=<set after creating webhook in Phase 7>
NEXT_PUBLIC_RAZORPAY_KEY_ID=<same as RAZORPAY_KEY_ID>
RAZORPAY_PLAN_ID_PLUS_INR=<plan ID from Phase 2C>
RAZORPAY_PLAN_ID_PRO_INR=<plan ID from Phase 2C>
```

### Inngest (Background Jobs)
```
INNGEST_EVENT_KEY=<from app.inngest.com>
INNGEST_SIGNING_KEY=<from app.inngest.com>
```

### Storage
```
STORAGE_DRIVER=s3
S3_ENDPOINT=<your s3 endpoint>
S3_BUCKET=<your bucket name>
S3_REGION=us-east-1
S3_PUBLIC_URL=<public base URL>
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
```
> If not using S3 yet: `STORAGE_DRIVER=local` and `LOCAL_UPLOAD_DIR=./uploads`

### Feature Flags
```
VOICER_ENABLED=true
NEXT_PUBLIC_VOICER_ENABLED=true
IMAGEN_ENABLED=false
NEXT_PUBLIC_IMAGEN_ENABLED=false
VEO_ENABLED=false
NEXT_PUBLIC_VEO_ENABLED=false
FORCE_VEO_ENABLED=false
SORA_ENABLED=false
NEXT_PUBLIC_SORA_ENABLED=false
TRANSCRIBE_UI_ENABLED=false
NEXT_PUBLIC_TRANSCRIBE_UI_ENABLED=false
```

---

## PHASE 7 — Database Migration

Run this from your local machine before the first deploy hits production traffic:

```bash
cd apps/web
DATABASE_URL="<production supabase connection string>" pnpm prisma migrate deploy
```

- [ ] Migration ran successfully with no errors
- [ ] Verify in Supabase dashboard → Table Editor that all tables exist

---

## PHASE 8 — First Deploy

1. [ ] In Coolify → your app → click **Deploy**
2. [ ] Watch build logs — first build takes ~3–5 minutes
3. [ ] Common failure causes:
   - Missing env var → check build output for `undefined` errors
   - Wrong root directory → must be `apps/web`
   - pnpm version mismatch → add `PNPM_VERSION=8` env var if needed
4. [ ] Deploy completes with status **Running**

---

## PHASE 9 — Post-Deploy Configuration

### 9A — Register Razorpay Webhook
1. [ ] Razorpay Dashboard → **Settings → Webhooks → Add Webhook**
2. [ ] URL: `https://yourdomain.com/api/billing/webhook/razorpay`
3. [ ] Select events:
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.halted`
   - `payment.captured`
   - `payment.failed`
4. [ ] Copy the webhook secret
5. [ ] Update `RAZORPAY_WEBHOOK_SECRET` in Coolify env → redeploy

### 9B — Verify Inngest Registration
1. [ ] In Inngest dashboard → **Apps** → your app should appear as registered
2. [ ] Verify cron functions are listed:
   - Viral tweet fetch (every 6h)
   - Scheduler execution
   - Maintenance cleanup
3. [ ] If not auto-registered: visit `https://yourdomain.com/api/inngest` in browser to trigger sync

### 9C — Disable Dev Bypass in Production
- [ ] File: `apps/web/app/api/auth/dev-bypass/route.ts`
- [ ] Add at the top of the POST handler:
  ```typescript
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  ```
- [ ] Commit and redeploy via Coolify

---

## PHASE 10 — Smoke Test Checklist

Run through every item below after first successful deploy.

### Auth + Ecosystem
- [ ] `https://yourdomain.com` loads with valid SSL (no browser warning)
- [ ] `/signin` → Google OAuth flow completes → redirects to `/ecosystem/select`
- [ ] Ecosystem select screen shows **only X card** (YouTube shows "Coming Soon" badge)
- [ ] Clicking X card redirects to `/snipradar/overview`
- [ ] `/signin?dev-bypass=true` returns 404 (not accessible in production)

### SnipRadar Core Flow
- [ ] Connect X account → OAuth 2.0 PKCE flow completes without error
- [ ] `/api/snipradar/health` returns `200` with `account.connected: true`
- [ ] Add a tracked account (Tracker tab) → account appears in list
- [ ] Viral tweet feed loads (may be empty on first run — that's expected)
- [ ] Compose and schedule a draft tweet
- [ ] Publish → Diagnostics tab loads all 4 cards without errors
- [ ] AI provider card shows `openrouter` as active provider

### Billing
- [ ] Billing page loads at `/billing`
- [ ] Click "Upgrade" → Razorpay checkout modal opens with correct plan price
- [ ] Test payment with Razorpay test credentials (use test mode first)
- [ ] Webhook received in Razorpay dashboard logs

### Background Jobs
- [ ] Inngest dashboard shows cron runs firing on schedule
- [ ] No failed runs in first 24 hours

### Performance
- [ ] `/api/snipradar/health` responds in < 500ms
- [ ] Homepage loads in < 3s on a 4G connection (check with browser DevTools → Network → throttle)

---

## PHASE 11 — Monitoring Setup (Post-Launch)

### Coolify Health Checks
- [ ] In Coolify → your app → **Health Check**
  - Path: `/api/health`
  - Interval: 30s
  - Unhealthy threshold: 3

### Uptime Monitoring (Free Option)
- [ ] Sign up at [uptimerobot.com](https://uptimerobot.com) (free tier)
- [ ] Add monitor: `https://yourdomain.com` (HTTP, every 5 min)
- [ ] Add monitor: `https://yourdomain.com/api/snipradar/health`
- [ ] Set alert email/Telegram for downtime

### Error Monitoring (Optional but Recommended)
- [ ] Add [Sentry](https://sentry.io) free tier
  - Install: `pnpm add @sentry/nextjs` in `apps/web`
  - `SENTRY_DSN=<your dsn>` in Coolify env

---

## PHASE 12 — YouTube Ecosystem Unlock (Future)

When ready to open YouTube features:

1. [ ] In Coolify → Environment Variables:
   ```
   NEXT_PUBLIC_YOUTUBE_ECOSYSTEM_ENABLED=true
   ```
2. [ ] Trigger redeploy (takes ~2 minutes, rolling deploy — zero downtime)
3. [ ] YouTube card now appears as clickable on `/ecosystem/select`
4. [ ] No code changes required — flag-gated at build time

Additional YouTube env vars to add at that time:
```
YOUTUBE_API_KEY=<google youtube data api v3 key>
DATAFORSEO_LOGIN=<optional>
DATAFORSEO_PASSWORD=<optional>
KEYWORD_MAINTENANCE_CRON_SECRET=<generated in Phase 1>
ALLOW_YOUTUBE_MOCK_DATA=false
```

---

## Quick Reference — Key URLs After Deploy

| Purpose | URL |
|---------|-----|
| App homepage | `https://yourdomain.com` |
| Coolify dashboard | `http://<vps-ip>:8000` |
| SnipRadar overview | `https://yourdomain.com/snipradar/overview` |
| Health check | `https://yourdomain.com/api/snipradar/health` |
| Inngest webhook | `https://yourdomain.com/api/inngest` |
| Razorpay webhook | `https://yourdomain.com/api/billing/webhook/razorpay` |
| Billing page | `https://yourdomain.com/billing` |

---

## Quick Reference — Secrets Checklist

| Secret | Where to Get | Env Var Name |
|--------|-------------|--------------|
| NextAuth secret | `openssl rand -base64 32` | `NEXTAUTH_SECRET` |
| Google Client ID | Google Cloud Console | `GOOGLE_CLIENT_ID` |
| Google Client Secret | Google Cloud Console | `GOOGLE_CLIENT_SECRET` |
| X Client ID | X Developer Portal | `X_CLIENT_ID` |
| X Client Secret | X Developer Portal | `X_CLIENT_SECRET` |
| Razorpay Key ID | Razorpay Dashboard | `RAZORPAY_KEY_ID` |
| Razorpay Key Secret | Razorpay Dashboard | `RAZORPAY_KEY_SECRET` |
| Razorpay Webhook Secret | After creating webhook | `RAZORPAY_WEBHOOK_SECRET` |
| Razorpay Starter Plan ID | After creating plan | `RAZORPAY_PLAN_ID_PLUS_INR` |
| Razorpay Creator Plan ID | After creating plan | `RAZORPAY_PLAN_ID_PRO_INR` |
| OpenRouter API Key | openrouter.ai/keys | `OPENROUTER_API_KEY` |
| OpenAI API Key | platform.openai.com | `OPENAI_API_KEY` |
| Inngest Event Key | app.inngest.com | `INNGEST_EVENT_KEY` |
| Inngest Signing Key | app.inngest.com | `INNGEST_SIGNING_KEY` |
| Scheduler cron secret | `openssl rand -hex 32` | `SNIPRADAR_SCHEDULER_CRON_SECRET` |
| Maintenance cron secret | `openssl rand -hex 32` | `SNIPRADAR_MAINTENANCE_CRON_SECRET` |
| Supabase service key | Supabase Dashboard → API | `SUPABASE_SECRET_KEY` |

---

## Marketing with X Automation (Post-Launch Playbook)

1. **Day 0** — Connect your own X account to SnipRadar and enable the scheduler
2. **Day 1** — Track 5–10 accounts in your niche (SaaS founders, indie hackers, content creators)
3. **Day 1–7** — Post once daily using SnipRadar-generated drafts; let the scheduler handle timing
4. **Day 7** — Post a public thread: "Week 1 results using my own AI tool" with screenshots of:
   - SnipRadar analytics (engagement rate, scheduled posts)
   - Diagnostics tab (scheduler success rate)
   - Follower count delta
5. **Repeat weekly** — this becomes your living case study and primary acquisition channel
6. **Add the link in bio** → `yourdomain.com` after your first results thread

---

*Generated: 2026-03-17 | Product: ViralSnipAI | Server: Hostinger KVM 2 | Deployment: Coolify Self-Hosted*
