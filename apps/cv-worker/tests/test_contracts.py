from app.schemas import ClipDetectionRequest, DetectionBox, FrameDetections, SceneDetectionRequest, TrackSubjectRequest
from app.services import detect_clip, detect_scenes, track_subject


def test_detect_clip_returns_contract_shape():
    response = detect_clip(
        ClipDetectionRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=1000,
        )
    )
    assert response.provider
    assert response.frames == []
    assert response.sampledFrames == 0
    assert response.fallbackReason


def test_scene_detect_contract_shape():
    response = detect_scenes(SceneDetectionRequest(sourcePath="/tmp/example.mp4"))
    assert response.provider
    assert response.cutsMs == []
    assert response.fallbackReason


def test_track_subject_contract_shape():
    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=1000,
            targetWidth=1080,
            targetHeight=1920,
        )
    )
    assert response.provider
    assert response.cropPath == []
    assert response.strategy == "center_crop"


def test_track_subject_generates_dynamic_crop_path_from_faces():
    detections = [
        FrameDetections(
            timeMs=0,
            faces=[DetectionBox(x=0.42, y=0.18, width=0.16, height=0.18, confidence=0.92, label="face")],
            persons=[],
        ),
        FrameDetections(
            timeMs=750,
            faces=[DetectionBox(x=0.50, y=0.18, width=0.16, height=0.18, confidence=0.9, label="face")],
            persons=[],
        ),
        FrameDetections(
            timeMs=1500,
            faces=[DetectionBox(x=0.57, y=0.18, width=0.16, height=0.18, confidence=0.89, label="face")],
            persons=[],
        ),
    ]
    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=1500,
            sourceWidth=1920,
            sourceHeight=1080,
            targetWidth=1080,
            targetHeight=1920,
            detections=detections,
        )
    )

    assert response.strategy == "face_tracking"
    assert response.confidence > 0.35
    assert response.primaryTrackLength == 3
    assert response.interpolatedKeyframes == 0
    assert response.fallbackKeyframes == 0
    assert len(response.cropPath) == 3
    for keyframe in response.cropPath:
        assert keyframe.x >= 0
        assert keyframe.y >= 0
        assert keyframe.width > 0
        assert keyframe.height > 0
        assert keyframe.x + keyframe.width <= 1920
        assert keyframe.y + keyframe.height <= 1080


def test_track_subject_interpolates_short_missing_detection():
    detections = [
        FrameDetections(
            timeMs=0,
            faces=[DetectionBox(x=0.42, y=0.18, width=0.16, height=0.18, confidence=0.92, label="face")],
            persons=[],
        ),
        FrameDetections(timeMs=750, faces=[], persons=[]),
        FrameDetections(
            timeMs=1500,
            faces=[DetectionBox(x=0.52, y=0.18, width=0.16, height=0.18, confidence=0.9, label="face")],
            persons=[],
        ),
    ]
    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=1500,
            sourceWidth=1920,
            sourceHeight=1080,
            targetWidth=1080,
            targetHeight=1920,
            detections=detections,
        )
    )

    assert len(response.cropPath) == 3
    assert response.cropPath[1].detectionType == "interpolated"
    assert response.interpolatedKeyframes == 1
    assert response.fallbackKeyframes == 0


def test_track_subject_reports_long_missing_fallback_keyframes():
    detections = [
        FrameDetections(
            timeMs=0,
            faces=[DetectionBox(x=0.42, y=0.18, width=0.16, height=0.18, confidence=0.92, label="face")],
            persons=[],
        ),
        FrameDetections(timeMs=2500, faces=[], persons=[]),
        FrameDetections(
            timeMs=5000,
            faces=[DetectionBox(x=0.52, y=0.18, width=0.16, height=0.18, confidence=0.9, label="face")],
            persons=[],
        ),
    ]
    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=5000,
            sourceWidth=1920,
            sourceHeight=1080,
            targetWidth=1080,
            targetHeight=1920,
            detections=detections,
        )
    )

    assert len(response.cropPath) == 3
    assert response.cropPath[1].detectionType == "fallback"
    assert response.fallbackKeyframes == 1
    assert response.fallbackReason


def test_track_subject_keeps_consistent_primary_subject():
    detections = [
        FrameDetections(
            timeMs=0,
            faces=[DetectionBox(x=0.20, y=0.2, width=0.10, height=0.14, confidence=0.86, label="face")],
            persons=[],
        ),
        FrameDetections(
            timeMs=750,
            faces=[DetectionBox(x=0.22, y=0.2, width=0.10, height=0.14, confidence=0.86, label="face")],
            persons=[],
        ),
        FrameDetections(
            timeMs=1500,
            faces=[
                DetectionBox(x=0.24, y=0.2, width=0.10, height=0.14, confidence=0.86, label="face"),
                DetectionBox(x=0.72, y=0.2, width=0.18, height=0.22, confidence=0.95, label="face"),
            ],
            persons=[],
        ),
    ]

    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=1500,
            sourceWidth=1920,
            sourceHeight=1080,
            targetWidth=1080,
            targetHeight=1920,
            detections=detections,
        )
    )

    assert response.strategy == "face_tracking"
    assert response.primaryTrackLength == 3
    assert len(response.cropPath) == 3
    assert response.cropPath[-1].x < 700


def test_track_subject_smoothing_limits_sudden_crop_shift():
    detections = [
        FrameDetections(
            timeMs=0,
            faces=[DetectionBox(x=0.10, y=0.2, width=0.10, height=0.14, confidence=0.92, label="face")],
            persons=[],
        ),
        FrameDetections(
            timeMs=500,
            faces=[DetectionBox(x=0.85, y=0.2, width=0.10, height=0.14, confidence=0.92, label="face")],
            persons=[],
        ),
    ]

    response = track_subject(
        TrackSubjectRequest(
            sourcePath="/tmp/example.mp4",
            clipStartMs=0,
            clipEndMs=500,
            sourceWidth=1920,
            sourceHeight=1080,
            targetWidth=1080,
            targetHeight=1920,
            smoothness="high",
            detections=detections,
        )
    )

    assert len(response.cropPath) == 2
    assert response.cropPath[1].x - response.cropPath[0].x <= int(1920 * 0.18 * 0.5) + 1
