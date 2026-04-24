# ViralSnipAI Monorepo

ViralSnipAI turns long videos into viral-ready short clips with AI hooks, captions, and branded exports.

The launch plan is intentionally versioned. **V1** focuses on the core video repurposing workflow: landing, auth, onboarding, dashboard, projects, video upload, AI clip detection, captions, brand kit, exports/downloads, billing, and basic usage limits. **V2** adds creator growth tools. **V3** adds SnipRadar, X automation, advanced media AI, CRM, API/webhooks, and automation workflows. The monorepo is built with Next.js 14 App Router, Prisma, PostgreSQL/Supabase, Tailwind, shadcn/ui, and an FFmpeg-based rendering pipeline.

![Dashboard placeholder](docs/assets/dashboard-placeholder.png)

## 📚 Documentation

All project documentation is organized in the [`docs/`](./docs/) folder. Start with:
- **[Documentation Index](./docs/INDEX.md)** - Complete documentation navigation
- **[Launch Versions](./docs/LAUNCH_VERSIONS.md)** - V1/V2/V3 launch scope and feature gates
- **[Supabase Setup Guide](./docs/SUPABASE_SETUP_GUIDE.md)** - Database setup instructions
- **[Architecture](./docs/architecture/)** - Technical architecture documentation

## Features

- **V1 Core Repurposing** – Upload long-form video, auto-detect highlights, edit captions, apply brand kit, and export/download short clips.
- **Brand Kit** – Persist color, font, logo, watermark, and caption styles that flow through clips + exports.
- **V2 Creator Growth** – Feature-gated roadmap for hook generation per clip, platform captions, clip ranking, content calendar, title generation, thumbnail ideas, and creator analytics.
- **V3 Automation OS** – Feature-gated roadmap for SnipRadar, X automation, scheduling, CRM, API/webhooks, Imagen, Veo, and advanced automation.
- **Auth** – NextAuth with email magic links, Google OAuth, and an instant demo login.
- **Storage** – Local `/uploads` during development; S3-compatible hooks for production.
- **Background rendering** – In-memory render queue built on `@clippers/jobs` + FFmpeg static binaries.
- **YouTube ingest resilience** – ytdl-core primary flow with yt-dlp fallback, plus cookie support for restricted videos via `YT_DLP_COOKIES_PATH` or `YT_DLP_COOKIES_FROM_BROWSER`.
- **Testing + DX** – Prisma ORM, Husky pre-commit hook, ESLint/Prettier, and Playwright smoke coverage.

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript), TailwindCSS, shadcn/ui, React Query
- **Backend**: Next.js route handlers, NextAuth, Prisma ORM
- **Database**: PostgreSQL via Supabase (production) or local Docker Compose (development)
- **Media**: `fluent-ffmpeg`, `ffmpeg-static`, `ffprobe-static`
- **AI**: OpenAI Responses + Whisper (mockable for dev)
- **Storage**: Local disk or S3-compatible
- **Testing**: Playwright

## Repository Layout

```
.
├── apps/
│   └── web/            # Next.js application
│       ├── app/        # App Router routes
│       ├── components/ # UI + feature components
│       ├── lib/        # Media, AI, storage, auth helpers
│       └── prisma/     # Prisma schema + seed script
├── packages/
│   ├── jobs/           # In-memory export queue utilities
│   └── types/          # Shared TypeScript types + export presets
├── docs/                               # 📚 All project documentation
│   ├── README.md                      # Documentation index
│   ├── PRD_ViralSnipAI.md                # Product requirements
│   ├── clippers-journal.md            # Development journal
│   ├── CODE_REVIEW_IMPROVEMENTS.md    # Code quality improvements
│   ├── PHASE_0_IMPLEMENTATION_COMPLETE.md  # Phase 0 status
│   ├── REPURPOSEOS_ENHANCEMENT_PLAN.md     # Enhancement roadmap
│   └── assets/                        # Images & diagrams
└── docker-compose.yml  # Local PostgreSQL for development
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop (for local database) — OR a Supabase project

## Local Development

### Option A — Local PostgreSQL (fastest)

1. Start a local PostgreSQL instance:
   ```bash
   docker compose up -d
   ```
   This starts `postgres:16-alpine` on port 5432 with database `clippers`.

2. Bootstrap environment variables:
   ```bash
   cp .env.example apps/web/.env.local
   ```
   Set `DATABASE_URL` in `apps/web/.env.local` to the local connection string:
   ```
   DATABASE_URL="postgresql://clippers:clippers_local@localhost:5432/clippers"
   ```
   Fill in the remaining required secrets (OpenAI/OpenRouter, Google OAuth). See the
   `[V1 REQUIRED]` sections in `.env.example` for what is needed to run the core workflow.
   Keep `apps/web/.env` minimal (just `DATABASE_URL`) so Prisma CLI commands work without
   loading the full runtime env.

3. Install dependencies and set up the database:
   ```bash
   pnpm install
   pnpm --filter web exec prisma generate
   pnpm --filter web exec prisma db push
   pnpm seed
   ```

4. Run the app:
   ```bash
   pnpm dev
   ```
   Visit http://localhost:3000 and click **Try the demo** to jump into a seeded workspace.

### Option B — Supabase (production parity)

1. Create a project at [app.supabase.com](https://app.supabase.com).
2. Copy the **Direct connection** string (not the pooled one) from
   Settings → Database → Connection String → Prisma tab.
3. Follow steps 2–4 above using the Supabase `DATABASE_URL`.

See [docs/PRODUCTION_SETUP.md](./docs/PRODUCTION_SETUP.md) for the full production deployment guide.

### Available Scripts (pnpm)

- `pnpm dev` – Start Next.js in development mode
- `pnpm build` / `pnpm start` – Production build + start
- `pnpm lint` – ESLint via `next lint`
- `pnpm format` – Prettier on all supported files
- `pnpm seed` – Seed demo data (demo user, hooks, clips, exports)
- `pnpm test` – Playwright smoke suite

## Testing

Playwright lives under `apps/web/tests`. Install browser binaries once with `pnpm exec playwright install`. The suite covers:

- `auth.spec.ts` – Marketing page → demo login → dashboard redirect
- `flow.spec.ts` – Create project → upload dummy file → highlights → captions → export status
- `smoke.spec.ts` – Regression harness spanning auth → project creation → repurpose surfaces → billing
  - Updated editor surfaces now use native V2 components; legacy V1 adapters have been removed from the codebase.
    - Legacy imports remain stable; adapters detect `UI_V2_ENABLED` and render v2 internals while forwarding the original callback signatures/data-testids.

Run the suite (with `pnpm dev` running in another terminal):

```bash
pnpm test
# or
pnpm --filter web test:headed
```

## UI v2 Feature Flag

- The migration-safe scaffold is gated behind `UI_V2_ENABLED`. By default (flag `false`) the legacy UI renders unchanged.
- To enable the new surfaces locally:
  ```bash
  UI_V2_ENABLED=true pnpm dev
  ```
  or set `UI_V2_ENABLED="true"` / `NEXT_PUBLIC_UI_V2_ENABLED="true"` in `apps/web/.env.local`.
- When enabled today, you’ll see:
  - Feature flags exposed via `useFeatureFlags`
  - Design tokens (`styles/tokens.css`) available for the next-gen theme
  - Command palette (⌘/Ctrl + K) quick actions
  - Editor V2 (preview canvas, timeline, captions, properties) via compat adapters
- Rollback is immediate—flip the flag back to `false` (or remove the env override) and the legacy UI remains the default.

## Media Storage

- **Development** – Files are stored in `./uploads`. The `/api/uploads/*` handler streams local files, and the directory is `.gitignore`d.
- **Production** – Switch `STORAGE_DRIVER` to `s3` and provide S3-compatible credentials (endpoint, bucket, keys). Upload helpers automatically write to the bucket and return public URLs.

## FFmpeg Notes

The project ships with `ffmpeg-static`/`ffprobe-static` binaries. If you hit codec errors:

1. Install native FFmpeg (`brew install ffmpeg` or system package).
2. Set `FFMPEG_PATH` in `apps/web/.env.local` to point at the native binary.
3. Restart `pnpm dev` to pick up the new path.

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| `PrismaClientInitializationError` | Ensure `docker compose up -d` is running (local) or your Supabase project is active, and that `DATABASE_URL` in `apps/web/.env.local` is the direct (non-pooled) connection string. |
| FFmpeg permission denied | Run `chmod +x node_modules/.bin/ffmpeg` or provide native FFmpeg via `FFMPEG_PATH`. |
| Upload previews returning 404 | Verify `LOCAL_UPLOAD_DIR` exists and that `/api/uploads/*` is reachable (development-only). |
| Magic link email not arriving | Configure SMTP variables or, during dev, check the terminal log for the JSON transport payload. |
| Age-restricted YouTube download fails | Provide cookies by setting `YT_DLP_COOKIES_PATH` (Netscape cookie file) or `YT_DLP_COOKIES_FROM_BROWSER` (e.g. `chrome`, `firefox`, `safari`) so yt-dlp can authenticate. |

## Screenshots (placeholders)

- ![Hooksmith](docs/assets/hooksmith-placeholder.png)
- ![RepurposeOS](docs/assets/repurpose-placeholder.png)

## License

This repository is private/internal for the ViralSnipAI SaaS prototype.
