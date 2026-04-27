from typing import Literal
from pydantic import BaseModel, Field


class DetectionBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(ge=0, le=1)
    height: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    label: Literal["face", "person", "subject"]


class FrameDetectionResult(BaseModel):
    faces: list[DetectionBox] = Field(default_factory=list)
    persons: list[DetectionBox] = Field(default_factory=list)


class FrameDetectionRequest(BaseModel):
    framePath: str
    detectFaces: bool = True
    detectPersons: bool = True


class FrameDetectionResponse(FrameDetectionResult):
    provider: str
    modelVersions: dict[str, str | None] = Field(default_factory=dict)


class ClipDetectionRequest(BaseModel):
    sourcePath: str
    clipStartMs: int = Field(ge=0)
    clipEndMs: int = Field(gt=0)
    sampleIntervalMs: int = Field(default=750, gt=0)
    maxFrames: int = Field(default=120, gt=0, le=240)
    detectFaces: bool = True
    detectPersons: bool = True


class FrameDetections(BaseModel):
    timeMs: int = Field(ge=0)
    faces: list[DetectionBox] = Field(default_factory=list)
    persons: list[DetectionBox] = Field(default_factory=list)


class ClipDetectionResponse(BaseModel):
    frames: list[FrameDetections] = Field(default_factory=list)
    provider: str
    sampledFrames: int
    modelVersions: dict[str, str | None] = Field(default_factory=dict)
    fallbackReason: str | None = None


class SceneDetectionRequest(BaseModel):
    sourcePath: str
    threshold: float = Field(default=27.0, ge=0)
    maxCuts: int = Field(default=350, ge=1, le=5000)


class SceneDetectionResponse(BaseModel):
    cutsMs: list[int] = Field(default_factory=list)
    provider: str
    fallbackReason: str | None = None


class CropKeyframe(BaseModel):
    timeMs: int = Field(ge=0)
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    confidence: float = Field(ge=0, le=1)
    detectionType: Literal["face", "person", "interpolated", "fallback"]


class TrackSubjectRequest(BaseModel):
    sourcePath: str
    clipStartMs: int = Field(ge=0)
    clipEndMs: int = Field(gt=0)
    targetWidth: int = Field(gt=0)
    targetHeight: int = Field(gt=0)
    sourceWidth: int | None = Field(default=None, gt=0)
    sourceHeight: int | None = Field(default=None, gt=0)
    mode: Literal["dynamic_auto", "dynamic_face", "dynamic_person"] = "dynamic_auto"
    smoothness: Literal["low", "medium", "high"] = "medium"
    subjectPosition: Literal["center", "slightly_up", "slightly_down"] = "center"
    detections: list[FrameDetections] = Field(default_factory=list)


class TrackSubjectResponse(BaseModel):
    cropPath: list[CropKeyframe] = Field(default_factory=list)
    strategy: Literal["face_tracking", "person_tracking", "center_crop"]
    confidence: float = Field(ge=0, le=1)
    provider: str
    sampledFrames: int = 0
    faceDetections: int = 0
    personDetections: int = 0
    primaryTrackLength: int = 0
    interpolatedKeyframes: int = 0
    fallbackKeyframes: int = 0
    fallbackReason: str | None = None


class DependencyStatus(BaseModel):
    available: bool
    version: str | None = None


class HealthResponse(BaseModel):
    status: Literal["healthy", "degraded"]
    service: str
    version: str
    dependencies: dict[str, DependencyStatus]
    models: dict[str, str | None]
