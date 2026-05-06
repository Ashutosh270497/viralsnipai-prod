# ViralSnipAI Prelaunch QA

Use this checklist before calling the V1 clipping product launch-ready. The goal is to verify real browser behavior and real video output, not only build health.

## Required Local Setup

1. Apply all Prisma migrations against the target database:
   ```bash
   pnpm --filter web exec prisma migrate deploy
   pnpm --filter web exec prisma generate
   ```
2. Start the web app:
   ```bash
   pnpm --filter web dev
   ```
3. Start any required worker process for CV/reframe/rendering if the environment uses it.
4. Confirm `.env.local` includes:
   - `OPENAI_API_KEY`
   - `OPENAI_TRANSCRIBE_MODEL`
   - `OPENAI_TRANSCRIBE_CHUNK_SECONDS`
   - `OPENROUTER_API_KEY`
   - `OPENROUTER_HIGHLIGHT_RERANK_MODEL`
   - `OPENROUTER_VIRALITY_MODEL`
   - `OPENROUTER_METADATA_MODEL`
   - `OPENROUTER_CAPTION_MODEL`
   - `STORAGE_DRIVER`
   - `LOCAL_UPLOAD_DIR`
   - `FFMPEG_PATH` if needed on the machine

## A. Fresh Project Test

1. Sign in.
2. Create a new project.
3. Upload a 3-5 minute video with clear speech.
4. Generate clips with the `balanced` clip-length preset.
5. Confirm auto-highlights analytics include:
   - `providerTranscription: "openai"`
   - `providerReasoning: "openrouter"`
   - `transcriptionModel`
   - `rerankModel`
   - `viralityModel`
   - `transcriptPrecision`
   - `candidatesGenerated`
   - `candidatesReranked`
   - `clipsCreated`
   - `boundaryConfidenceCounts`
   - `clipLengthPreset`
   - `clipPolicy`
6. Confirm `candidatesGenerated` is greater than `clipsCreated`.
7. Open `/repurpose/editor?projectId=<projectId>`.
8. Confirm clip thumbnails or placeholders render without a Next Image runtime error.
9. Approve one clip and reject one clip.
10. Refresh the editor and confirm review statuses persist.
11. Select one clip and edit it by transcript:
    - Set start from a word.
    - Set end from a word.
    - Mark one filler word or pause for removal.
12. Apply a caption preset.
13. Apply a `9:16` layout.
14. Open `/repurpose/export?projectId=<projectId>`.
15. Confirm rejected clips are hidden or excluded by default.
16. Export one approved/export-ready clip as MP4.
17. Play the generated MP4.
18. Download SRT/VTT if available.

Pass criteria:
- At least one generated clip has accurate start/end boundaries.
- Caption timing is usable.
- Review status survives refresh.
- The exported MP4 exists, plays, and matches the selected clip.

## B. Clip-Length Preset Test

Run generation three times on comparable source content:

1. Generate with `short`.
2. Generate with `balanced`.
3. Generate with `detailed`.

Verify:
- `short` analytics return a max policy around 30 seconds.
- `balanced` analytics return a max policy around 45 seconds.
- `detailed` analytics return a max policy around 58 seconds.
- Most resulting clips respect the selected preset unless boundary refinement has a documented reason.

## C. Long Video / Chunking Test

1. Upload a 20-40 minute video with speech throughout.
2. Generate clips with the `balanced` preset.
3. Confirm transcription chunking is triggered by duration, even if file size is small.
4. Confirm chunk timestamps merge monotonically.
5. Confirm generation does not timeout under normal local conditions.
6. Open the editor and spot-check at least three generated clips against the original source.

Pass criteria:
- Transcription does not stop at the first chunk.
- No clip has negative duration or impossible boundaries.
- Word-level transcripts remain globally aligned after chunk merge when OpenAI returns word timestamps.

## D. Old Project Regression

Use a project created before the review/caption/layout/export refactor.

1. Open `/repurpose/editor?projectId=<oldProjectId>`.
2. Confirm old clips render even when these fields are missing:
   - `reviewStatus`
   - `viralityFactors.metadata`
   - `captionStyle`
   - `layoutConfig`
   - `previewPath`
3. Confirm old `/uploads/thumbnails/...` paths render through the safe thumbnail wrapper.
4. Confirm missing thumbnails show placeholders, not runtime errors.
5. Open export and confirm old clips are either exportable or disabled with a clear reason.

Pass criteria:
- No page crash.
- No Next Image `fill` plus `style.width/style.height` runtime error.
- Old clips default to safe review and layout values.

## E. Export Truth Test

For a generated clip, export MP4 and verify the output reflects:

1. Clip `startMs` and `endMs`.
2. Transcript edit operations.
3. Caption style and selected caption track.
4. Selected layout/aspect ratio.
5. Approved/export-ready selection rules.
6. Audio/video/caption sync.

Pass criteria:
- Exported video matches editor intent as closely as the current renderer supports.
- Captions remain inside safe areas for vertical outputs.

## F. Failure Testing

Test each failure path in a controlled development environment:

1. Invalid `OPENAI_API_KEY`.
2. Invalid `OPENROUTER_API_KEY`.
3. Missing thumbnail file.
4. Missing `previewPath`.
5. Failed export job.
6. Segment-only or low-precision transcript.
7. Invalid auto-highlights model value.
8. Invalid `clipLengthPreset`.

Expected behavior:
- Invalid model and preset return validation errors.
- OpenAI failures fail transcription clearly.
- OpenRouter failures either fail the specific reasoning task or use the deterministic fallback where designed.
- Missing media shows a placeholder or retry action.
- Low precision is surfaced as a warning, not hidden.

## G. Review / Share / Social Foundation

1. Create a share link for a clip.
2. Open the tokenized share page in a private browser.
3. Leave a comment if permission allows.
4. Approve from the share link if permission allows.
5. Create a social draft from an exported clip.
6. Schedule/publish with mock publisher mode.
7. Confirm unsupported real social providers fail gracefully and are not presented as fully connected.

Pass criteria:
- Share token access is scoped.
- Social publishing is clearly mock/foundation unless real credentials/adapters are configured.

## H. API / Team / Quality Foundation

1. Create an API key.
2. Confirm the raw key is shown once.
3. Confirm only the hash/prefix is stored.
4. Call a `/api/v1/*` endpoint with the key.
5. Confirm scope/ownership checks reject unauthorized access.
6. Create a workspace and add a member if the UI/API is enabled.
7. Submit clip feedback.
8. Open quality analytics and confirm it reports acceptance/rejection/export signals.

Pass criteria:
- API keys are hash-only at rest.
- Public API routes use the same internal clipping services as the UI.
- Quality feedback records are queryable.

## I. Landing Page QA

1. Open `/`.
2. Confirm the hero is clean, readable, and dark-premium.
3. Confirm sticky nav works.
4. Confirm CTA links route correctly.
5. Confirm feature tabs work.
6. Confirm pricing content, plan names, prices, limits, and CTA behavior are unchanged.
7. Confirm mobile layout does not overflow.
8. Confirm no missing image/video assets or console errors.

## J. Quality Scoring Gate

Use this as the practical V1 readiness gate:

> ViralSnipAI should produce at least 3 publishable clips from a clear source video with less than 30 seconds of manual trimming per accepted clip.

Score each test video:

| Area | Pass Criteria |
| --- | --- |
| Hook quality | First 3 seconds make sense without long context |
| Boundary accuracy | No mid-word cuts or incomplete last sentence where word timings are available |
| Caption sync | Captions track speech closely |
| Reframe | Subject/content remains visible in selected aspect ratio |
| Export | MP4 plays, downloads, and matches editor settings |
| Review workflow | Approved/rejected/export-ready status persists |

## Final Sign-Off

Do not mark launch-ready until:

- `pnpm --filter web build` passes.
- `pnpm --filter web lint` passes or only known non-blocking warnings remain.
- `pnpm --filter web run repurpose:boundary-check` passes.
- Prisma validate/generate pass.
- Browser QA passes with real OpenAI/OpenRouter keys.
- At least one 20-40 minute source video has been tested successfully.
- Exported MP4 truth test passes.
