# Smart Reframe — Phase 1

> Status: Implemented  
> Module: `apps/web/lib/media/smart-reframe/`  
> API: `POST /api/clips/:clipId/reframe/analyze`  
> UI: Framing tab in the clip editor

---

## Why speakers were getting cut

The previous `buildClipReframePlans()` in `clip-optimization.ts` was **purely geometric**. It set `anchor = "speaker"` for landscape → 9:16 exports but never looked at where the speaker actually is. The `safeZone` was a hardcoded box `{ x: 0.18, y: 0.08, width: 0.64, height: 0.84 }` whose center is exactly **(0.50, 0.50)** — geometric center.

`getPlanAnchorCenter()` in `ffmpeg.ts` computed `centerX = safeZone.x + safeZone.width/2 = 0.50`. The FFmpeg crop expression then cropped centered at 50% of the frame width — a **pure center crop** regardless of where the speaker stood.

**Result**: Any speaker positioned off-center (left, right, over-the-shoulder framing, split-screen, wide shots) was cropped out.

---

## How stable smart crop works (Phase 1)

```
Source video
    │
    ├─ FFmpeg extracts N frames (every 750ms, max 8 frames)
    │   at 480px width, JPEG quality 4
    │
    ├─ VisionApiDetectionProvider sends frames to OpenRouter
    │   Model: google/gemini-3.1-flash-lite-preview
    │   Prompt: return JSON { faces: [...bboxes], persons: [...bboxes] }
    │
    ├─ aggregateFrameDetections()
    │   Weighted median of face/person center positions
    │   Weight = confidence × bounding-box area
    │
    ├─ computeStableCropWindow()
    │   Single stable crop window for the entire clip (no dynamic tracking in Phase 1)
    │   For landscape → 9:16: adjusts centerX to follow detected subject
    │   Face positioned at FACE_TARGET_Y_RATIO = 0.38 from top
    │
    └─ buildViralityFactorsPatch()
        Updates clip.viralityFactors.reframePlans[9:16].safeZone
        Stores full plan in clip.viralityFactors.metadata.smartReframe
        No Prisma schema migration required
```

The updated `safeZone` is a tiny point box centered on the detected subject. `getPlanAnchorCenter()` reads it and `buildPresetVideoFilter()` applies the crop — the existing FFmpeg pipeline is unchanged.

---

## Fallback logic

| Condition | Strategy | Fallback reason |
|-----------|----------|-----------------|
| Face detected (confidence ≥ 0.45) | `face_tracking` | — |
| No face but person detected (confidence ≥ 0.40) | `person_tracking` | "No face detected above threshold" |
| No detections | `center_crop` | "No face or person detected in sampled frames" |
| 0 frames extracted | `center_crop` | "No frames were sampled" |
| Detection pipeline error | `center_crop` | Error message |
| `SMART_REFRAME_ENABLED=false` | `center_crop` | (skipped entirely) |
| OpenRouter API unavailable | `center_crop` | `FallbackDetectionProvider` returns empty |

The code **never throws** — any failure silently falls back to center crop.

---

## Caption safe-zone logic

Default short-form safe zone (`DEFAULT_SHORT_FORM_SAFE_ZONE`):
```
topPct:    0.10   → top 10% reserved (platform UI / progress bar)
bottomPct: 0.20   → bottom 20% is the caption zone
leftPct:   0.05
rightPct:  0.05
preferredCaptionY: "lower_third"
```

When computing the crop window, `FACE_TARGET_Y_RATIO = 0.38` biases the face into the **upper 38%** of the frame, keeping it clear of the lower-third caption zone. For a 1920px-tall frame, this puts the face center at ~730px from the top — comfortably above the caption area which starts at 1536px (80% × 1920).

---

## Detection constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_CONFIDENCE_FACE` | 0.45 | Minimum to trust a face detection |
| `MIN_CONFIDENCE_PERSON` | 0.40 | Minimum to trust a person detection |
| `FACE_TARGET_Y_RATIO` | 0.38 | Vertical position of face in output crop |
| `PERSON_TARGET_Y_RATIO` | 0.45 | Vertical position of person in output crop |
| `SMART_REFRAME_SAMPLE_INTERVAL_MS` | 750 | ms between sampled frames (env override) |
| `SMART_REFRAME_MAX_FRAMES` | 8 | Max frames sampled per clip (env override) |

---

## API

### `POST /api/clips/:clipId/reframe/analyze`

**Request body:**
```json
{
  "mode": "smart_auto",          // "smart_auto" | "smart_face" | "smart_person" | "center_crop" | "blurred_background"
  "captionSafeZoneEnabled": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clipId": "...",
    "strategy": "face_tracking",
    "confidence": 0.88,
    "smartReframePlan": { ... },
    "fallbackReason": null
  }
}
```

### `PATCH /api/clips/:clipId`

Extended with new optional fields (Zod validated):
```json
{
  "reframeMode": "smart_auto",
  "captionsEnabled": true,
  "captionSafeZoneEnabled": true
}
```

---

## Storage

Smart reframe data lives entirely inside existing Prisma `Json` fields — **no schema migration** required.

```
clip.viralityFactors (Json)
  ├─ reframePlans[]                    ← existing field, 9:16 plan safeZone patched
  └─ metadata.smartReframe             ← new, full SmartReframePlan object
       ├─ strategy
       ├─ confidence
       ├─ cropWindow { x, y, width, height }   ← pixel coordinates in source
       ├─ subjectCenterNormalized { x, y }
       ├─ sampledFrames
       ├─ faceDetections
       ├─ personDetections
       ├─ fallbackReason
       └─ analyzedAt
```

---

## Environment variables

```
SMART_REFRAME_ENABLED=true            # Set to "false" to skip detection entirely
SMART_REFRAME_SAMPLE_INTERVAL_MS=750  # Sampling interval in ms
SMART_REFRAME_MAX_FRAMES=8            # Hard cap per clip
SMART_REFRAME_VISION_MODEL=google/gemini-3.1-flash-lite-preview  # OpenRouter model
```

---

## Current limitations (Phase 1)

1. **Static crop only** — one crop window per clip, chosen at analysis time. If the speaker moves significantly during a clip, the crop is a best-effort center based on the detected median position.
2. **Vision API cost** — each analyze call sends up to 8 frames (4.1 KB each) to OpenRouter. Cost is low (gemini-3.1-flash-lite-preview) but non-zero.
3. **Latency** — analysis takes 5–15 seconds depending on clip length and API response time. It's triggered on-demand (not auto-triggered during highlights generation).
4. **`blurred_background` mode** — defined in the type system and UI, stored in metadata, but the FFmpeg render pass does not yet implement pillarbox blur. It falls back to letterbox in the render.
5. **Multi-person clips** — uses the largest/highest-confidence detection. For videos with multiple people, the primary speaker may not always be chosen correctly.

---

## Phase 2 dynamic tracking plan

Phase 2 will replace the single static crop window with **frame-by-frame smooth tracking**:

1. **Per-frame detections** stored as a time-series in `metadata.smartReframe.frameDetections[]`
2. **Temporal smoothing** — low-pass filter / Kalman filter on subject center to prevent jitter
3. **FFmpeg dynamic crop** — use the existing `tracking` field in `ClipReframePlan` with computed per-frame `travel` values fed into the cosine-easing expression in `buildTrackedCropCenter()`
4. **`blurred_background` render** — pillarbox with Gaussian blur (`boxblur`) or `scale2ref` overlay
5. **Local WASM detector** (optional) — `@mediapipe/tasks-vision` for on-device face detection to eliminate API cost

The Phase 1 data model is forward-compatible: `metadata.smartReframe` already has an `analyzedAt` field and can be extended with `frameDetections` without breaking existing consumers.
