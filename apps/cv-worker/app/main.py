from fastapi import FastAPI

from app.schemas import (
    ClipDetectionRequest,
    ClipDetectionResponse,
    FrameDetectionRequest,
    FrameDetectionResponse,
    HealthResponse,
    SceneDetectionRequest,
    SceneDetectionResponse,
    TrackSubjectRequest,
    TrackSubjectResponse,
)
from app.services import detect_clip, detect_frame, detect_scenes, get_health, track_subject

app = FastAPI(
    title="ViralSnipAI CV Worker",
    version="0.1.0",
    description="Computer vision worker for scene detection, face/person detection, and subject tracking.",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return get_health()


@app.post("/detect/frame", response_model=FrameDetectionResponse)
def detect_frame_endpoint(request: FrameDetectionRequest) -> FrameDetectionResponse:
    return detect_frame(request)


@app.post("/detect/clip", response_model=ClipDetectionResponse)
def detect_clip_endpoint(request: ClipDetectionRequest) -> ClipDetectionResponse:
    return detect_clip(request)


@app.post("/scene-detect", response_model=SceneDetectionResponse)
def scene_detect_endpoint(request: SceneDetectionRequest) -> SceneDetectionResponse:
    return detect_scenes(request)


@app.post("/track-subject", response_model=TrackSubjectResponse)
def track_subject_endpoint(request: TrackSubjectRequest) -> TrackSubjectResponse:
    return track_subject(request)
