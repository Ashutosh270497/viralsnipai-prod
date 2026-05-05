# ViralSnipAI Public API v1

Phase 10 adds the API foundation for agency and automation users. API keys are created from the app settings API and are passed as `Authorization: Bearer <key>`.

## API Keys

Create a key:

```bash
curl -X POST http://localhost:3000/api/settings/api-keys \
  -H "Content-Type: application/json" \
  -b "<session-cookie>" \
  -d '{"name":"Agency workflow","scopes":["projects:read","projects:write","assets:write","clips:write","clips:read","exports:write","exports:read"]}'
```

The raw token is returned once. ViralSnipAI stores only a SHA-256 hash, prefix, scopes, status, and usage timestamps.

## Basic Flow

```bash
API_KEY="vsai_live_..."

curl -X POST http://localhost:3000/api/v1/clip-projects \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Client podcast","topic":"Founder lessons"}'
```

```bash
curl -X POST http://localhost:3000/api/v1/clip-projects/<projectId>/assets \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"video","path":"/uploads/source.mp4","storagePath":"/uploads/source.mp4"}'
```

```bash
curl -X POST http://localhost:3000/api/v1/clip-projects/<projectId>/generate-clips \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"assetId":"<assetId>","target":5,"clipLengthPreset":"balanced","mode":"merge"}'
```

```bash
curl -X POST http://localhost:3000/api/v1/exports \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<projectId>","clipIds":["<clipId>"],"platformPreset":"youtube_shorts","includeCaptions":true}'
```

## Endpoints

- `POST /api/v1/clip-projects`
- `GET /api/v1/clip-projects/:id`
- `POST /api/v1/clip-projects/:id/assets`
- `POST /api/v1/clip-projects/:id/generate-clips`
- `GET /api/v1/jobs/:id`
- `GET /api/v1/clips/:id`
- `POST /api/v1/exports`
- `GET /api/v1/exports/:id`

## Provider Boundary

The API uses the same V1 clipping engine as the UI:

Video source -> OpenAI transcription/timing -> canonical transcript -> local candidate timestamps -> OpenRouter reranking/scoring -> local boundary refinement -> clip save -> preview/export.

OpenRouter never controls final timestamps. OpenAI is not used for creative reasoning.
