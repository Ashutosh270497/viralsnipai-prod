# ViralSnipAI V1 Beta — Launch Checklist

Last updated: 2026-04-25  
Product: V1 Core Video Repurposing  
Stack: Next.js 14 · Supabase PostgreSQL · Razorpay · OpenAI/OpenRouter · S3-compatible storage

Work through each section top-to-bottom before opening beta access. Check each item when confirmed.

---

## 1. Environment

- [ ] `apps/web/.env.local` is NOT committed to git (verify with `git status`)
- [ ] `.env.example` contains only placeholder values — no real secrets
- [ ] All `<placeholder>` values in `.env.v1.example` are filled in the deployment platform
- [ ] `NEXT_PUBLIC_APP_URL` matches the production domain exactly (no trailing slash)
- [ ] `NEXTAUTH_URL` matches the production domain
- [ ] `NODE_ENV=production` is set by the deployment platform
- [ ] Run `pnpm --filter web exec next build` locally — zero build errors

---

## 2. Auth

- [ ] Google OAuth redirect URI registered in Google Cloud Console for the production domain:  
  `https://yourdomain.com/api/auth/callback/google`
- [ ] `NEXTAUTH_SECRET` is a unique 32-byte value (`openssl rand -base64 32`) — not the same as dev
- [ ] Sign in with Google works end-to-end in production
- [ ] Email/password sign up and sign in work (if enabled)
- [ ] Demo login (`NEXT_PUBLIC_ENABLE_DEMO_LOGIN`) is `false` or unset in production
- [ ] `/signin` returns HTTP 200 and a valid page
- [ ] Unauthenticated visit to `/dashboard` redirects to `/` (not 500)
- [ ] Session cookie expires correctly after 30 days

---

## 3. Database

- [ ] `DATABASE_URL` points to the **direct** (non-pooled) Supabase connection string
- [ ] `prisma migrate status` shows all 23 migrations applied, zero pending
- [ ] `pnpm --filter web exec prisma validate` passes with no errors
- [ ] `GET /api/health` returns `{ ok: true }` (or equivalent) from the production deployment
- [ ] Supabase project is on a paid plan or has sufficient free-tier capacity for beta volume

---

## 4. Storage

- [ ] `STORAGE_DRIVER=s3` in production (not `local`)
- [ ] Supabase Storage bucket `viralsnipai-uploads` exists and is private
- [ ] S3 credentials (`S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_PUBLIC_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) are all set
- [ ] Upload a test file via the app — confirm it appears in the bucket
- [ ] Download/export a rendered clip — confirm the file is accessible via the signed URL
- [ ] Local `./uploads` directory is NOT used in production (verify `assertWritableUploadStorageConfigured` throws for `STORAGE_DRIVER=local`)

---

## 5. Billing — Razorpay

- [ ] Razorpay account is KYC-activated (live mode enabled)
- [ ] Live API keys (`rzp_live_...`) are used — not test keys
- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` are all set
- [ ] `RAZORPAY_WEBHOOK_SECRET` is set (startup validation throws if missing in production)
- [ ] Webhook registered in Razorpay Dashboard:  
  URL: `https://yourdomain.com/api/webhooks/razorpay`  
  Events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `payment.captured`
- [ ] `RAZORPAY_PLAN_ID_PLUS_INR` is set and matches a live Razorpay plan
- [ ] `RAZORPAY_PLAN_ID_PRO_INR` is set and matches a live Razorpay plan
- [ ] USD plan IDs set if accepting global payments (`RAZORPAY_PLAN_ID_PLUS_USD`, `RAZORPAY_PLAN_ID_PRO_USD`)
- [ ] Test upgrade flow end-to-end: Free → Plus checkout → webhook fires → `user.subscriptionTier` updates to `starter`/`plus`
- [ ] Cancel subscription — verify `subscriptionCancelAtPeriodEnd` is set correctly
- [ ] Duplicate webhook event is handled idempotently (no double-charge)
- [ ] `/billing` workspace page loads for free and paid users without errors

---

## 6. Upload / Export

- [ ] `MAX_UPLOAD_MB` is set (default 500)
- [ ] `MAX_VIDEO_DURATION_SECONDS` is set (default 3600)
- [ ] `V1_FREE_MONTHLY_UPLOAD_LIMIT=3` and `V1_FREE_MONTHLY_EXPORT_LIMIT=5` are set
- [ ] Free plan upload quota is enforced server-side (4th upload returns 429)
- [ ] Free plan export quota is enforced server-side (6th export returns 429)
- [ ] Upload with unsupported format (e.g. `.avi`) returns a clear 415 error
- [ ] Upload exceeding `MAX_UPLOAD_MB` returns a clear 413 error
- [ ] Watermark appears on exports for free-plan users
- [ ] Watermark is absent on exports for Plus/Pro users
- [ ] FFmpeg binaries (`ffmpeg-static`) are accessible in the deployment runtime — test one export
- [ ] Stalled exports are recovered by `recoverStalledExports()` on restart

---

## 7. AI / Transcription

- [ ] `OPENAI_API_KEY` is set (required for Whisper transcription)
- [ ] `WHISPER_MODEL=whisper-1` is set (or appropriate model)
- [ ] `USE_MOCK_TRANSCRIBE=false` in production
- [ ] `OPENROUTER_API_KEY` is set and `OPENROUTER_ENABLED=true`
- [ ] Transcription completes for a 15-minute test video without ECONNRESET
- [ ] AI highlight detection returns scored clips (not empty list)
- [ ] If transcription fails, the error message includes actionable guidance

---

## 8. Feature Flags

- [ ] `NEXT_PUBLIC_V1_CORE_ENABLED=true`
- [ ] `NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false`
- [ ] `NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false`
- [ ] `UI_V2_ENABLED=true` and `NEXT_PUBLIC_UI_V2_ENABLED=true`
- [ ] V2/V3 routes (`/keywords`, `/snipradar/*`, `/competitors`, etc.) redirect to dashboard when V2/V3 flags are off
- [ ] Sidebar shows only: Dashboard, Projects, Create Clip, Exports, Brand Kit, Billing, Settings
- [ ] No SnipRadar or content calendar links visible in V1 nav

---

## 9. Security

- [ ] CSP header includes `'unsafe-eval'` only in development (not production)
- [ ] `NEXTAUTH_SECRET` is not the same value as in any committed file
- [ ] Supabase secret key (`SUPABASE_SECRET_KEY`) is NOT exposed as `NEXT_PUBLIC_*`
- [ ] All API routes require authentication — test with an unauthenticated request to `/api/projects` → expect 401
- [ ] Upload API enforces `userId` ownership — cannot upload to another user's project
- [ ] Export API enforces `userId` ownership — cannot download another user's export
- [ ] Rate limiting is active on subscription creation (`/api/billing/create-subscription`)
- [ ] No real secrets appear in browser network responses or page source

---

## 10. Analytics / Logging

- [ ] `LOG_LEVEL=info` in production
- [ ] Server logs show structured JSON (check deployment log viewer)
- [ ] `POST /api/upload` logs upload start and completion with `userId` and `projectId`
- [ ] Export start, completion, and failure are logged with `exportId`
- [ ] Activation checkpoint `creator_onboarding_completed` is recorded after onboarding
- [ ] `trackEvent` calls are in place on landing page view, pricing select, and signup

---

## 11. Landing Page / Marketing

- [ ] `/` loads without JavaScript errors
- [ ] Pricing section shows correct Free/Plus/Pro plans and prices
- [ ] "Start free" CTA links to `/signup`
- [ ] FAQ content matches actual V1 feature set (no V2/V3 promises)
- [ ] No fake stats ("20M+ creators" etc.) appear on the page
- [ ] No "guaranteed viral" language — only "viral-ready", "short-form optimized"
- [ ] `/pricing` has correct `<title>` and `<meta description>`
- [ ] `/signin` and `/signup` have `<meta name="robots" content="noindex">`
- [ ] `/dashboard` has `<meta name="robots" content="noindex">`
- [ ] Structured data (Product + FAQ schema) is present in page source

---

## 12. Manual QA Script

Run this flow end-to-end before opening beta. Use an incognito window and a real email.

### Step 1 — Sign up
1. Visit `/` — confirm landing page loads, check for console errors.
2. Click "Start free" → land on `/signup`.
3. Sign up with Google OAuth (preferred) or email/password.
4. Confirm redirect to `/onboarding`.

### Step 2 — Onboarding
5. Step 1: Enter your name. Select a creator type (e.g. Podcaster).
6. Step 2: Select primary platform (e.g. YouTube Shorts). Enter a niche (e.g. "B2B SaaS").
7. Step 3: Select a content goal (e.g. "Repurpose podcasts & webinars").
8. Confirm redirect to `/dashboard` after completing step 3.
9. Verify the dashboard shows the empty state ("Upload your first long video…").

### Step 3 — Create a project
10. Click "Create first clip" → the project dialog appears.
11. Enter a title (e.g. "Test podcast episode").
12. Select target platform: YouTube Shorts.
13. Select content goal: Repurpose long-form.
14. Click "Create project" → confirm redirect to `/repurpose?projectId=...`.

### Step 4 — Upload a video
15. On the Create Clip page, select the project in the selector.
16. Upload a short test video (use a 2–5 min MP4 under 100 MB).
17. Confirm the dropzone shows upload progress.
18. Confirm the success state appears ("Uploaded [filename]").
19. Confirm the asset appears in the "Source Video" panel with type and duration.

### Step 5 — Generate clips
20. Click "Auto-detect Highlights".
21. Watch the 4-phase progress indicator (connecting → downloading → transcribing → analyzing).
22. Confirm clips appear in the detected highlights grid.
23. Confirm each clip has a virality score and duration displayed.

### Step 6 — Edit captions and brand styling
24. Click "Continue to Edit" → land on `/repurpose/editor?projectId=...`.
25. Confirm clips are listed with virality scores.
26. Select a clip and open the caption editor.
27. Confirm captions are displayed and editable.
28. Navigate to `/brand-kit`.
29. Set a primary color, font, and toggle watermark.
30. Save the brand kit.

### Step 7 — Export
31. Return to `/repurpose/export?projectId=...`.
32. Select one or more clips.
33. Choose preset (e.g. Shorts 9:16 1080).
34. Toggle "Include captions" on.
35. Click "Export".
36. Confirm the export status shows "Queued" → "Rendering" → "Ready".
37. Click "Download" — confirm the file downloads as an MP4.
38. Inspect the video: captions are present and watermark is visible (free plan).

### Step 8 — Verify upload limit (free plan)
39. Upload 3 more test videos until the monthly limit is hit.
40. On the 4th upload attempt, confirm a clear error: "Monthly upload limit reached for your free plan."

### Step 9 — Upgrade plan
41. Visit `/billing`.
42. Select Plus plan (INR or USD depending on your test region).
43. Complete the Razorpay checkout with a test card.
44. Confirm the page refreshes and shows "Plus" plan.
45. Upload another video — confirm it succeeds (Plus limit is 25/month).
46. Export a clip — confirm no watermark on the downloaded file.

### Step 10 — Brand kit on paid plan
47. Confirm the brand kit logo and colors apply to the export.
48. Confirm the watermark toggle is available and export respects it.

---

## 13. Launch-Day Checklist

On the day you open beta:

- [ ] Take a Supabase point-in-time backup (Dashboard → Database → Backups)
- [ ] Confirm Razorpay dashboard is on live mode (not test)
- [ ] Confirm all env vars are set in the production deployment (Vercel/Coolify)
- [ ] Deploy the final build and confirm `GET /api/health` returns 200
- [ ] Run the manual QA script (steps 1–10) on the live production URL
- [ ] Monitor server logs for the first 30 minutes after opening access
- [ ] Monitor Razorpay dashboard for the first subscription event
- [ ] Have a rollback plan: know how to redeploy the previous image or commit

---

*This checklist is maintained in `docs/V1_BETA_LAUNCH_CHECKLIST.md`. Update it as the product evolves.*
