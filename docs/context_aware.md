# ViralSnipAI Context-Aware Product Baseline

Last scanned: 2026-04-27
Repository: `clippers` pnpm monorepo
Primary app: `apps/web`
CV worker: `apps/cv-worker`
Purpose of this file: shared working context for future product and engineering work.

---

## Executive Summary

ViralSnipAI is a creator-growth SaaS built as a modular Next.js application. The product is organized into three launch bands across two product ecosystems:

1. **V1 Core Video Repurposing** — the current launch focus. Covers landing, auth, onboarding, dashboard, projects, video upload, AI clip detection, smart reframe, captions, animated exports, brand kit, exports/downloads, billing, settings, and basic usage limits.
2. **V2 Creator Growth** — hook generation, platform captions, ranking, calendar, titles, thumbnails, keyword research, and basic creator analytics. These features exist or are partially scaffolded but are hidden by default.
3. **V3 Automation OS** — SnipRadar, X automation, scheduling, competitor tracking, CRM, API/webhooks, Imagen, Veo, voice cloning, advanced analytics, and advanced automation. These remain in the codebase and are hidden by default.

The codebase is a modular monolith: Next.js App Router for UI/API, Prisma for persistence, TanStack Query for client data orchestration, Inngest for scheduled/background product jobs, `@clippers/jobs` in-memory queue for transitional media processing, and a standalone Python FastAPI **CV worker** (`apps/cv-worker`) for computer vision tasks.

**Current media-processing capability (fully implemented as of April 2026):**
- FFmpeg-based video ingestion, single-pass crop+scale+caption rendering
- Python CV worker for face/person detection (MediaPipe + YOLO ONNX) and scene cuts (PySceneDetect)
- Smart reframe module: stable single-window crop and dynamic keyframe tracking
- Remotion animated caption preview in the editor (`@remotion/player`)
- Remotion server-side export for animated captions (`@remotion/renderer` + `@remotion/bundler`) — opt-in via `REMOTION_RENDERER_ENABLED=true`

---

## Monorepo Layout

```text
clippers/
├── apps/
│   ├── web/                          # Main Next.js 14 app
│   │   ├── app/                      # App Router pages and API route handlers
│   │   ├── components/               # Feature and UI components
│   │   ├── hooks/                    # React hooks
│   │   ├── lib/                      # Business logic, services, integrations, queues
│   │   │   ├── media/                # Video quality policy, smart reframe, CV client, Remotion
│   │   │   │   ├── video-quality-policy.ts
│   │   │   │   ├── smart-reframe/    # 8+ files: tracking types, crop window, dynamic tracking, smoothing
│   │   │   │   ├── cv-worker-client.ts
│   │   │   │   ├── remotion-bundle.ts
│   │   │   │   └── remotion-renderer.ts
│   │   │   ├── health/               # Unified health service
│   │   │   │   └── health-service.ts
│   │   │   ├── repurpose/            # Scene detection, clip optimization, caption config
│   │   │   └── services/             # Virality, transcript enhancement, etc.
│   │   ├── remotion-compositions/    # Remotion server-side compositions (bundled by webpack separately)
│   │   │   ├── index.ts              # registerRoot entry point
│   │   │   └── ClipExportComposition.tsx
│   │   ├── prisma/                   # Prisma schema, migrations, seed
│   │   ├── styles/                   # Global styles and tokens
│   │   └── tests/                    # Playwright E2E tests
│   ├── cv-worker/                    # Python FastAPI CV worker (NEW)
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI app, endpoints: /health /detect/frame /detect/clip /scene-detect /track-subject
│   │   │   ├── schemas.py            # Pydantic request/response schemas
│   │   │   ├── services.py           # Orchestration
│   │   │   ├── detectors.py          # MediaPipe face + YOLO ONNX person detection
│   │   │   ├── scene_detection.py    # PySceneDetect + FFmpeg fallback
│   │   │   ├── tracking.py           # Custom tracker: nearest-center + IoU + confidence
│   │   │   ├── video_utils.py        # FFmpeg frame sampling
│   │   │   ├── config.py             # Settings from env
│   │   │   └── dependencies.py       # FastAPI DI
│   │   ├── requirements.txt          # fastapi, uvicorn, pydantic, opencv-headless, onnxruntime, mediapipe, scenedetect
│   │   ├── Dockerfile                # python:3.11-slim, apt ffmpeg, uvicorn port 8010
│   │   └── tests/
│   └── browser-extension/            # Manifest V3 SnipRadar extension
├── packages/
│   ├── jobs/                         # In-memory render/job queue
│   └── types/                        # Shared types and export presets
├── docs/
│   ├── context_aware.md              # This file
│   ├── MEDIA_CV_REMOTION_UPGRADE_TRACKING.md  # Phase 0-10 progress (Phases 0-10 complete)
│   ├── VIDEO_QUALITY_POLICY.md       # FFmpeg quality presets, CRF policy
│   ├── SMART_REFRAME_PHASE_1.md      # Smart reframe architecture and fallback logic
│   ├── PRODUCTION_DEPLOYMENT.md      # Step-by-step production deployment guide
│   └── ... (other existing docs)
├── docker-compose.yml                # Local dev PostgreSQL
├── docker-compose.prod.yml           # Production stack: web + cv-worker + postgres (NEW)
└── package.json                      # pnpm workspace scripts
```

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14.2.3 App Router, React 18, TypeScript 5.4 | `moduleResolution: "Bundler"` in tsconfig (required for Remotion v4) |
| Package manager | pnpm 8.15.4 | monorepo workspace |
| Styling/UI | Tailwind CSS, shadcn/Radix, lucide-react | custom tokens in `apps/web/styles` |
| Database | Prisma ORM, PostgreSQL provider | Supabase is production target; 23 migrations applied |
| Auth | NextAuth v4 JWT | Google OAuth, credentials, dev bypass at `/signin?dev-bypass=true` |
| State | TanStack Query v5, React Context | RepurposeContext, SnipRadarContext |
| Background jobs | Inngest (product/cron) + `@clippers/jobs` (media render) | |
| AI text/model | OpenRouter only (single gateway) | `lib/openrouter-client.ts` is source of truth |
| AI transcription | OpenAI Whisper via `OPENAI_API_KEY` OR OpenRouter audio | controlled by `TRANSCRIBE_PROVIDER` env |
| Video processing | FFmpeg via `ffmpeg-static` / `FFMPEG_PATH` | single-pass rendering, lanczos scaling, stream copy |
| Computer vision | Python CV worker at `apps/cv-worker` | MediaPipe face, YOLO ONNX person, PySceneDetect |
| Animated exports | Remotion v4 (`@remotion/renderer`, `@remotion/bundler`) | opt-in via `REMOTION_RENDERER_ENABLED=true` |
| Storage | Local disk or S3-compatible | `lib/storage.ts` driver switch |
| Billing | Razorpay (primary) | Stripe fields remain as legacy placeholders |
| Testing | Jest unit + Playwright E2E | 133+ unit tests, all passing |

---

## Architecture

The app follows a partial Clean Architecture pattern:

```text
Presentation Layer
  app/, components/, route handlers
        |
Application Layer
  lib/application/use-cases/
        |
Domain Layer
  lib/domain/services, value-objects, repositories
        |
Infrastructure Layer
  lib/infrastructure/repositories, services, DI container (Inversify)
```

Key architectural patterns:

- **App Router route handlers** under `apps/web/app/api/**`
- **Use cases** for: auto-highlights, clip updates, caption generation, export queueing, transcript translation, YouTube ingest, composite clips, smart reframe analysis
- **Repository interfaces** in `lib/domain/repositories` with Prisma implementations
- **Inversify DI** in `lib/infrastructure/di`
- **Instrumentation hook** at `instrumentation.ts` — validates env, recovers stalled exports, registers graceful shutdown at Node startup
- **Video quality policy** at `lib/media/video-quality-policy.ts` — single source of truth for all FFmpeg CRF/preset/bitrate settings
- **Smart reframe module** at `lib/media/smart-reframe/` — standalone, pluggable detection providers

---

## Media Processing Pipeline (V1 Current State)

### FFmpeg Pipeline

File: `lib/ffmpeg.ts`

All exports use a **single-pass render**: crop + scale + caption burn happen in one FFmpeg invocation (`extractAndRenderSegment()`). The old two-pass approach (extract → burn captions) was eliminated.

Quality presets (`lib/media/video-quality-policy.ts`):

| Preset | CRF | Preset | Audio | Use |
|---|---|---|---|---|
| `source_copy_trim` | — | copy | copy | Lossless trim, no filters |
| `preview_fast` | 24 | veryfast | 128k | Dashboard UI preview only |
| `balanced_export` | 20 | medium | 192k | Standard export |
| `high_quality_export` | 16 | slow | 256k | Default production export |

Additional quality improvements applied:
- `flags=lanczos` on all scale filters (letterbox, crop, concat, thumbnail)
- H.264 level `4.2` (was `4.1`)
- `concatClipsPassthrough()` uses `-c copy` (genuine stream copy, was re-encoding)
- `concatClips()` uses stream copy when no watermark (eliminates encode pass #3)
- Export pipeline: **1 encode pass** (no watermark) or **2 passes** (watermark composite)

### Smart Reframe Module

Files: `lib/media/smart-reframe/` (8 files + `index.ts`)

Architecture:
```
generateStableSmartReframePlan() / generateDynamicSmartReframePlan()
  → sampleAndDetect() [FFmpeg frame extraction at 480px]
  → FrameDetectionProvider.detect() [VisionApiDetectionProvider or FallbackDetectionProvider]
  → aggregateFrameDetections() [weighted median of face/person centers]
  → computeStableCropWindow() / generateDynamicCropPathFromDetections()
  → smoothCropPath() [deadband + max-shift-per-second + interpolation]
  → buildViralityFactorsPatch() [updates ClipReframePlan.safeZone + metadata.smartReframe]
```

Detection providers (pluggable interface `FrameDetectionProvider`):
- `VisionApiDetectionProvider` — sends base64 frames to OpenRouter (`google/gemini-3.1-flash-lite-preview`), parses bounding boxes
- `FallbackDetectionProvider` — always returns empty (center crop), used when OpenRouter unavailable
- `LocalCvDetectionProvider` — calls CV worker `/detect/clip` when `CV_WORKER_URL` is set (preferred, faster, no API cost)

Detection priority: face → person → center crop fallback.

Smart reframe modes:

| Mode | Description | Premium |
|---|---|---|
| `smart_auto` | Detect face → person → center (stable, one window) | Free |
| `smart_face` | Stable face crop only | Free |
| `smart_person` | Stable person crop only | Free |
| `dynamic_auto` | Dynamic keyframe tracking, face/person motion | Pro |
| `dynamic_face` | Dynamic face tracking with anti-jitter | Pro |
| `dynamic_person` | Dynamic person body tracking | Pro |
| `center_crop` | Geometric center, no detection | Free |
| `blurred_background` | Blur-pad pillarbox (Phase 2, not yet rendered) | Pro |

Storage: `clip.viralityFactors.metadata.smartReframe` (no Prisma migration required). The 9:16 `ClipReframePlan.safeZone` is patched in-place so the existing FFmpeg pipeline picks up the detected center automatically.

Dynamic crop: `ClipReframePlan.dynamicCropPath` (array of `ClipDynamicCropKeyframe`) + `dynamicCropSource` are stored on the plan. `buildPresetVideoFilter()` in `ffmpeg.ts` prefers dynamic crop expressions when ≥2 keyframes are available, falls back to stable crop.

### CV Worker

Service: `apps/cv-worker/` — standalone Python FastAPI (port 8010)

Endpoints:
- `GET /health` — service + dependency + model status
- `POST /detect/frame` — single frame face/person detection
- `POST /detect/clip` — multi-frame clip detection with FFmpeg frame sampling
- `POST /scene-detect` — PySceneDetect scene cuts
- `POST /track-subject` — subject tracking with smoothing and keyframe generation

Models:
- **Face**: MediaPipe Face Detector (built-in, no model file needed)
- **Person**: YOLO ONNX (requires `CV_YOLO_MODEL_PATH`); fallback to OpenCV HOG when not configured
- **Scene**: PySceneDetect (`pyscenedetect` package); fallback to FFmpeg scene filter

Graceful degradation: any CV worker failure falls back to OpenRouter vision API detection, then to center crop. The web app never fails because the CV worker is unavailable.

CV worker env vars:
```
CV_WORKER_URL=http://localhost:8010     # enables local detection
CV_YOLO_MODEL_PATH=/models/yolov8n.onnx # optional person detection model
CV_SCENE_THRESHOLD=27                   # PySceneDetect sensitivity
```

### Remotion Premium Renderer

Phase 8 (complete). Enables animated caption exports.

Architecture:
```
render-queue.ts
  → shouldUseRemotionRenderer(captionStyle) [animation.type !== "none" && REMOTION_RENDERER_ENABLED]
  → renderWithRemotionPath() [per segment]
      → extractAndRenderSegment() [FFmpeg: crop+scale, no caption burn] → temp_seg.mp4
      → renderWithRemotion() [Remotion: OffthreadVideo + AnimatedCaptions] → rendered_seg.mp4
      → on Remotion failure: applyCaptionAndOverlayStyling() [FFmpeg static fallback]
  → concatClipsPassthrough() [stream copy concat]
```

Animation types supported: `none` (FFmpeg), `karaoke`, `pop`, `fade`, `slide`, `bounce` (Remotion).

Files:
- `remotion-compositions/index.ts` — `registerRoot()` entry point (bundled by webpack separately, excluded from tsc)
- `remotion-compositions/ClipExportComposition.tsx` — `OffthreadVideo` + captions + hook overlays + watermark
- `lib/media/remotion-bundle.ts` — singleton bundle cache manager
- `lib/media/remotion-renderer.ts` — `renderWithRemotion()` + `shouldUseRemotionRenderer()`

Remotion env vars:
```
REMOTION_RENDERER_ENABLED=true           # opt-in (default: false)
REMOTION_EXPORT_CRF=18                   # output quality
REMOTION_EXPORT_AUDIO_BITRATE=256k
REMOTION_CONCURRENCY=1
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
NEXT_PUBLIC_REMOTION_RENDERER_ENABLED=true  # shows Remotion badge in UI
```

**Note on webpack**: `@remotion/bundler` imports `@rspack/binding` (native `.node` binary). `next.config.mjs` adds webpack externals to exclude `@rspack/**` and `@remotion/bundler` from bundling. `remotion-compositions/` is excluded from tsconfig and Jest configuration pins `'^remotion$'` to `node_modules/remotion` to prevent the local directory from shadowing the npm package.

### Scene Detection

File: `lib/repurpose/scene-detection.ts` — `detectRepurposeSceneCuts()`

Detection order:
1. CV worker PySceneDetect (when `CV_WORKER_URL` is set) — accurate, timestamp-based
2. FFmpeg scene filter (fallback) — fast, adequate
3. Empty array (graceful no-op if both fail)

All paths log `sceneDurationMs` and `totalDurationMs` for observability.

### Transcription

File: `lib/transcript.ts`

Providers via `TRANSCRIBE_PROVIDER`:
- `openai` (default) — OpenAI Whisper API, buffer-based uploads (fixes ECONNRESET), 3-min timeout, retry on retryable errors
- `openrouter` — sends base64 audio to OpenRouter chat completions (`openai/gpt-4o-audio-preview` model)

`USE_MOCK_TRANSCRIBE` modes:
- `false` — always real, fail hard on error
- `auto` — try real, fall back to synthetic on error (dev default)
- `true` — always synthetic (testing only)

`isSyntheticTranscriptText()` detects mock transcripts. `CaptionGenerationService.isSyntheticTranscript()` returns `[Transcript unavailable]` SRT instead of fake captions when a synthetic transcript is detected.

---

## RepurposeOS — Current Feature State

Three-page workflow: `/repurpose` → `/repurpose/editor` → `/repurpose/export`

Shared state: `RepurposeContext` in `components/repurpose/repurpose-context.tsx` (persists `projectId` in query string).

### Ingest Page (`/repurpose`)

- YouTube URL fetch or file upload
- Model selector for highlight detection (Gemini 2.5 Pro default, multiple options)
- Audience/tone/CTA/brief configuration
- Content Calendar seeding: if `?ideaId=...` is in URL, brief/audience/tone are pre-populated from the calendar idea
- Stepper component (Upload & Detect → Edit & Enhance → Export)
- `V1UsageLimitsCard` shows monthly export/upload limits

### Editor Page (`/repurpose/editor`)

Tabs per active clip:
1. **Transcript tab** — per-segment rows with timestamps (click to seek), editable text, scissors (split at midpoint), ↓ (merge with next), search/filter input, save/undo/regenerate. Uses `RemotionClipPreview` with `@remotion/player` for the clip video player.
2. **Framing tab** — `FramingPanel` with:
   - Crop window + safe-zone SVG overlay visualized on the clip thumbnail
   - Mode selector: all 8 modes with Pro badges on premium modes
   - Tracking smoothness (low/medium/high) and subject position (center/slightly_up/slightly_down) — visible only for dynamic modes
   - Soft upgrade gate for premium modes (toast instead of hard block)
   - Re-analyze and Reset to center buttons
   - Confidence score, keyframe count, fallback reason display
3. **Export tab** — SRT/VTT caption file downloads, link to full export page
4. **Captions tab** (in CaptionOverlayStudio) — caption theme presets, font/size/position, animation type selector (none/karaoke/pop/fade/slide/bounce), speed selector, hook overlays

Synthetic transcript detection: amber warning banner + Re-transcribe button when mock transcript detected.

### Export Page (`/repurpose/export`)

- Clip selector with thumbnails and virality scores
- Aspect ratio / output preset selector
- Caption burn toggle
- Animation type info row (shows "Remotion" or "FFmpeg" badge based on env)
- Quality selector: **High quality** (CRF 16, slow, 256k) vs **Standard** (CRF 20, medium, 192k)
- Export queue with polling, progress stages, download on completion
- SRT/VTT download in export panel (via `CaptionDownloadRow`)
- Translation and voice translation panels

### Caption System

Caption styles stored as `ClipCaptionStyleConfig` JSON on `Clip.captionStyle`:

```typescript
interface ClipCaptionStyleConfig {
  presetId: CaptionStyleId;
  fontFamily: string; fontSize: number;
  primaryColor: string; emphasisColor: string;
  position: "top" | "middle" | "bottom";
  outline: boolean; outlineColor: string;
  background: boolean; backgroundColor: string; backgroundOpacity: number;
  karaoke: boolean; maxWordsPerLine: number; align: "left" | "center" | "right";
  animation: { type: "none"|"karaoke"|"pop"|"fade"|"slide"|"bounce"; wordHighlight: boolean; speed: "slow"|"normal"|"fast" };
  safeZoneAware: boolean;
  hookOverlays: HookOverlay[];
}
```

Animated captions (non-`"none"` type): rendered by Remotion when `REMOTION_RENDERER_ENABLED=true`. Falls back to FFmpeg static burn-in otherwise.

---

## Health & Observability

### Unified Health Endpoint

`GET /api/health` — returns per-service status and overall `"healthy" | "degraded" | "unhealthy"`.

Service checks:
| Service | Check |
|---|---|
| `database` | `SELECT 1` via Prisma, latency measurement |
| `environment` | Required env vars present; warns on optional missing vars |
| `ffmpeg` | Spawns `ffmpeg -version`, reads binary path from `FFMPEG_PATH` |
| `remotionRenderer` | Checks `REMOTION_RENDERER_ENABLED`, entry point file, `@remotion/renderer` importable, Chrome binary accessible |
| `cvWorker` | Calls `GET CV_WORKER_URL/health`, reports model status |
| `exportQueue` | In-process snapshot via `getExportQueueSnapshot()` |

Status codes: `200` for healthy/degraded, `503` for unhealthy (DB or FFmpeg down).

Additional health endpoints:
- `GET /api/media/cv-worker/health` — raw CV worker health passthrough
- `GET /api/media/render-queue/health` — export queue snapshot

### Structured Render Logs

All render operations emit structured JSON logs:

| Log event | Key fields |
|---|---|
| `render:source_probe` | `sourcePath`, `width`, `height`, `fps`, `videoCodec`, `videoBitrateKbps` |
| `render:segment` | `preset`, `crf`, `renderDurationMs`, `fileSizeBytes`, `hasCaptions`, `reframeMode`, `streamCopy` |
| `Export processing completed` | `exportId`, `renderMethod` (`"ffmpeg"` or `"remotion"`), `segmentCount` |
| `smart-reframe: detection complete` | `sampledFrames`, `faceDetections`, `personDetections`, `detectionDurationMs`, `fallback` |
| `Scene detection completed` | `provider`, `cuts`, `sceneDurationMs`, `totalDurationMs` |
| `health:system_check` | `overall`, per-service `status` + `latencyMs` |

---

## API Surface (updated)

Major groups unchanged from prior baseline. New routes added:

- `POST /api/clips/[id]/reframe/analyze` — smart reframe analysis (stable + dynamic modes, all 8 modes via `mode` param)
- `POST /api/clips/[id]/reframe/analyze-dynamic` — re-export of `/analyze` for backward compat
- `GET /api/media/cv-worker/health` — CV worker health passthrough
- `GET /api/media/render-queue/health` — export queue snapshot
- `POST /api/repurpose/retranscribe` — re-runs Whisper on stored asset, replaces transcript

Updated routes:
- `POST /api/exports` — added `exportQuality: "high" | "standard"` field (logged, stored for future quality routing)
- `PATCH /api/clips/[id]` — added `reframeMode`, `captionsEnabled`, `captionSafeZoneEnabled`, `trackingSmoothness`, `exportQuality` optional fields (Zod validated)
- `GET /api/health` — full system health (replaces old DB-only check)

---

## OpenRouter Model Routing (current, April 2026)

Source of truth: `lib/openrouter-client.ts` → `OPENROUTER_MODELS`

| Key | Model | Purpose |
|---|---|---|
| `videoIngest` | `google/gemini-2.5-flash` | Transcript metadata extraction |
| `highlights` | `google/gemini-2.5-pro` | Highlight/timestamp detection (long transcript reasoning) |
| `hooks` | `anthropic/claude-sonnet-4.6` | Hook generation |
| `scripts` | `anthropic/claude-sonnet-4.6` | Script writing |
| `captions` | `google/gemini-3.1-flash-lite-preview` | Caption refinement |
| `titles` | `google/gemini-3.1-flash-lite-preview` | Title/copy generation |
| `contentCalendar` | `anthropic/claude-sonnet-4.6` | Content calendar planning |
| `nicheAnalysis` | `google/gemini-3.1-flash-lite-preview` | Niche recommendations |
| `extensionAnalysis` | `google/gemini-3-flash-preview` | SnipRadar source analysis |
| `extensionReply` | `google/gemini-3.1-flash-lite-preview` | Reply assist |
| `extensionRemix` | `google/gemini-3-flash-preview` | Post remix |
| `snipradarViralAnalysis` | `google/gemini-3-flash-preview` | Viral tweet analysis |
| `snipradarDraftGeneration` | `anthropic/claude-sonnet-4.6` | X post generation |
| `snipradarPrediction` | `openai/gpt-5.3-chat` | Virality prediction |
| `snipradarGrowthPlanner` | `openai/gpt-5.3-chat` | Growth plan |
| `snipradarAssistant` | `google/gemini-3-flash-preview` | Chat assistant |

**Virality service** uses `google/gemini-3.1-flash-lite-preview` (not the highlights model) with `max_tokens: 2048` to stay within credit limits. Never throws — returns neutral 50-point scores on failure.

All models are env-overridable via `OPENROUTER_*_MODEL` vars.

---

## Production Setup (current)

### Running Locally

```bash
# Terminal 1 — CV worker (Python 3.12, NOT 3.14)
cd apps/cv-worker
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload

# Terminal 2 — web app
cd apps/web
pnpm dev

# Dev login (no OAuth needed)
open http://localhost:3000/signin?dev-bypass=true
```

**Python version**: Must use Python 3.12 (3.14 has no pre-built wheels for `pydantic-core`, `mediapipe`, `onnxruntime`). Python 3.12 is at `/opt/homebrew/bin/python3.12`.

### Required env vars (`apps/web/.env.local`)

```bash
DATABASE_URL=...                  # Supabase PostgreSQL
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
OPENROUTER_API_KEY=...            # All AI text/vision
OPENROUTER_ENABLED=true
OPENAI_API_KEY=...                # Whisper transcription
CV_WORKER_URL=http://localhost:8010
USE_MOCK_TRANSCRIBE=auto          # auto = try real, fallback to mock
TRANSCRIBE_PROVIDER=openai

# Remotion (optional, for animated caption exports)
REMOTION_RENDERER_ENABLED=true
PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
NEXT_PUBLIC_REMOTION_RENDERER_ENABLED=true
REMOTION_EXPORT_CRF=18
REMOTION_EXPORT_AUDIO_BITRATE=256k
REMOTION_CONCURRENCY=1
```

### Production Docker (docker-compose.prod.yml)

Services: `web` (Next.js, port 3000) + `cv-worker` (FastAPI, port 8010) + `postgres` (PostgreSQL 16, replace with Supabase URL in production).

```bash
cp apps/web/.env.production.example .env.production
# fill required values
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy
```

`apps/web/Dockerfile` is multi-stage (Node 20 Alpine: deps → builder → runner). Includes `ffmpeg` via `apk add`.

Full production guide: `docs/PRODUCTION_DEPLOYMENT.md`.

### Database state

- Provider: PostgreSQL (Supabase in production)
- 23 migrations applied, schema up to date
- No pending migrations for smart reframe, Remotion, or CV worker (all use existing JSON fields)

---

## Current Launch Posture

Unchanged from previous baseline:
- `NEXT_PUBLIC_V1_CORE_ENABLED=true` — exposes core ViralSnipAI workspace
- `NEXT_PUBLIC_V2_CREATOR_GROWTH_ENABLED=false` — hides creator-growth surfaces
- `NEXT_PUBLIC_V3_AUTOMATION_OS_ENABLED=false` — hides SnipRadar/automation

V1 default sidebar: Dashboard, Projects, Create Clip, Exports, Brand Kit, Billing, Settings.

---

## Feature Flags

Central source of truth: `apps/web/config/features.ts`. Compatibility files: `lib/feature-flags.ts`, `lib/feature-flag-registry.ts`.

**New media/render flags (not in launch flag system — env vars only):**

| Env var | Default | Effect |
|---|---|---|
| `REMOTION_RENDERER_ENABLED` | `false` | Enable Remotion animated exports |
| `NEXT_PUBLIC_REMOTION_RENDERER_ENABLED` | `false` | Show Remotion badge in export UI |
| `SMART_REFRAME_ENABLED` | `true` | Enable smart reframe detection |
| `SMART_REFRAME_DETECTOR_PROVIDER` | `auto` | `auto` \| `local_cv` \| `openrouter` \| `fallback` |
| `CV_WORKER_URL` | unset | When set, enables local CV detection |
| `TRANSCRIBE_PROVIDER` | `openai` | `openai` \| `openrouter` |

Launch group flags and individual V2/V3 flags are unchanged from previous baseline — see `config/features.ts`.

---

## Testing State

**Unit test count: 133+ passing** (as of April 27, 2026). Zero TypeScript errors in production files (pre-existing test file errors ignored).

Test suites relevant to media pipeline:

| Suite | File | Tests |
|---|---|---|
| FFmpeg reframe filters | `lib/__tests__/ffmpeg-reframe.test.ts` | 8 |
| FFmpeg caption overlay | `lib/__tests__/ffmpeg-caption-overlay.test.ts` | 2 |
| Video quality policy | `lib/__tests__/video-quality-policy.test.ts` | 19 |
| Smart reframe | `lib/__tests__/smart-reframe.test.ts` | 26 |
| CV worker client | `lib/__tests__/cv-worker-client.test.ts` | 15 |
| Scene detection | `lib/repurpose/__tests__/scene-detection.test.ts` | 6 |
| Remotion renderer | `lib/__tests__/remotion-renderer.test.ts` | 16 |
| Health service | `lib/__tests__/health-service.test.ts` | 15 |
| Phase 10 productization | `lib/__tests__/phase10-productization.test.ts` | 23 |

Running tests:
```bash
cd apps/web
pnpm test:unit                          # all Jest unit tests
npx jest "smart-reframe|ffmpeg|cv-worker|remotion|health" --no-coverage
```

---

## Known Drift And Risks (updated)

- **`docker-compose.yml`** — still starts PostgreSQL for local dev only; `docker-compose.prod.yml` is the production stack.
- **Python 3.14 incompatibility** — CV worker must use Python 3.12 (`/opt/homebrew/bin/python3.12`). Python 3.14 has no pre-built wheels for pydantic-core/mediapipe/onnxruntime.
- **Remotion bundle time** — First animated export takes ~30s to bundle the Remotion composition. Subsequent exports reuse the cached bundle.
- **`remotion-clip-preview.tsx` TypeScript errors** — Pre-existing TS errors in this file (Remotion v4 + `moduleResolution: Node` incompatibility for `.js` extension re-exports). Non-blocking; the file works at runtime. `moduleResolution: Bundler` is set in `tsconfig.json` but the pre-existing errors remain because `tsbuildinfo` cache was stale.
- **Jest `remotion` module shadowing** — `jest.config.js` pins `'^remotion$'` to `node_modules/remotion` to prevent the local `remotion-compositions/` directory from shadowing the npm package.
- **`@rspack/binding` webpack error** — `next.config.mjs` adds webpack externals for `@rspack/**` and `@remotion/bundler`. Removing these externals will crash the Next.js dev server.
- **YOLO model not configured** — Person detection falls back to OpenCV HOG (weaker) when `CV_YOLO_MODEL_PATH` is not set. The app still works; just less accurate person detection.
- **Virality service credit dependency** — Uses OpenRouter credits per analysis call. `max_tokens: 2048` and model `google/gemini-3.1-flash-lite-preview` keep costs low. Returns default 50-point scores on failure instead of throwing.
- **Typecheck debt** — Pre-existing type errors in test files and `remotion-clip-preview.tsx` (not introduced by recent work).
- **Media runtime risk** — FFmpeg jobs still run inside the web app process through an in-memory queue. Production should move sustained media workloads to a dedicated worker.
- **API response consistency** — Standardized response helpers exist; large API surface likely has mixed response shapes in older routes.

---

## Data Model Notes (updated)

No schema migrations were added during the media upgrade phases (Phases 0-10). All new data is stored in existing JSON fields:

- `Clip.viralityFactors` (JSON) — `metadata.smartReframe` holds `SmartReframePlan`; `reframePlans[].dynamicCropPath` holds dynamic crop keyframes; `reframePlans[].dynamicCropSource` holds source dimensions
- `Clip.captionStyle` (JSON) — `animation.type` / `animation.speed` / `animation.wordHighlight` for Remotion animated exports

---

## Product State To Build From (updated)

- **V1 Core Video Repurposing** is the primary product. End-to-end flow (upload → detect → edit → framing → export) is fully implemented and tested.
- **Smart reframe (stable + dynamic)** is production-ready. Dynamic modes are soft-gated as "Pro" in UI; server-side enforcement via billing plan can be added when needed.
- **Remotion animated exports** are opt-in. Activate with `REMOTION_RENDERER_ENABLED=true` + Chrome path. Free users get FFmpeg static caption fallback automatically.
- **CV worker** is independently deployable. Web app degrades gracefully when it's unavailable — detection falls back through OpenRouter vision → center crop.
- **Phases 0-10 of MEDIA_CV_REMOTION_UPGRADE_TRACKING.md are complete.** No pending work in that track.

## High-Value Next Engineering Moves

1. **Wire `exportQuality` to actual FFmpeg preset selection** in `render-queue.ts` (the field is logged but `high_quality_export` is always used currently).
2. **Implement `blurred_background` render** in FFmpeg (`boxblur` + `scale2ref` overlay) — it's defined in the type system and UI but not yet rendered.
3. **Plan-gate dynamic tracking** server-side: check `user.plan` in `/api/clips/[id]/reframe/analyze` and return 403 for free users on `dynamic_*` modes.
4. **YOLO model artifact delivery** — add model download instructions or bundle a lightweight model for person detection in production deploys.
5. **Move media rendering to a dedicated worker** — `apps/web/lib/render-queue.ts` runs FFmpeg inside the web process; production scaling requires a separate Node.js worker with access to the shared `uploads/` volume.
6. **Normalize API response envelopes** on V1 critical paths (upload, export, clip update).
7. **Playwright E2E test for the full V1 flow** — upload → detect → framing → export → download.
8. **Keep this file updated** after major feature, schema, or launch-scope changes.
