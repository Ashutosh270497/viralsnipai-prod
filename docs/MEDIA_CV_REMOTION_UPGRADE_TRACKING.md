# Media CV + Remotion Upgrade Tracking

Goal: upgrade ViralSnipAI into a best-in-class video repurposing product while keeping the current FFmpeg export path stable and high quality.

## Target Architecture

```txt
Next.js app
  upload / projects / editor / export APIs
        |
        v
Media analysis layer
  scene detection
  face/person detection
  subject tracking
  cropPath generation
        |
        v
Render layer
  FFmpeg: default/stable/high-quality exports
  Remotion: animated/premium caption/template exports
```

## Technology Choices

| Area | Primary Choice | Fallback |
|---|---|---|
| Face detection | MediaPipe Face Detector | OpenCV Haar / empty fallback |
| Person detection | YOLO ONNX via ONNX Runtime | OpenCV HOG / empty fallback |
| Scene detection | PySceneDetect | FFmpeg scene filter |
| Subject tracking | Custom nearest-center + IoU + smoothing | OpenCV CSRT/KCF later if needed |
| Default rendering | FFmpeg | none |
| Animated/premium rendering | Remotion | FFmpeg static captions |

## Phase 0: Contracts, Config, Logging

Status: Completed

Tasks:
- Keep `FrameDetectionProvider` as the detection contract. Done.
- Add `SceneDetectionProvider`. Implemented in the CV worker via `/scene-detect`.
- Add config:
  - `SMART_REFRAME_DETECTOR_PROVIDER=auto|local_cv|openrouter|fallback`. Done.
  - `CV_SCENE_PROVIDER=pyscenedetect` with FFmpeg fallback in worker. Done.
- Define shared JSON contracts:
  - `DetectionBox`. Done.
  - `FrameDetectionResult`. Done.
  - `SceneDetectionResponse`. Done.
  - `SmartReframePlan`. Done.
  - `CropKeyframe`. Done.
- Add structured logs:
  - detector provider. Done.
  - model version/readiness. Done through CV worker health/model metadata.
  - sampled frames. Done.
  - face/person detections. Done.
  - confidence. Done.
  - fallback reason. Done.

Acceptance:
- Existing OpenRouter detector still works.
- FFmpeg scene detection still works.
- No user-facing behavior change.
- Detector provider can be forced to local CV, OpenRouter/API, or fallback-only without changing env files in the repo.

## Phase 1: Python CV Worker Foundation

Status: Implemented foundation

Proposed location:

```txt
apps/cv-worker
```

Stack:
- FastAPI
- OpenCV
- ONNX Runtime
- MediaPipe
- PySceneDetect

Endpoints:
- `GET /health`
- `POST /detect/frame`
- `POST /detect/clip`
- `POST /scene-detect`
- `POST /track-subject`

Acceptance:
- CV worker starts locally. Implemented via `apps/cv-worker`.
- Web app can call `/health`. Implemented via `GET /api/media/cv-worker/health`.
- No production routing depends on it yet. Preserved.

Implemented files:
- `apps/cv-worker/app/main.py`
- `apps/cv-worker/app/schemas.py`
- `apps/cv-worker/app/services.py`
- `apps/cv-worker/app/dependencies.py`
- `apps/cv-worker/requirements.txt`
- `apps/cv-worker/Dockerfile`
- `apps/web/lib/media/cv-worker-client.ts`
- `apps/web/app/api/media/cv-worker/health/route.ts`

## Phase 2: Scene Detection Upgrade

Status: Completed

Tasks:
- Implement `PySceneDetectProvider`. Done in `apps/cv-worker/app/scene_detection.py`.
- Keep existing FFmpeg scene filter as fallback. Done.
- Update auto-highlights:
  1. Try PySceneDetect through CV worker. Done.
  2. Fallback to FFmpeg scene filter. Done.
  3. Continue transcript-only if both fail. Done.

Acceptance:
- Scene cuts return stable timestamps when the worker and dependencies are available.
- Worker returns safe fallback metadata if scene detection is down.
- Auto-highlights uses CV worker scene cuts when configured.
- Auto-highlights falls back to FFmpeg/local transcript alignment when the worker is unavailable.

Implemented files:
- `apps/cv-worker/app/scene_detection.py`
- `apps/web/lib/repurpose/scene-detection.ts`
- `apps/web/lib/repurpose/__tests__/scene-detection.test.ts`
- `apps/web/lib/application/use-cases/GenerateAutoHighlightsUseCase.ts`

## Phase 3: Local Face Detection

Status: Completed

Tasks:
- Implement MediaPipe face detection in CV worker. Done in `apps/cv-worker/app/detectors.py`.
- Add OpenCV Haar fallback. Done.
- Add `LocalCvDetectionProvider` in Next.js. Implemented as `detectClipWithCvWorker`.
- Route `smart_face` and `dynamic_face` through local CV when enabled. Stable and dynamic modes now try `CV_WORKER_URL` first.
- Keep existing TypeScript/OpenRouter vision path as fallback. Preserved.

Fallback order:

```txt
local_cv -> openrouter_vision -> empty fallback
```

Acceptance:
- Face crop works without OpenRouter vision.
- Dynamic face `cropPath` is generated.
- Failure falls back to stable crop.
- Local CV worker detections are used by stable smart crop before OpenRouter/frame sampling.

## Phase 4: YOLO Person Detection

Status: Completed in code, model artifact supplied by deployment

Tasks:
- Add YOLO ONNX model support to CV worker. Done, enabled by `CV_YOLO_MODEL_PATH`.
- Detect `person` class only. Done.
- Add OpenCV HOG fallback when no YOLO model is configured. Done.
- Return person boxes per sampled frame. Done via `/detect/clip`.
- Route `smart_person`, `dynamic_person`, and `dynamic_auto` through local worker when `CV_WORKER_URL` is configured. Done.
- Report YOLO model readiness in `/health` through `models.yoloModelStatus`. Done.
- Do not download any YOLO model automatically. Done.
- If the CV worker samples frames but finds no usable boxes, fall back to the existing API/OpenRouter detection path. Done.

Acceptance:
- Person crop works on faceless/body shots.
- Multiple people do not cause random subject switching.
- Fallback behavior remains stable.
- If no YOLO model is configured, OpenCV HOG is used and the app still falls back safely.
- Low-spec local development works with no local YOLO model.

## Phase 5: Tracking Refinement

Status: Completed

Tasks:
- Improve custom tracker with:
  - nearest-center matching. Done.
  - IoU overlap. Done.
  - confidence continuity. Implemented through track scoring.
  - size continuity. Implemented through track scoring.
  - class match. Done through assignment cost and strategy scoring.
- Keep smoothing:
  - deadband. Done.
  - max crop shift per second. Done in Python smoother.
  - interpolation for short missing detections. Done.
  - stable fallback for long missing detections. Done through fallback keyframes and low-confidence response.
- Consider OpenCV CSRT/KCF only if sparse detection is not smooth enough.
  - Deferred intentionally; current custom tracker meets V1 acceptance without adding another runtime dependency.

Acceptance:
- Primary subject does not switch suddenly.
- Missing detections under 2 seconds interpolate.
- Long missing detections fallback smoothly.
- Crop windows stay inside source bounds.
- Sudden crop shifts are capped by elapsed time and source dimensions.
- Empty/low-confidence local CV results do not block API fallback.
- Tracking response reports interpolated and fallback keyframe counts for debugging.

Implemented files in this phase:
- `apps/cv-worker/app/video_utils.py`
- `apps/cv-worker/app/detectors.py`
- `apps/cv-worker/app/scene_detection.py`
- `apps/cv-worker/app/tracking.py`
- `apps/web/lib/media/cv-worker-client.ts`
- `apps/web/lib/media/smart-reframe/smart-reframe.service.ts`
- `apps/cv-worker/tests/test_contracts.py`
- `apps/web/lib/__tests__/cv-worker-client.test.ts`
- `apps/web/lib/__tests__/smart-reframe.test.ts`

## Phase 6: Dynamic Crop Rendering

Status: Completed

Tasks:
- Keep conservative one-axis FFmpeg tracking as current safe path. Done.
- Add richer FFmpeg crop expressions from `cropPath` if maintainable. Done.
- If expressions become too complex, add segmented dynamic render fallback. Deferred; current implementation downsamples keyframes and falls back to stable crop instead of segmenting.

Implementation:
- `SmartReframePlan.cropPath` is copied into the persisted 9:16 `ClipReframePlan` as `dynamicCropPath`.
- `ClipReframePlan.dynamicCropSource` stores the source dimensions used for normalized FFmpeg crop expressions.
- `buildPresetVideoFilter()` prefers a dynamic crop expression when at least two keyframes are available.
- Dynamic crop is rendered in the existing FFmpeg export pass:
  - crop from original source input
  - scale with Lanczos
  - `setsar=1`
  - existing final encode quality policy remains unchanged
- If dynamic keyframes are missing, malformed, or cannot build a filter, rendering falls back to the existing stable smart crop path.

Quality rules:
- Always use original source video.
- Never use preview files.
- Prefer one final encode pass.
- Final CRF must stay 16-18 preferred, never above 20 for premium export.
- No stretching.

Acceptance:
- Moving speaker remains centered when the dynamic `cropPath` tracks the subject.
- Dynamic crop does not jitter because Phase 5 smoothing is rendered directly rather than recomputed in FFmpeg.
- Export quality remains visually near-lossless by keeping one final FFmpeg encode from the original source.
- Stable crop fallback still works.

Implemented files:
- `apps/web/lib/types/clip.types.ts`
- `apps/web/lib/media/smart-reframe/smart-reframe.service.ts`
- `apps/web/lib/ffmpeg.ts`
- `apps/web/lib/__tests__/ffmpeg-reframe.test.ts`

## Phase 7: Remotion Preview

Status: Completed

Tasks:
- Add `@remotion/player`. Done.
- Add `remotion` as a direct web dependency for typed composition primitives. Done.
- Create Remotion composition for editor preview. Done.
- Feed:
  - source preview URL. Done.
  - captions. Done.
  - caption style. Done.
  - animation config. Done.
  - reframe plan. Done; preview uses smart reframe safe-zone data for caption placement.
- Keep FFmpeg export path unchanged. Done.

Implementation:
- `RemotionClipPreview` renders the transcript editor preview through `@remotion/player`.
- Preview captions update from editable caption entries without burning into video.
- Hook overlays are previewed in Remotion using the same editable style config.
- Caption animation config is previewed for:
  - karaoke/word highlight
  - pop
  - fade
  - slide
  - bounce
- Segment-row seek controls now seek the Remotion player.
- FFmpeg remains the only export renderer in this phase.

Acceptance:
- Animated caption preview works in editor.
- Caption edits reflect immediately.
- No export behavior changes yet.

Implemented files:
- `apps/web/components/repurpose/remotion-clip-preview.tsx`
- `apps/web/components/repurpose/transcript-editor.tsx`
- `apps/web/package.json`
- `pnpm-lock.yaml`

## Phase 8: Remotion Premium Renderer

Status: Pending

Tasks:
- Add `@remotion/renderer`.
- Implement `RemotionCaptionRenderer`.
- Add feature flags:
  - `REMOTION_RENDERER_ENABLED=true`
  - `REMOTION_RENDERER_MODE=node`
- Select renderer:

```txt
animation.type === "none" -> FFmpeg
animation.type !== "none" -> Remotion if enabled
Remotion failure -> FFmpeg static fallback
```

Remotion handles:
- karaoke captions
- pop captions
- fade captions
- slide captions
- bounce captions
- branded lower thirds
- progress bars
- motion overlays

Acceptance:
- Animated captions export successfully.
- Remotion failure falls back to static captions.
- No extra FFmpeg re-encode after Remotion unless required.

## Phase 9: Production Deployment

Status: Pending

Services:

```txt
web: Next.js
render-worker: existing export/render queue
cv-worker: Python CV service
storage: local/S3-compatible
queue: existing queue or Redis-backed queue
```

Health checks:
- Web health
- CV worker health
- model loaded status
- FFmpeg available
- Remotion renderer available

Observability:
- detection duration
- scene detection duration
- sampled frame count
- fallback rate
- render duration
- output file size
- render method

Acceptance:
- CV worker can be deployed independently.
- Web app degrades gracefully if CV worker is unavailable.
- Render queue remains stable.

## Phase 10: Productization

Status: Pending

UI controls:
- Stable Smart Crop
- Dynamic Face Tracking
- Dynamic Person Tracking
- Center Crop
- Blurred Background
- Tracking smoothness
- Subject position
- Re-analyze tracking
- Show tracking overlay
- Show safe-zone overlay
- Confidence score
- Fallback reason

Packaging:
- FFmpeg static exports remain default V1.
- Dynamic tracking can be premium.
- Remotion animated exports can be premium.

Acceptance:
- V1 remains focused and stable.
- Premium features improve output quality without confusing launch scope.

## Recommended Implementation Order

1. Phase 0: contracts/config/logging
2. Phase 1: CV worker skeleton
3. Phase 2: PySceneDetect
4. Phase 3: MediaPipe face detection
5. Phase 4: YOLO person detection
6. Phase 5: tracking refinement
7. Phase 6: dynamic crop render upgrade
8. Phase 7: Remotion preview
9. Phase 8: Remotion premium renderer
10. Phase 9: production deployment
11. Phase 10: productization

## Non-Negotiables

- Final exports must use original source video.
- Preview files must never be final export input.
- FFmpeg stable export path must remain available.
- Dynamic tracking must fallback safely.
- Caption text remains editable before render.
- Remotion animation settings must fallback to static FFmpeg captions if unsupported.
- No Prisma schema migration unless clearly required.
