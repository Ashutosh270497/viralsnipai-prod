# Production Deployment Guide

> Stack: Next.js 14 · Python CV Worker (FastAPI) · PostgreSQL · FFmpeg · Remotion (optional)

---

## Services

| Service | Technology | Default Port | Role |
|---|---|---|---|
| `web` | Next.js 14 (Node.js 20) | 3000 | Main application |
| `cv-worker` | Python 3.11, FastAPI, MediaPipe, ONNX | 8010 | Face/person detection, scene cuts |
| `postgres` | PostgreSQL 16 | 5432 | Database (replace with Supabase in prod) |

The web app degrades gracefully when `cv-worker` is unreachable — detection falls back to OpenRouter vision API, then center-crop. All services can be scaled and deployed independently.

---

## Quick start (Docker Compose)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/viralsnipai-prod.git
cd viralsnipai-prod

# 2. Create the production env file
cp apps/web/.env.production.example .env.production
# Edit .env.production — fill in every REQUIRED value

# 3. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# 4. Run database migrations
docker compose -f docker-compose.prod.yml exec web \
  npx prisma migrate deploy

# 5. Verify all services are healthy
curl -s http://localhost:3000/api/health | python3 -m json.tool
curl -s http://localhost:8010/health | python3 -m json.tool
```

---

## Environment variables

See `apps/web/.env.production.example` for the complete annotated list.

### Required (app will not start without these)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | 32+ random bytes — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Full public URL of the web app |
| `OPENROUTER_API_KEY` | Routes all AI text/vision generation |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Billing (paid plans) |

### Recommended for full functionality

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Whisper transcription (`TRANSCRIBE_PROVIDER=openai`) |
| `CV_WORKER_URL` | — | URL of the CV worker service |
| `SMART_REFRAME_ENABLED` | `true` | Enable face/person smart crop |
| `TRANSCRIBE_PROVIDER` | `openai` | `openai` \| `openrouter` |

### Remotion animated exports (opt-in)

| Variable | Default | Description |
|---|---|---|
| `REMOTION_RENDERER_ENABLED` | `false` | Enable animated caption export |
| `REMOTION_EXPORT_CRF` | `18` | Output quality (16–20 recommended) |
| `REMOTION_CONCURRENCY` | `1` | Browser threads per render |

---

## CV Worker deployment

The CV worker is a standalone FastAPI service that can be deployed separately.

### Local model configuration

| Env var | Description |
|---|---|
| `CV_YOLO_MODEL_PATH` | Path to YOLO ONNX model for person detection |
| `CV_SCENE_PROVIDER` | `pyscenedetect` (default) \| `ffmpeg` |
| `CV_SCENE_THRESHOLD` | Scene detection threshold (default: 27) |
| `DEFAULT_SAMPLE_INTERVAL_MS` | Frame sampling interval (default: 750) |
| `MAX_FRAMES` | Max frames per clip analysis (default: 24) |

### Providing a YOLO model (optional)

```bash
# Download YOLOv8n — 6 MB, person class only
# Place in the cv-models Docker volume or mount point
curl -L https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt \
  -o yolov8n.pt
# Convert to ONNX (requires ultralytics Python package)
pip install ultralytics
yolo export model=yolov8n.pt format=onnx
# Set path
export CV_YOLO_MODEL_PATH=/app/models/yolov8n.onnx
```

If no YOLO model is configured, OpenCV HOG person detector is used automatically.

### Standalone deployment

```bash
cd apps/cv-worker
docker build -t viralsnipai-cv-worker .
docker run -d \
  -p 8010:8010 \
  -e CV_YOLO_MODEL_PATH=/models/yolov8n.onnx \
  -v /your/models:/models \
  -v /your/uploads:/app/uploads:ro \
  viralsnipai-cv-worker
```

---

## Health checks

### Unified system health

```bash
curl http://localhost:3000/api/health
```

Returns:
```json
{
  "overall": "healthy",
  "timestamp": "...",
  "version": "1.0.0",
  "uptime": 3600,
  "services": {
    "database": { "status": "ok", "latencyMs": 2 },
    "environment": { "status": "ok" },
    "ffmpeg": { "status": "ok", "version": "6.0", "latencyMs": 45 },
    "remotionRenderer": { "status": "unconfigured" },
    "cvWorker": { "status": "ok", "latencyMs": 12 },
    "exportQueue": { "status": "ok", "details": { "activeJobs": 0 } }
  }
}
```

Status codes:
- `200` — `healthy` or `degraded` (app is operational)
- `503` — `unhealthy` (database or FFmpeg unreachable)

### Individual service checks

```bash
# CV worker only
curl http://localhost:3000/api/media/cv-worker/health
curl http://localhost:8010/health

# Export render queue snapshot
curl http://localhost:3000/api/media/render-queue/health
```

---

## Observability — structured logs

All render events are emitted as structured JSON via the app logger. Key log types:

| Log event | Key fields |
|---|---|
| `render:source_probe` | `sourcePath`, `width`, `height`, `fps`, `videoCodec`, `videoBitrateKbps` |
| `render:segment` | `preset`, `crf`, `codec`, `renderDurationMs`, `fileSizeBytes`, `hasCaptions`, `reframeMode`, `streamCopy` |
| `render:remotion_path_complete` | `exportId`, `segmentCount`, `renderedSegments` |
| `Export processing completed` | `exportId`, `renderMethod` (`ffmpeg`\|`remotion`), `segmentCount`, `withCaptions` |
| `smart-reframe: detection complete` | `sampledFrames`, `faceDetections`, `personDetections`, `detectionDurationMs`, `fallback` |
| `Scene detection completed` | `provider`, `cuts`, `sceneDurationMs`, `totalDurationMs` |
| `health:system_check` | `overall`, `durationMs`, per-service `status` + `latencyMs` |

### Fallback rate monitoring

Watch for `fallback: true` in `smart-reframe: detection complete` logs to track how often smart crop falls back to center crop. A high fallback rate may indicate:
- CV worker is down or misconfigured
- OpenRouter vision API rate-limited
- Source videos are not suitable for face/person detection (screencasts, animations)

---

## Scaling

### Web application
- The web app is stateless except for the in-process `exportRuntimeState` Map
- Export jobs are in-memory; use a shared Redis queue if running multiple instances
- Current queue: `@clippers/jobs` (in-process, single instance)

### CV Worker
- Stateless — can run multiple instances behind a load balancer
- Each instance holds loaded models in memory (startup cost ~2–5s)
- Recommended: 1 instance per 4 CPU cores

### Render quality presets

| Preset | CRF | Audio | Use case |
|---|---|---|---|
| `preview_fast` | 24 | 128k | Dashboard UI preview only |
| `balanced_export` | 20 | 192k | Standard paid export |
| `high_quality_export` | 16 | 256k | Premium / default production export |
| `source_copy_trim` | — | copy | Lossless trim (no crop/captions) |

---

## Troubleshooting

**FFmpeg not found**
```
health.services.ffmpeg.status === "error"
```
- Ensure FFmpeg is installed: `apt-get install ffmpeg`
- Or set `FFMPEG_PATH=/path/to/ffmpeg` in the env
- Docker images already include FFmpeg via `apk add ffmpeg`

**CV worker unreachable**
```
health.services.cvWorker.status === "error"
```
- Check `CV_WORKER_URL` is reachable from the web container
- In Docker Compose, the service name `cv-worker` resolves automatically
- The web app degrades gracefully: detection falls back to OpenRouter vision, then center-crop

**Database connection failing**
```
health.services.database.status === "error"
```
- Verify `DATABASE_URL` connection string
- Check pg_isready on the postgres container
- For Supabase: confirm the connection pooler URL is used (not the direct connection)

**Exports not rendering**
- Check `/api/media/render-queue/health` for stuck active jobs
- Check `render-queue` logs for `UNKNOWN_RENDER_FAILURE`
- Verify the source asset file exists at the path stored in the database

**Blurry exported clips**
- Check `render:segment` logs for the `crf` value — should be ≤ 18 for high quality
- Verify `streamCopy: false` is only set when crop/captions are needed
- For animated exports: ensure `REMOTION_RENDERER_ENABLED=true` and Chromium is accessible
