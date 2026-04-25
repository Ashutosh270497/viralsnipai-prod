# Repurpose OS — Multi-Page Architecture Refactoring PRD

## Context

The Repurpose feature currently renders **everything on a single page** — project selection, YouTube ingestion, file upload, viral detection prompts, AI prompt generator, transcript display, translations, voice translations, video preview canvas, timeline editor, clip list (with drag-drop, filters, sorting, bulk actions, caption editing, virality analysis), advanced features panel (4 tabs: NLP search, chapters, composite clips, caption styling), export panel, caption table, properties panel, and editor notes. The combined component tree spans **~4,800+ lines** of UI code, all loaded at once.

**Why this is a problem:**
1. **Overwhelming UX** — Users see everything at once with no clear workflow progression
2. **Heavy page load** — All 18 components + dnd-kit + video player + editor surface mount simultaneously
3. **Confused mental model** — Upload, detect, edit, style, export are all mixed vertically
4. **Mobile unusable** — Two-column editor layout doesn't work on small screens
5. **No state isolation** — Project selection, clip selection, caption editing all share the same render tree

**What exists today (all functional):**
- Project selection + YouTube ingestion + file upload
- AI-powered highlight detection with 4 model options
- AI prompt generator for viral detection
- Transcript display + text translation (6 languages)
- Voice dubbing/translation (3 languages)
- Clip list with virality scoring, drag-drop, sort, filter
- Video preview canvas + timeline editor
- Clip split, trim, caption generation
- Advanced features: NLP search, chapters, composite clips, caption styling
- Export panel (3 presets: Shorts, Square, Landscape)
- Caption editor dialog

---

## Architecture Analysis: Current Problem

```
/repurpose (single page — loads EVERYTHING)
├── RepurposeWorkspace (379 lines) — project select, upload, YouTube, translations
│   ├── useRepurposeWorkspace hook (293 lines) — ALL state + mutations
│   ├── UploadDropzone
│   ├── TranslateTranscriptDialog (162 lines)
│   ├── TranslationsList (141 lines)
│   ├── VoiceTranslateDialog (157 lines)
│   ├── VoiceTranslationsList (179 lines)
│   └── AIPromptGeneratorDialog (372 lines)
├── EditorSurfaceV2 (227 lines) — full editor environment
│   ├── PreviewCanvas — video player
│   ├── Timeline — clip timeline visualization
│   ├── CaptionTable — sidebar caption list
│   ├── PropertiesPanel — aspect ratio settings
│   ├── AdvancedFeaturesPanel (105 lines) — 4-tab advanced panel
│   │   ├── NaturalLanguageSearch (257 lines)
│   │   ├── ChapterTimeline (324 lines)
│   │   ├── CompositeClipBuilder (590 lines)
│   │   └── CaptionStyleSelector (419 lines)
│   ├── ClipList (692 lines) — drag-drop, filter, sort, bulk actions
│   │   └── CaptionEditorDialog (211 lines)
│   ├── ExportPanel (272 lines) — 3 preset cards with polling
│   └── NotesPanel
└── Total: ~4,800+ lines rendering in ONE scroll
```

**Key insight:** The user workflow is sequential — they don't need all features simultaneously:
1. First: Set up project + ingest content
2. Then: Detect highlights + review clips
3. Then: Edit, style, and enhance clips
4. Finally: Export and download

---

## Target Architecture: 3-Page Workflow

Group by **workflow stage** into 3 focused pages plus a shared layout:

```
apps/web/app/(workspace)/repurpose/
├── layout.tsx              ← NEW: shared project selector + sub-nav + context
├── page.tsx                ← REWRITE: Ingest & Detect (upload, YouTube, detection)
├── loading.tsx             ← MODIFY: simplified skeleton
├── editor/
│   ├── page.tsx            ← NEW: Edit & Enhance (preview, timeline, clips, tools)
│   └── loading.tsx         ← NEW
└── export/
    ├── page.tsx            ← NEW: Export & Translate (exports, translations, downloads)
    └── loading.tsx         ← NEW
```

### Why 3 Pages (not 5+):

| Option | Pages | Problem |
|--------|-------|---------|
| Current | 1 | Everything at once — overwhelming |
| 5+ pages | 5-7 | Too fragmented — users bounce between tabs |
| **3 pages** | **3** | **Matches natural workflow: Ingest → Edit → Export** |

Each page maps to a clear user intent:
1. **"I want to add content"** → `/repurpose` (Ingest & Detect)
2. **"I want to work on my clips"** → `/repurpose/editor` (Edit & Enhance)
3. **"I want to get my final files"** → `/repurpose/export` (Export & Translate)

---

## Architecture Design

### Shared Layout (`repurpose/layout.tsx`)

```
┌──────────────────────────────────────────────────────┐
│  Repurpose    Project: [dropdown]    [Clear]          │  ← Project bar
├──────────────────────────────────────────────────────┤
│  Ingest & Detect  │  Edit & Enhance  │  Export        │  ← Sub-nav
├──────────────────────────────────────────────────────┤
│                                                      │
│  {children}  ← sub-page content                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Context provider (`components/repurpose/repurpose-context.tsx`):**
```typescript
interface RepurposeContextValue {
  projectId: string;
  setProjectId: (id: string) => void;
  project: ProjectDetail | null;
  primaryAsset: ProjectAsset | null;
  isProjectSelected: boolean;
  isLoading: boolean;
  invalidate: () => void;
  selectedClipIds: string[];
  setSelectedClipIds: (ids: string[]) => void;
}
```

- Data from existing `useProject()` hook (no API changes)
- Project ID persisted in URL search params (`?projectId=xxx`)
- Layout reads URL param, passes down via context
- Sub-pages consume via `useRepurpose()` hook

---

### Page Breakdown

#### 1. Ingest & Detect (`/repurpose/page.tsx`) — ~300 lines

**Purpose:** Get content in and find viral moments.

**Renders:**
- YouTube URL input + "Fetch from YouTube" button (with progress)
- `<UploadDropzone>` for file uploads
- Latest asset card with transcript preview
- Detection model selector (3-tier: Gemini 3 Pro / GPT-5.2 / Gemini 2.5 Flash)
- Viral Detection Prompts section (brief, audience, tone, CTA)
- `<AIPromptGeneratorDialog>`
- "Auto-detect highlights" button (with progress)
- **CTA:** "Clips detected! Go to Editor →" (when clips exist)

**State (from `useRepurposeWorkspace` — slimmed down):**
- `sourceUrl`, `youtubeProgress`, `highlightProgress`
- `highlightModel`, `highlightBrief`, `highlightAudience`, `highlightTone`, `highlightCallToAction`

**Mutations:**
- `handleIngestYouTube` — POST `/api/repurpose/ingest` + polling
- `handleAutoHighlights` — POST `/api/repurpose/auto-highlights`

#### 2. Edit & Enhance (`/repurpose/editor`) — ~400 lines

**Purpose:** Review, edit, and enhance detected clips.

**Renders (2-column layout on desktop):**
- Left column:
  - `<PreviewCanvas>` — video player
  - `<Timeline>` — clip timeline with split/trim
  - `<AdvancedFeaturesPanel>` — 4 tabs (Search, Chapters, Composite, Captions)
  - `<ClipList>` — drag-drop clip list
- Right column:
  - `<CaptionTable>` — caption list
  - `<PropertiesPanel>` — aspect ratio settings
  - `<NotesPanel>` — editor notes

This is essentially `EditorSurfaceV2` extracted as a standalone route, reading project data from `useRepurpose()` context instead of props.

#### 3. Export & Translate (`/repurpose/export`) — ~250 lines

**Purpose:** Export clips and manage translations.

**Renders:**
- `<ExportPanel>` — 3 preset cards with status polling
- Clip selection summary
- Transcript translation: button + `<TranslateTranscriptDialog>` + `<TranslationsList>`
- Voice translation: button + `<VoiceTranslateDialog>` + `<VoiceTranslationsList>`
- Download center: completed exports with download links

---

## Data Flow

```
repurpose/layout.tsx
  Reads ?projectId from URL searchParams
  useProject(projectId) → GET /api/projects/[id]
  Provides: RepurposeContext { project, primaryAsset, selectedClipIds, invalidate }
  Shows: project selector dropdown, sub-nav tabs
  │
  ├── /page.tsx (Ingest & Detect)
  │     Reads context for primaryAsset, project
  │     Own mutations: ingestYouTube, autoHighlights
  │     Calls context.invalidate() on success
  │
  ├── /editor/page.tsx (Edit & Enhance)
  │     Reads context for project, clips, primaryAsset, selectedClipIds
  │     Own mutations: generateCaptions, split, trim
  │     Sub-components have own queries (search, chapters, etc.)
  │
  └── /export/page.tsx (Export & Translate)
        Reads context for project, primaryAsset, selectedClipIds
        Own queries: export polling (inside ExportPanel)
        Translation dialogs have own mutations
```

---

## Media Processing Runtime

RepurposeOS depends on FFmpeg-backed processing for export rendering, audio extraction, audio replacement, and related media preparation.

### Current Runtime

- FFmpeg jobs are orchestrated through `@clippers/jobs`.
- The current queue workers are booted from the web runtime.
- The concrete entrypoints today are:
  - `apps/web/lib/render-queue.ts`
  - `apps/web/lib/youtube-ingest-queue.ts`
  - `apps/web/lib/voice-translation-queue.ts`

This is acceptable for local development and transitional deployment, but it is not the intended long-term production architecture for sustained media throughput.

### Production Target

- dedicated worker or media-processing runtime
- persistent access to source and output storage
- explicit retry and failure classification separated from the web request lifecycle

### Failure Model

RepurposeOS must treat these as first-class operational failures:

- missing FFmpeg or ffprobe binary
- missing source asset
- output-path write failure
- queue stall or worker unavailability

The expected degraded behavior is explicit job failure with actionable status, not silent hanging.

---

## AI Model Upgrade: OpenRouter Video Routing

### Current (Outdated)
```typescript
// use-repurpose-workspace.ts — REPLACE
{ value: "gemini-2.5-pro",      label: "Gemini 2.5 Pro" },
{ value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash (Experimental)" },
{ value: "gpt-5-mini",          label: "OpenAI GPT-5 Mini" },
{ value: "gpt-4.1-mini",        label: "OpenAI GPT-4.1 Mini" },
```

### Current OpenRouter Selector
```typescript
export const HIGHLIGHT_MODEL_OPTIONS = [
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (Best overall)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Balanced video)" },
  { value: "qwen/qwen3.6-plus", label: "Qwen3.6 Plus (Cost-efficient video)" },
  { value: "xiaomi/mimo-v2.5", label: "MiMo V2.5 (Native audio/video)" },
  { value: "google/gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite (Fastest)" },
  { value: "openai/gpt-5.5", label: "GPT-5.5 (Premium transcript QA)" },
] as const;
```

| Tier | Model | Best For |
|------|-------|----------|
| Default | Gemini 3.1 Pro Preview | Long transcript/video reasoning and structured highlight JSON |
| Balanced | Gemini 3 Flash Preview | Faster multimodal detection and future ingest metadata |
| Cost fallback | Qwen3.6 Plus | Lower-cost video-capable long-context analysis |
| Media fallback | MiMo V2.5 | Native audio/video understanding experiments |
| Fastest | Gemini 3.1 Flash Lite Preview | Low-cost caption and short transform workloads |
| QA | GPT-5.5 | Premium transcript/file review, not default native-video detection |

**Key:** The current V1 flow still analyzes transcripts and structured video metadata after upload/transcription. Gemini 3.1 Pro is the default because it is the strongest OpenRouter-listed fit for long-context highlight reasoning and structured clip output. Gemini 3 Flash is the default for future direct video/audio ingest metadata.

**Backend change:** Update `auto-highlights/route.ts` model routing to support the new model IDs.

---

## Implementation Plan

### Step 1: Create shared infrastructure
- [x] `components/repurpose/repurpose-context.tsx` — context + provider with `useRepurpose()` hook
- [x] `components/repurpose/repurpose-sub-nav.tsx` — horizontal 3-tab navigation
- [x] `app/(workspace)/repurpose/layout.tsx` — layout with project selector + sub-nav + context

### Step 2: Create sub-pages
- [x] `repurpose/editor/page.tsx` + `loading.tsx` — editor (from EditorSurfaceV2)
- [x] `repurpose/export/page.tsx` + `loading.tsx` — exports + translations

### Step 3: Rewrite ingest page + cleanup
- [x] Rewrite `repurpose/page.tsx` to Ingest & Detect only (~300 lines)
- [x] Replace `use-repurpose-workspace.ts` with focused `use-repurpose-ingest.ts`
- [x] Update `repurpose/loading.tsx`
- [x] Remove EditorSurfaceV2 + translations from ingest page
- [x] Build verify: `pnpm --filter web build`

### Step 4: Hardening + UX workflow guards
- [x] Guard editor/export routes when a project has no ingested assets
- [x] Add cross-step CTA from editor → export when clips are selected
- [x] Add export-step CTA back to editor when no clip is selected
- [x] Remove unsafe `any` cast for translation source language wiring
- [x] Tighten repurpose context state handling (invalid `projectId`, stale selected clips)
- [x] Fix export polling cleanup for React hooks lint safety

### Step 5: Performance + stability optimization
- [x] Lazy-load heavy Advanced Features submodules (Search/Chapters/Composite/Captions)
- [x] Remove duplicate export workload from editor route (export remains dedicated page)
- [x] Preserve drag order while refreshing clip payloads
- [x] Fix caption preview object URL lifecycle to avoid memory leaks
- [x] Build verify after optimization (`pnpm --filter web build`)

### Step 6: Release gate + regression automation
- [x] Add ownership guard in ingest API (`POST /api/repurpose/ingest`)
- [x] Add executable API/UI smoke script (`pnpm --filter web run repurpose:smoke`)
- [x] Align Playwright repurpose specs with 3-page architecture
- [x] Build verify after test/smoke updates (`pnpm --filter web build`)

---

## Files to Modify

| File | Action | What Changes |
|------|--------|-------------|
| `app/(workspace)/repurpose/page.tsx` | REWRITE | Server→Client. Ingest & Detect only. |
| `app/(workspace)/repurpose/layout.tsx` | CREATE | Project selector + sub-nav + RepurposeProvider |
| `app/(workspace)/repurpose/loading.tsx` | MODIFY | Simplified skeleton |
| `app/(workspace)/repurpose/editor/page.tsx` | CREATE | Edit & Enhance (EditorSurfaceV2 content) |
| `app/(workspace)/repurpose/editor/loading.tsx` | CREATE | Editor skeleton |
| `app/(workspace)/repurpose/export/page.tsx` | CREATE | Export & Translate |
| `app/(workspace)/repurpose/export/loading.tsx` | CREATE | Export skeleton |
| `components/repurpose/repurpose-ingest-page.tsx` | CREATE | Ingest-only page surface |
| `components/repurpose/use-repurpose-ingest.ts` | CREATE | Ingest + auto-highlight state/actions |
| `components/repurpose/repurpose-context.tsx` | CREATE | Shared project context provider |
| `components/repurpose/repurpose-sub-nav.tsx` | CREATE | 3-tab sub-navigation |
| `components/repurpose/repurpose-workspace.tsx` | DELETE | Legacy monolithic page removed |
| `components/repurpose/use-repurpose-workspace.ts` | DELETE | Replaced by focused ingest hook |

**API routes:** NO changes needed.
**Prisma schema:** NO changes needed.
**All 18+ existing components:** NO changes needed.

---

## Verification

1. `pnpm --filter web build` — zero errors
2. `/repurpose` — upload, YouTube ingestion, highlight detection work
3. `/repurpose/editor?projectId=xxx` — video preview, timeline, clips, advanced features work
4. `/repurpose/export?projectId=xxx` — exports, translations, downloads work
5. Navigate between pages — project context persists via URL params
6. No project selected — appropriate empty states on each page
7. Mobile — sub-nav responsive, editor stacks vertically

## Phase 4 Standards Alignment

RepurposeOS now maps into the platform-wide experience standards:

- **Responsive support**
  - `/repurpose` (Ingest): `mobile_degraded`
  - `/repurpose/editor`: `desktop_only`
  - `/repurpose/export`: `desktop_only`
- **Accessibility baseline**
  - minimum target remains `WCAG 2.1 AA`
  - desktop-only does not waive keyboard, focus, contrast, dialog, or semantic requirements
- **Performance expectations**
  - queued export and voice-translation requests should acknowledge inside `5s`
  - export render target/max: `10m / 30m`
  - voice translation target/max: `15m / 40m`
- **Observability**
  - structured logging via `apps/web/lib/logger.ts`
  - queue/job status should surface explicit terminal failure, not hang silently
  - alert ownership for RepurposeOS heavy media paths belongs to the `media_processing` domain
