Clipping Pipeline — Verified Bug Report
Pipeline Overview (what actually exists)

[YouTube/Upload]
    ↓ POST /api/repurpose/ingest         → YouTubeIngestJob (queued in lib/youtube-ingest-queue.ts)
    ↓ background worker                   → downloads, transcribes, creates Asset
[Asset ready with transcript]
    ↓ POST /api/repurpose/auto-highlights → GenerateAutoHighlightsUseCase
    ↓                                       - probes duration / transcribes if missing
    ↓                                       - AI suggests highlights
    ↓                                       - detects scene cuts (CV worker → ffmpeg fallback)
    ↓                                       - DELETES all existing clips for projectId  ⚠️
    ↓                                       - creates clips + previews + thumbnails
[Clips exist]
    ↓ PATCH /api/clips/[id]              → UpdateClipUseCase (silently drops several fields ⚠️)
    ↓ PATCH /api/clips/[id]/trim         → TrimClipUseCase (5-min default duration ⚠️)
    ↓ POST  /api/clips/[id]/split        → SplitClipUseCase (no transaction ⚠️)
    ↓ POST  /api/clips/[id]/reframe/analyze → smart-reframe (temp dir leak ⚠️)
[Reframed clips]
    ↓ POST /api/exports                   → QueueExportUseCase → render-queue.ts
    ↓                                       - separate from Inngest, custom queue
Inngest is not used for clip/repurpose/render — it only runs SnipRadar jobs. Repurpose has its own queue at lib/youtube-ingest-queue.ts and a separate lib/render-queue.ts. This split is intentional but means failure recovery, observability, and retry policies are inconsistent across the two queues.

CRITICAL BUGS (confirmed by reading code)
C1. Auto-highlights nukes ALL existing clips on every run
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:216


// Step 5: Delete existing clips for this asset (clean slate)
await this.clipRepo.deleteByProjectId(asset.projectId);
If a user has trimmed clips, edited captions, customized reframe modes, then clicks "Auto-generate highlights" again — everything is wiped. There is no warning UI, no "merge", no "regenerate only missing" mode. Single biggest source of "I lost my work" UX complaints.

Fix: Either prompt the user to confirm before re-running, or move existing clips to a soft-deleted state, or add a mode: 'merge' | 'replace' option.

C2. PATCH /api/clips/[id] silently drops 5 fields
File: apps/web/app/api/clips/[id]/route.ts:97-115

The Zod schema accepts reframeMode, trackingSmoothness, exportQuality, captionsEnabled, captionSafeZoneEnabled — but normalizedUpdates only forwards 8 of the 13 fields. The API returns 200 OK and "Clip updated successfully" while silently dropping reframe-related settings.


// schema accepts these:
reframeMode, trackingSmoothness, exportQuality, captionsEnabled, captionSafeZoneEnabled
// but normalizedUpdates only spreads:
title, summary, callToAction, captionSrt, previewPath, startMs, endMs, transcriptEditRangesMs, captionStyle
This is almost certainly the "clipping not efficient" symptom — users change reframe mode in UI, hit save, server says success, export uses old mode.

Fix: Add the missing 5 fields to normalizedUpdates and ensure UpdateClipUseCase/IClipRepository accept them.

C3. SplitClipUseCase has no DB transaction
File: apps/web/lib/application/use-cases/SplitClipUseCase.ts:103-112


const createdFirstClip = await this.clipRepo.create(firstClipData);
const createdSecondClip = await this.clipRepo.create(secondClipData);
// ...
await this.clipRepo.delete(clipId);
If create(secondClipData) fails after create(firstClipData) succeeded, you have a duplicate clip with no original. If delete(clipId) fails after both creates, you have 3 clips where there should be 2. There's no rollback.

Fix: Wrap in prisma.$transaction([...]) so all three ops succeed or all roll back.

C4. Smart reframe leaks /tmp directories on every "no frames" path
File: apps/web/lib/media/smart-reframe/face-person-tracker.ts:62, 113-117, 179-186


// extractSampleFrames creates the dir:
await fs.mkdir(tempDir, { recursive: true });          // line 63
// returns [] if FFmpeg produces 0 frames

// cleanupTempFrames does nothing when array is empty:
export async function cleanupTempFrames(framePaths: string[]) {
  if (framePaths.length === 0) return;                  // line 114 — early exit
  const dir = path.dirname(framePaths[0]);
  await fs.rm(dir, { recursive: true, force: true });
}

// sampleAndDetect early-returns on 0 frames; finally runs but cleanup is a no-op:
if (framePaths.length === 0) { return ...; }            // line 186 — tempDir leaked
Every reframe call where FFmpeg produces no frames (corrupt segment, very short clip, codec issue) leaks an empty directory under /tmp/sr-frames-*. Over time /tmp fills up and eventually frame extraction itself fails, which loops back into this same path.

Fix: Track tempDir separately from framePaths and clean the directory unconditionally:


let tempDir: string | null = null;
try {
  tempDir = path.join(os.tmpdir(), `sr-frames-${...}`);
  await fs.mkdir(tempDir, { recursive: true });
  // ...
  return ...;
} finally {
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null);
}
HIGH BUGS
H1. Trim falls back to 5-minute duration if asset.durationSec is missing
File: apps/web/lib/application/use-cases/TrimClipUseCase.ts:63


let assetDurationSec = 300; // Default 5 minutes
if (clip.assetId) {
  const asset = await this.assetRepo.findById(clip.assetId);
  if (asset?.durationSec) {
    assetDurationSec = asset.durationSec;
  }
}
this.clipManipulation.validateTrimBoundaries(startMs, endMs, assetDurationSec);
If durationSec is null/0 (which happens when ingest didn't probe correctly), trimming a 60-min video to e.g. endMs=900000 (15 min) fails validation against the 300-sec default. User sees cryptic "out of bounds" error.

Fix: If asset.durationSec is unavailable, probe it on the fly via transcriptionService.probeDuration(asset.path) instead of using a hardcoded fallback.

H2. Auto-highlights default duration is 180s (3 min) when probe fails
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:111


durationSec = probedDuration || 180; // Default to 3 minutes if probe fails
For a 30-minute video where probe momentarily fails, AI is told "you have a 3-minute video" → it picks highlights from minutes 0–3 only, ignoring the rest. User wonders why all clips are from the start of the video.

Fix: If probe fails, throw an error rather than silently truncate. Probe failure is a real problem, not something to paper over.

H3. Source path resolution heuristic is fragile
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:354-366


if (path.isAbsolute(assetPath)) {
  sourceVideoPath = assetPath;
} else if (assetPath.startsWith('/uploads')) {
  sourceVideoPath = path.join(process.cwd(), 'public', assetPath);
} else {
  sourceVideoPath = path.join(process.cwd(), 'public', assetPath);
}
This duplicates path resolution logic that's centralized elsewhere (see getLocalUploadDir and the resolveLocalPath helper in reframe/analyze/route.ts). When the storage driver is s3, assetPath is an S3 URL and this function happily prepends process.cwd()/public to it, producing nonsense like /Users/.../public/https://bucket.s3.amazonaws.com/file.mp4. Preview generation silently fails for every clip.

Fix: Use the shared resolveLocalPath helper or, better, a single MediaPathResolver service that knows about both local and S3 storage drivers.

H4. CV worker has no retry — first transient failure permanently degrades
File: apps/web/lib/media/cv-worker-client.ts:89-118


async function postCvWorker<TResponse>(...) {
  // single-shot fetch with timeout
  // on error, throws; on null body, throws; no retry
}
Default timeout is 30s (45s for scene detection). One slow request → CV worker drops out → falls back to slower FFmpeg path for the rest of the request. No exponential backoff, no jittered retry. Users get inconsistent reframe quality depending on whether their first call hit a cold CV worker.

Fix: Add withRetry(fn, { retries: 2, backoffMs: 800, jitter: 0.2 }) wrapper. Treat AbortError and 5xx as retryable; treat 4xx as terminal.

H5. Preview generation failures are silently swallowed
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:432-442


} catch (error) {
  logger.error('Failed to generate preview for clip', { ... });
  // Continue without preview - log error but don't fail the entire process
}
// ...
await Promise.allSettled(previewPromises);
If 9 out of 10 preview renders fail, the API returns success with 10 clips — but 9 have previewPath: null. The UI shows broken thumbnails and no error indication. This is the exact "clipping not working efficiently" symptom users would see.

Fix: Aggregate failures and return them in the analytics block:


analytics: {
  ...
  previewsGenerated: succeeded.length,
  previewFailures: failures.length,
  previewFailureReasons: failures.map(f => f.reason),
}
And surface this in the UI so users know which clips need a regen.

H6. Scene threshold is process-wide env var, no per-project override
File: apps/web/lib/repurpose/scene-detection.ts:32


threshold: Number(process.env.CV_SCENE_THRESHOLD ?? 27)
A talking-head video and a fast-cut vlog need very different thresholds. With a single env-controlled value, one type always under- or over-cuts. If the env var is unset and CV worker isn't deployed, FFmpeg fallback uses hardcoded 0.34 (line 64) — which is on a totally different scale (FFmpeg uses 0–1, CV worker uses absolute pixel diff).

Fix: Accept threshold as input on the detectRepurposeSceneCuts call (with sensible default), and surface as a per-project setting.

MEDIUM BUGS
M1. WORDS_PER_CUE = 4 is hardcoded and identical for all video types
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:531

A 4-words-per-cue rule is fine for slow podcasters but produces choppy, fast-flicker captions for fast talkers. Should adapt to words-per-second.

M2. PATCH clip-update has no optimistic concurrency check
File: apps/web/app/api/clips/[id]/route.ts

If two browser tabs edit the same clip (start/end vs caption text), last write wins silently. The Clip model has no version field. Add version and check version === expectedVersion in the update repo.

M3. Reframe analyze allocates default geometry 1920x1080 when probe fails
File: apps/web/app/api/clips/[id]/reframe/analyze/route.ts:103-114


let sourceWidth = 1920;
let sourceHeight = 1080;
try {
  const geometry = await probeVideoGeometry(sourcePath);
  ...
} catch (err) {
  // continues with defaults
}
Falling back to 1920×1080 when the source is actually 4K (3840×2160) means crop coordinates are computed against a 1920×1080 grid and produce wrong crops on the real 4K video. Should fail loudly (return 500) instead of silently producing garbage.

M4. No idempotency on YouTubeIngestJob queue insertion
File: apps/web/app/api/repurpose/ingest/route.ts

A user double-clicking the "Ingest" button creates two YouTubeIngestJob rows for the same (projectId, sourceUrl). Both run, both produce duplicate Assets, both auto-highlight, both kick off deleteByProjectId → race condition where one job's clips get nuked by the other.

Fix: prisma.youTubeIngestJob.upsert keyed on (projectId, sourceUrl, status='queued') — if there's already a queued/running job for this URL, return that job's ID instead of creating a new one.

M5. Promise.allSettled for previews silently parallelizes ALL clips
File: apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts:374, 442

For a 20-clip project, this fires 20 concurrent FFmpeg processes against the same source file. On a single-core dev machine or a small Vercel function, this saturates CPU and times out. Should be limited via pLimit(3) or similar.

LOW / NICE-TO-HAVE
L1. transcriptEditRangesMs ranges aren't validated against the actual transcript content — empty ranges accepted.
L2. Source video metadata probed multiple times across the pipeline (auto-highlights, reframe, preview). Cache geometry + durationSec on Asset row after first probe.
L3. Project model has no status enum (ingesting | ready | exporting | failed) — UI must infer state from join queries.
L4. Reframe plans are recomputed on every PATCH even when geometry hasn't changed.
L5. Mixed Ms/Sec math throughout the pipeline — consider branded types Milliseconds & Seconds to prevent accidental factor-of-1000 bugs.
Suggested Fix Order
These are the fixes that map directly to "clipping doesn't work efficiently":

C2 — PATCH dropping reframe fields → fix first, this is THE most likely source of the symptom users see (15 min)
C1 — Auto-highlights wiping clips → either confirm dialog or merge mode (45 min)
C4 — /tmp leak → tracking dir separately (10 min)
C3 — Split transaction → wrap in $transaction (15 min)
H1, H2 — Replace silent duration defaults with proper probe-or-throw (30 min)
H3 — Path resolution unification (45 min)
H5 — Surface preview failures in API response (30 min)
H4 — CV worker retry wrapper (45 min)
M4 — Idempotent ingest job (30 min)
M5 — Concurrency limit on preview generation (15 min)
Total: ~5 hours of focused work for the critical-to-high tier.

Want me to start fixing? I'd recommend the order above — start with C2 since that's the smoking-gun for the "not clipping efficiently" complaint, then C1 since wiping user edits is the most painful UX bug. Confirm and I'll implement them with proper before/after testing.