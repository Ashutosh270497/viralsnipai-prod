# ViralSnipAI CV Worker

Local computer-vision analysis worker for ViralSnipAI media workflows.

The worker is intentionally isolated from the Next.js app so OpenCV, MediaPipe,
ONNX Runtime, and PySceneDetect dependencies do not bloat or destabilize the web
runtime.

## Responsibilities

- Health and dependency readiness checks.
- Face/person detection.
- Scene detection with fallback.
- Subject tracking and dynamic crop path generation.

Implemented providers:

- PySceneDetect scene detection.
- FFmpeg scene filter fallback.
- MediaPipe face detection.
- OpenCV Haar face fallback.
- YOLO ONNX person detection when `CV_YOLO_MODEL_PATH` is configured.
- OpenCV HOG person fallback.
- Custom nearest-center subject tracking with interpolation and smoothing.

The worker never downloads a YOLO model automatically. `CV_YOLO_MODEL_PATH` is
optional. If it is not set, person detection uses OpenCV HOG and the web app can
still fall back to the API/OpenRouter detection path.

## Local Setup

```bash
cd apps/cv-worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

## Health

```bash
curl http://localhost:8010/health
```

## Web App Integration

Set this in the web runtime environment when enabling the worker:

```bash
CV_WORKER_URL=http://localhost:8010
```

The Next.js dynamic smart reframe path tries this worker first when
`CV_WORKER_URL` is configured. If the worker is unavailable or confidence is too
low, the existing TypeScript/OpenRouter smart reframe fallback remains active.

## Optional Environment

```bash
CV_SAMPLE_INTERVAL_MS=750
CV_MAX_FRAMES=120
CV_FACE_CONFIDENCE_THRESHOLD=0.45
CV_PERSON_CONFIDENCE_THRESHOLD=0.35
CV_TRACKING_CONFIDENCE_THRESHOLD=0.25
CV_YOLO_MODEL_PATH=/absolute/path/to/yolo.onnx
CV_YOLO_INPUT_SIZE=640
FFMPEG_PATH=ffmpeg
```

For low-spec local development or API-only detection, leave
`CV_YOLO_MODEL_PATH` unset.
