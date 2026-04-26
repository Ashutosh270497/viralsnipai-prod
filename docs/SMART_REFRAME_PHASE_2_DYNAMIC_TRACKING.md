# Smart Reframe Phase 2 Dynamic Tracking

Phase 2 extends the Phase 1 stable smart crop instead of replacing it. The stored `SmartReframePlan` now supports `mode: "stable" | "dynamic"` and optional `cropPath` keyframes. Existing exports still receive a representative stable crop window, so Phase 1 remains the safe fallback path.

## Pipeline

1. Resolve the original uploaded source video for the clip.
2. Sample clip frames through the existing detector pipeline.
3. Build face/person observations per sampled frame.
4. Assign detections to subject tracks using nearest-center matching.
5. Score tracks by frame coverage, confidence, size, and face preference.
6. Generate crop windows per sampled timestamp for the primary track.
7. Interpolate short missing detections and use fallback windows for longer gaps.
8. Smooth the crop path with deadband and max-shift limits.
9. Store the dynamic `cropPath` in `clip.viralityFactors.metadata.smartReframe`.
10. Patch the existing 9:16 `reframePlans` entry with a representative crop window and conservative one-axis FFmpeg tracking.

## Modes

- `smart_auto`, `smart_face`, `smart_person`: existing stable tracking.
- `dynamic_auto`: dynamic face first, person fallback.
- `dynamic_face`: dynamic face only.
- `dynamic_person`: dynamic person only.
- `center_crop`: geometric center.
- `blurred_background`: preserved as a selectable mode for future rendering support.

## Smoothing

The smoothing layer lives in `apps/web/lib/media/smart-reframe/tracking-smoothing.ts`.

- Exponential smoothing alpha defaults to `0.20`.
- Deadband ignores tiny movements: 2.5% width, 2.0% height.
- Crop movement is capped per second: 18% width, 12% height.
- Short missing detections can be interpolated up to 2000ms.
- Long missing gaps trigger stable fallback behavior.

## Fallback Behavior

Dynamic tracking is optional and must not break launch exports. The service falls back to stable crop when:

- no face/person detections exist,
- the primary track is too short,
- confidence is below the dynamic threshold,
- frame sampling or detection throws,
- future dynamic FFmpeg rendering fails.

The fallback reason is stored in the plan and surfaced in the Framing panel.

## FFmpeg Rendering

Current Phase 2 stores dynamic crop keyframes and maps the first/last movement into the existing `ClipReframePlan.tracking` FFmpeg expression. This gives a conservative smooth crop move in the current single-pass export path while preserving the full `cropPath` for future richer rendering.

If the keyframe path is unreliable, the renderer keeps the stable crop fallback. This keeps final exports on the original source video and avoids quality loss from segment-based rendering. A later renderer can consume every `cropPath` keyframe for true multi-point dynamic crop expressions or segmented rendering.

Recommended final-export quality remains:

- `libx264`
- CRF 18-20
- `preset medium` or slower for production
- `pix_fmt yuv420p`
- `movflags +faststart`
- AAC audio at 160k or higher

## Debugging

Relevant log fields:

- `clipId`
- `assetId`
- `mode`
- `strategy`
- `sampledFrames`
- `primaryTrackLength`
- `faceDetections`
- `personDetections`
- `confidence`
- `smoothing`
- `fallbackReason`
- `cropPathLength`

`SMART_REFRAME_DEBUG=true` can be used by future detector/debug-overlay implementations.

## Known Limitations

- Dynamic rendering currently uses conservative one-axis first/last movement, not every stored keyframe.
- Detector quality depends on the configured provider.
- Identity tracking uses nearest-center matching, not embeddings.
