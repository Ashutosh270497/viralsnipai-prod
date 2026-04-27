from app.config import get_settings
from app.dependencies import ffmpeg_status, package_status
from app.detectors import FrameDetector
from app.schemas import (
    ClipDetectionRequest,
    ClipDetectionResponse,
    FrameDetections,
    FrameDetectionRequest,
    FrameDetectionResponse,
    HealthResponse,
    SceneDetectionRequest,
    SceneDetectionResponse,
    TrackSubjectRequest,
    TrackSubjectResponse,
)
from app.scene_detection import detect_scenes as detect_scenes_impl
from app.tracking import track_subject as track_subject_impl
from app.video_utils import sample_frame_paths
import shutil
from pathlib import Path


def get_health() -> HealthResponse:
    settings = get_settings()
    dependencies = {
        "ffmpeg": ffmpeg_status(settings.ffmpeg_path),
        "opencv": package_status("cv2", "opencv-python-headless"),
        "onnxruntime": package_status("onnxruntime"),
        "mediapipe": package_status("mediapipe"),
        "pyscenedetect": package_status("scenedetect"),
    }
    status = "healthy" if dependencies["ffmpeg"]["available"] else "degraded"
    return HealthResponse(
        status=status,
        service=settings.service_name,
        version=settings.version,
        dependencies=dependencies,
        models={
            "face": settings.face_model_name,
            "person": settings.person_model_name,
            "scene": settings.scene_provider,
            "yoloModelPath": settings.yolo_model_path,
            "yoloModelStatus": "available"
            if settings.yolo_model_path and Path(settings.yolo_model_path).exists()
            else "not_configured",
        },
    )


def detect_frame(request: FrameDetectionRequest) -> FrameDetectionResponse:
    return FrameDetector().detect(request.framePath, request.detectFaces, request.detectPersons)


def detect_clip(request: ClipDetectionRequest) -> ClipDetectionResponse:
    settings = get_settings()
    sample_interval_ms = request.sampleIntervalMs or settings.default_sample_interval_ms
    max_frames = min(request.maxFrames or settings.max_frames, settings.max_frames)
    sampled, temp_dir, extraction_error = sample_frame_paths(
        request.sourcePath,
        request.clipStartMs,
        request.clipEndMs,
        sample_interval_ms,
        max_frames,
    )

    if extraction_error:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)
        return ClipDetectionResponse(
            frames=[],
            provider="ffmpeg",
            sampledFrames=0,
            modelVersions={
                "face": settings.face_model_name if request.detectFaces else None,
                "person": settings.person_model_name if request.detectPersons else None,
            },
            fallbackReason=extraction_error,
        )

    detector = FrameDetector()
    frames: list[FrameDetections] = []
    providers: set[str] = set()
    try:
        for time_ms, frame_path in sampled:
            detected = detector.detect(frame_path, request.detectFaces, request.detectPersons)
            providers.add(detected.provider)
            frames.append(FrameDetections(timeMs=time_ms, faces=detected.faces, persons=detected.persons))
    finally:
        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)

    return ClipDetectionResponse(
        frames=frames,
        provider="+".join(sorted(providers)) if providers else "none",
        sampledFrames=len(frames),
        modelVersions={
            "face": settings.face_model_name if request.detectFaces else None,
            "person": settings.person_model_name if request.detectPersons else None,
        },
        fallbackReason=None if frames else "No sample frames were detected.",
    )


def detect_scenes(request: SceneDetectionRequest) -> SceneDetectionResponse:
    return detect_scenes_impl(request)


def track_subject(request: TrackSubjectRequest) -> TrackSubjectResponse:
    return track_subject_impl(request)
