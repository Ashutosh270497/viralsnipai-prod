# Video Quality Policy

> Applies to: `apps/web/lib/ffmpeg.ts`, `apps/web/lib/render-queue.ts`  
> Policy file: `apps/web/lib/media/video-quality-policy.ts`

---

## Why quality was degrading

The original export pipeline had **three encode passes** for every captioned clip:

| Step | Function | Operation |
|------|----------|-----------|
| 1 | `extractClip()` | Source → temp clip (CRF 16) |
| 2 | `applyCaptionAndOverlayStyling()` | Temp clip → captioned clip (CRF 16 again) |
| 3 | `concatClips()` | Captioned clip → final output (CRF 16 again) |

Even at CRF 16, three consecutive H.264 encodes introduce compounding generation loss: blocking artifacts in textures, softening on sharp edges, and chroma smearing — all visible on a 1080p display.

Additionally:
- `concatClipsPassthrough()` was misnamed — it re-encoded with `playbackOptions` instead of copying streams.
- `concatClips()` (no watermark) ran a full re-encode just to concatenate already-compatible clips.
- All `scale=` filters used the default bilinear resampler instead of Lanczos.
- H.264 level was set to `4.1` (capped at ~62.5 Mbps) instead of `4.2` (capped at ~125 Mbps).

---

## What was changed

### `apps/web/lib/ffmpeg.ts`

| Change | Impact |
|--------|--------|
| Added `extractAndRenderSegment()` — single-pass crop+scale+caption burn | Eliminates encode pass #2 |
| `renderExport()` now calls `extractAndRenderSegment()` instead of `extractClip` + `applyCaptionAndOverlayStyling` | 3 passes → 1 pass (no watermark), 2 passes (watermark) |
| `concatClips()` uses `-c copy` when no watermark | Eliminates encode pass #3 for most exports |
| Fixed `concatClipsPassthrough()` to use `-c copy` | Preview multi-segment stitching is now lossless |
| Added `flags=lanczos` to all `scale=` filters | High-quality spatial downscaling |
| H.264 level `4.1` → `4.2` | Supports higher bitrate ceilings |
| Added `previewPlaybackOptions` (CRF 24, veryfast, 128k audio) | Explicit, separated preview quality |
| Added `probeSourceMetadata()` | Structured render logging per segment |
| Added `buildSinglePassVideoFilter()` internal helper | Combines reframe + caption into one filter chain |

### `apps/web/lib/render-queue.ts`

- Added `probeSourceMetadata()` call before `renderExport()` to log source `width/height/fps/codec/bitrate` per export job.

### `apps/web/lib/media/video-quality-policy.ts` (new)

Central quality preset registry. All FFmpeg options are defined here; `ffmpeg.ts` uses them as the source of truth.

---

## Export presets

### `source_copy_trim`
```
-c:v copy -c:a copy -movflags +faststart
```
- **When**: simple trim — no crop, scale, reframe, or caption filter needed.
- **Quality**: lossless (zero re-encode).
- **Speed**: fastest.

### `preview_fast`
```
libx264, CRF 24, veryfast, yuv420p, AAC 128k
```
- **When**: dashboard UI previews only.
- **Quality**: acceptable at 240px display size.
- **NEVER**: use this as input to a final export render.

### `balanced_export`
```
libx264, CRF 20, medium, yuv420p, H.264 high/4.2, AAC 192k, +faststart
```
- **When**: standard final export (free + starter plans).
- **Quality**: good. Visible only on very close inspection at 1080p.

### `high_quality_export` (default)
```
libx264, CRF 16, slow, yuv420p, H.264 high/4.2, AAC 256k, +faststart
```
- **When**: all production renders via `renderExport()` / `extractAndRenderSegment()`.
- **Quality**: visually near-lossless for 30–95 s clips.
- **Speed**: slower encode (~2–4× real-time on a CPU).

---

## Recommended CRF values

| Use case | CRF | Notes |
|----------|-----|-------|
| Preview | 24–26 | Fast, acceptable at small display sizes |
| Standard export | 18–22 | Good quality/file-size balance |
| High-quality export | 16–18 | Visually lossless, larger files |
| Lossless reference | 0 | Only for offline archival; huge files |

CRF scale: `0` = lossless, `51` = worst. Every +6 CRF roughly doubles perceived degradation.

---

## When stream copy is used

Stream copy (`-c copy`) skips the DCT encode/decode cycle entirely, preserving every bit from the source. It is used:

1. **`concatClips()` with no watermark** — after `extractAndRenderSegment()` produces H.264/AAC clips at the target resolution, concatenating them with stream copy adds zero quality loss.
2. **`concatClipsPassthrough()`** — used by preview multi-segment stitching.
3. **`normalizeVideo()` when source is already H.264/AAC** — remux-only, no re-encode.

Stream copy **cannot** be used when:
- A crop, scale, or aspect-ratio reframe is required.
- Captions/overlays need to be burned in.
- A watermark overlay is composited.

---

## Single-pass render guarantee

`extractAndRenderSegment()` guarantees:
1. Input is **always the original source asset path** — never a preview clip or intermediate file.
2. Crop/reframe, scale to target resolution, and caption burn-in all happen in **one FFmpeg invocation**.
3. The `buildSinglePassVideoFilter()` helper constructs the filter chain in the correct order:
   - Reframe/crop → scale to target (with `flags=lanczos`) → subtitle burn → hook overlays.

---

## Caption safe zones

Subtitle `MarginV` values ensure captions stay in the platform-safe zone:

| Position | MarginV |
|----------|---------|
| Top      | 96 px   |
| Middle   | 40 px   |
| Bottom   | 120 px  |

YouTube Shorts/TikTok/Reels UI elements appear in the bottom ~80–100 px. The 120 px bottom margin keeps subtitles clear of UI chrome on a 1920 px canvas.

---

## Troubleshooting blurry exports

**Symptom**: exported clip looks softer than the source.

1. Check the render log for `crf` and `preset` values: `grep '"operation":"render:segment"' /var/log/app.log`
2. Verify the export ran `extractAndRenderSegment` (single-pass) not the old two-step path.
3. Verify `sourcePath` in the segment is the original asset, not a preview path:
   - Correct: `/uploads/assets/abc123.mp4`
   - Wrong: `/uploads/previews/abc123.mp4`
4. Check that `concatClips` is using stream copy: look for `"streamCopy": true` in the stitch log, or verify `-c copy` in the FFmpeg command line.
5. If watermark is enabled, one encode pass is unavoidable. Increase quality by switching from `balanced_export` to `high_quality_export` in the render-queue configuration.

**Symptom**: subtitles look pixelated or fonts are jagged.

1. Ensure the `subtitles` filter is applied *after* the `scale` filter (post-scale font sizes are correct).
2. Check `FontSize` in the ASS force_style — values below 28 px render poorly at 1080×1920.
3. If using a custom font, verify the font file is accessible at render time.
