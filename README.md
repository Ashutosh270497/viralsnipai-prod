# Clippers Monorepo

Clippers is an AI-assisted SaaS workspace that combines **Hooksmith** (hook + script ideation) with **RepurposeOS** (clip generation, captions, and branded exports). The monorepo is built with Next.js 14 App Router, Prisma, MySQL, Tailwind, shadcn/ui, and an FFmpeg-based rendering pipeline.

![Dashboard placeholder](docs/assets/dashboard-placeholder.png)

## Features

- **Hooksmith** – Generate 8–10 hooks from a topic/URL and expand them into 120-second scripts with tone + audience controls.
- **RepurposeOS** – Upload/record long-form video, auto-detect highlights, burn-in captions, and queue preset exports (9:16, 1:1, 16:9).
- **Brand Kit** – Persist color, font, logo, watermark, and caption styles that flow through clips + exports.
- **Imagen** – Craft marketing-ready visuals with Google’s Nano Banana model, complete with voice prompts, style hints, aspect-ratio controls, and optional reference image uploads for grounded compositions.
- **Veo** – Generate short-form cinematic clips with Google Veo 3.1, offering aspect ratio + duration controls and downloadable previews.
- **Auth** – NextAuth with email magic links, Google OAuth, and an instant demo login.
- **Storage** – Local `/uploads` during development; S3-compatible hooks for production.
- **Background rendering** – In-memory render queue built on `@clippers/jobs` + FFmpeg static binaries.
- **YouTube ingest resilience** – ytdl-core primary flow with yt-dlp fallback, plus cookie support for restricted videos via `YT_DLP_COOKIES_PATH` or `YT_DLP_COOKIES_FROM_BROWSER`.
- **Testing + DX** – Prisma ORM, Husky pre-commit hook, ESLint/Prettier, and Playwright smoke coverage.

## Tech Stack

- **Frontend**: Next.js 14 (App Router, TypeScript), TailwindCSS, shadcn/ui, React Query
- **Backend**: Next.js route handlers, NextAuth, Prisma ORM
- **Database**: MySQL 8 via Docker Compose
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
│   ├── PRD_Clippers.md                # Product requirements
│   ├── clippers-journal.md            # Development journal
│   ├── CODE_REVIEW_IMPROVEMENTS.md    # Code quality improvements
│   ├── PHASE_0_IMPLEMENTATION_COMPLETE.md  # Phase 0 status
│   ├── REPURPOSEOS_ENHANCEMENT_PLAN.md     # Enhancement roadmap
│   └── assets/                        # Images & diagrams
└── docker-compose.yml  # MySQL 8 for local development
```

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker Desktop (or compatible daemon)

## Local Development

1. Start the database:
   ```bash
   docker compose up -d
   ```
2. Bootstrap environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Fill in secrets as needed (OpenAI, Google OAuth, SMTP for magic links).
   - Imagen requires `GOOGLE_NANO_BANANA_API_KEY`. Leave `GOOGLE_NANO_BANANA_ENDPOINT` unset unless you have a custom endpoint; change `GOOGLE_IMAGEN_MODEL` (defaults to `imagen-4.0-generate-1`) if you want to target another Gemini image model such as `gemini-2.5-flash-image`.
     - Gemini image models currently return only one candidate per request; the app automatically clamps `Images per batch` to 1 when a Gemini model is active.
   - Voice prompts & transcriptions use OpenAI Whisper. Provide `OPENAI_API_KEY` and set `USE_MOCK_TRANSCRIBE="false"` (optionally override `WHISPER_MODEL`) to generate real transcripts; the flag can remain `true` for synthetic text while developing offline.
   - Text-to-speech in the Transcribe workspace relies on OpenAI audio models. Optionally configure `TTS_MODEL` (defaults to `gpt-4o-mini-tts`), `TTS_VOICE`, or `TTS_FORMAT` to customise the generated clips.
  - Veo video generation needs `GOOGLE_VEO_API_KEY` (defaults to the image key if omitted) and optionally `GOOGLE_VEO_MODEL`. Toggle with `VEO_ENABLED` / `NEXT_PUBLIC_VEO_ENABLED`.
  - When targeting the Vertex AI long-running endpoint, set `GOOGLE_VEO_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_VEO_PROJECT_ID`, and `GOOGLE_VEO_LOCATION`. `GOOGLE_VEO_OUTPUT_URI` is optional (provide a `gs://` bucket if you want renders delivered to Cloud Storage). You can also override `GOOGLE_VEO_API_ENDPOINT` (defaults to `${LOCATION}-aiplatform.googleapis.com`).
  - Fine-tune request behaviour with env overrides (defaults shown in parentheses): `GOOGLE_VEO_SAMPLE_COUNT` (4), `GOOGLE_VEO_GENERATE_AUDIO` (true), `GOOGLE_VEO_INCLUDE_RAI_REASON` (true), `GOOGLE_VEO_ADD_WATERMARK` (true), `GOOGLE_VEO_PERSON_GENERATION` (`allow_all`), `GOOGLE_VEO_RESOLUTION` (`720p`).
3. Install dependencies and prepare Prisma:
   ```bash
   pnpm install
   pnpm --filter web prisma generate
   pnpm --filter web prisma db push
   pnpm seed
   ```
4. Run the app:
   ```bash
   pnpm dev
   ```
   Visit http://localhost:3000 and click **Try the demo** to jump into a seeded workspace.

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
  or set `UI_V2_ENABLED="true"` / `NEXT_PUBLIC_UI_V2_ENABLED="true"` in your `.env.local`.
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
2. Set `FFMPEG_PATH` in `.env.local` to point at the native binary.
3. Restart `pnpm dev` to pick up the new path.

## Troubleshooting

| Issue | Fix |
| ----- | --- |
| `PrismaClientInitializationError` | Ensure `docker compose up -d` is running and `DATABASE_URL` points at localhost. |
| FFmpeg permission denied | Run `chmod +x node_modules/.bin/ffmpeg` or provide native FFmpeg via `FFMPEG_PATH`. |
| Upload previews returning 404 | Verify `LOCAL_UPLOAD_DIR` exists and that `/api/uploads/*` is reachable (development-only). |
| Magic link email not arriving | Configure SMTP variables or, during dev, check the terminal log for the JSON transport payload. |
| Age-restricted YouTube download fails | Provide cookies by setting `YT_DLP_COOKIES_PATH` (Netscape cookie file) or `YT_DLP_COOKIES_FROM_BROWSER` (e.g. `chrome`, `firefox`, `safari`) so yt-dlp can authenticate. |

## Screenshots (placeholders)

- ![Hooksmith](docs/assets/hooksmith-placeholder.png)
- ![RepurposeOS](docs/assets/repurpose-placeholder.png)

## 📚 Documentation

All project documentation is located in the [`docs/`](./docs/) folder:

- **[docs/README.md](./docs/README.md)** - Documentation index and navigation guide
- **[CODE_REVIEW_IMPROVEMENTS.md](./docs/CODE_REVIEW_IMPROVEMENTS.md)** - Infrastructure improvements and code quality enhancements
- **[PHASE_0_IMPLEMENTATION_COMPLETE.md](./docs/PHASE_0_IMPLEMENTATION_COMPLETE.md)** - Phase 0 backend implementation status
- **[REPURPOSEOS_ENHANCEMENT_PLAN.md](./docs/REPURPOSEOS_ENHANCEMENT_PLAN.md)** - Comprehensive enhancement roadmap
- **[PRD_Clippers.md](./docs/PRD_Clippers.md)** - Product requirements document
- **[clippers-journal.md](./docs/clippers-journal.md)** - Development journal and build log

For detailed implementation guides, API references, and technical specifications, see the [docs README](./docs/README.md).

## License

This repository is private/internal for the Clippers SaaS prototype.
