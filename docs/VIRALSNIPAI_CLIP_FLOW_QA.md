# ViralSnipAI Clip Flow QA

Use this checklist before controlled beta testing. Record the source filename, browser, project ID, and any failed step.

## 1. 1080p Source Clip Generation

1. Sign in and open `/repurpose`.
2. Upload a 1080p source video under 500 MB.
3. Choose `Balanced` clipping quality, `Balanced` clip length, and `3 clips`.
4. Generate clips.
5. Confirm analytics show `candidatesGenerated >= 15`.
6. Confirm analytics show `clipsCreated = 3`.
7. Confirm `rerankModelUsed` is present and deterministic fallback is `false` unless OpenRouter failed.

## 2. Editor Stability

1. Open the generated project in `/repurpose/editor`.
2. Generate captions for one clip.
3. While captions are generating, confirm conflicting save actions are disabled or show a friendly wait message.
4. Edit one transcript boundary.
5. Save one caption style change.
6. Confirm no raw `409` conflict error appears.
7. Confirm preview regenerates once for the relevant change.

## 3. Preview Playback

1. Open a clip preview in the editor.
2. Confirm the video starts quickly.
3. Seek forward and backward in the preview.
4. In DevTools Network, confirm preview MP4 requests use `206 Partial Content` when the browser sends a Range header.

## 4. Final Export Truth

1. Approve or mark one clip export-ready.
2. Export one MP4 with captions enabled.
3. Confirm the final export uses the original source media path, not `/uploads/previews/`.
4. Confirm final export uses a final export quality preset, not `preview_fast`.
5. Play the MP4 and verify audio/video/captions remain synced.

## 5. Low-Quality Source Regression

1. Upload a low-quality source, for example `640x360`.
2. Generate 3 clips.
3. Confirm the source-quality warning appears in create/source, editor/preview, and export flows.
4. Confirm the message explains that output may look soft and recommends 1080p or higher.
5. Confirm landscape-to-vertical output uses blur-background mode when aggressive crop would degrade quality.

## 6. Upload Limit Truth

1. Confirm create/upload UI says `Upload videos up to 500 MB`.
2. Confirm it says `Up to 60 minutes recommended`.
3. Confirm no normal user-facing flow advertises 4 GB upload support.
4. Do not advertise 4 GB until upload is streamed to disk/S3 instead of buffered in memory.
