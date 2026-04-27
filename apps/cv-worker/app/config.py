from functools import lru_cache
from pydantic import BaseModel
import os


class Settings(BaseModel):
    service_name: str = "viralsnipai-cv-worker"
    version: str = "0.2.0"
    default_sample_interval_ms: int = 750
    max_frames: int = 120
    ffmpeg_path: str = "ffmpeg"
    face_model_name: str = "mediapipe-face-detector"
    person_model_name: str = "yolo-onnx"
    scene_provider: str = "pyscenedetect"
    yolo_model_path: str | None = None
    yolo_input_size: int = 640
    face_confidence_threshold: float = 0.45
    person_confidence_threshold: float = 0.35
    scene_threshold: float = 27.0
    tracking_confidence_threshold: float = 0.25


@lru_cache
def get_settings() -> Settings:
    return Settings(
        default_sample_interval_ms=int(os.getenv("CV_SAMPLE_INTERVAL_MS", "750")),
        max_frames=int(os.getenv("CV_MAX_FRAMES", "120")),
        ffmpeg_path=os.getenv("FFMPEG_PATH", "ffmpeg"),
        face_model_name=os.getenv("CV_FACE_MODEL_NAME", "mediapipe-face-detector"),
        person_model_name=os.getenv("CV_PERSON_MODEL_NAME", "yolo-onnx"),
        scene_provider=os.getenv("CV_SCENE_PROVIDER", "pyscenedetect"),
        yolo_model_path=os.getenv("CV_YOLO_MODEL_PATH") or None,
        yolo_input_size=int(os.getenv("CV_YOLO_INPUT_SIZE", "640")),
        face_confidence_threshold=float(os.getenv("CV_FACE_CONFIDENCE_THRESHOLD", "0.45")),
        person_confidence_threshold=float(os.getenv("CV_PERSON_CONFIDENCE_THRESHOLD", "0.35")),
        scene_threshold=float(os.getenv("CV_SCENE_THRESHOLD", "27.0")),
        tracking_confidence_threshold=float(os.getenv("CV_TRACKING_CONFIDENCE_THRESHOLD", "0.25")),
    )
