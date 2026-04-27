from dataclasses import dataclass
from math import hypot

from app.config import get_settings
from app.schemas import CropKeyframe, DetectionBox, FrameDetections, TrackSubjectRequest, TrackSubjectResponse
from app.video_utils import probe_video_size

TRACK_MAX_CENTER_DISTANCE = 0.24
MISSING_DETECTION_INTERPOLATE_MS = 2000
MAX_CROP_SHIFT_PER_SECOND_X = 0.18
MAX_CROP_SHIFT_PER_SECOND_Y = 0.12


@dataclass
class Observation:
    frame_index: int
    time_ms: int
    box: DetectionBox
    kind: str


@dataclass
class Track:
    observations: list[Observation]


def _center(box: DetectionBox) -> tuple[float, float]:
    return box.x + box.width / 2, box.y + box.height / 2


def _distance(a: DetectionBox, b: DetectionBox) -> float:
    ax, ay = _center(a)
    bx, by = _center(b)
    return hypot(ax - bx, ay - by)


def _area(box: DetectionBox) -> float:
    return box.width * box.height


def _iou(a: DetectionBox, b: DetectionBox) -> float:
    ax1, ay1 = a.x, a.y
    ax2, ay2 = a.x + a.width, a.y + a.height
    bx1, by1 = b.x, b.y
    bx2, by2 = b.x + b.width, b.y + b.height
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    intersection = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = _area(a) + _area(b) - intersection
    return intersection / union if union > 0 else 0.0


def _assignment_cost(previous: Observation, current: Observation) -> float:
    center_distance = _distance(previous.box, current.box)
    overlap = _iou(previous.box, current.box)
    class_penalty = 0.18 if previous.kind != current.kind else 0.0
    confidence_penalty = abs(previous.box.confidence - current.box.confidence) * 0.04
    size_penalty = abs(_area(previous.box) - _area(current.box)) * 0.15
    return center_distance + class_penalty + confidence_penalty + size_penalty - overlap * 0.12


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, value))


def _strategy_target_y(strategy: str, subject_position: str) -> float:
    base = 0.45 if strategy == "person_tracking" else 0.38
    if subject_position == "slightly_up":
        return max(0.28, base - 0.07)
    if subject_position == "slightly_down":
        return min(0.58, base + 0.07)
    return base


def _build_observations(request: TrackSubjectRequest) -> list[Observation]:
    settings = get_settings()
    allow_faces = request.mode in ("dynamic_auto", "dynamic_face")
    allow_persons = request.mode in ("dynamic_auto", "dynamic_person")
    observations: list[Observation] = []

    for frame_index, frame in enumerate(request.detections):
        if allow_faces:
            for box in frame.faces:
                if box.confidence >= settings.face_confidence_threshold:
                    observations.append(Observation(frame_index, frame.timeMs, box, "face"))
        if allow_persons:
            for box in frame.persons:
                if box.confidence >= settings.person_confidence_threshold:
                    observations.append(Observation(frame_index, frame.timeMs, box, "person"))

    return sorted(observations, key=lambda item: (item.frame_index, 0 if item.kind == "face" else 1))


def _build_tracks(observations: list[Observation]) -> list[Track]:
    tracks: list[Track] = []
    for observation in observations:
        candidates: list[tuple[Track, float, float]] = []
        for track in tracks:
            last = track.observations[-1]
            if last.frame_index < observation.frame_index:
                candidates.append((track, _assignment_cost(last, observation), _distance(last.box, observation.box)))
        candidates.sort(key=lambda item: item[1])
        if candidates and candidates[0][1] <= TRACK_MAX_CENTER_DISTANCE and candidates[0][2] <= TRACK_MAX_CENTER_DISTANCE * 1.45:
            candidates[0][0].observations.append(observation)
        else:
            tracks.append(Track(observations=[observation]))
    return tracks


def _score_track(track: Track, frame_count: int) -> float:
    count = len(track.observations)
    avg_confidence = sum(item.box.confidence for item in track.observations) / max(1, count)
    avg_area = sum(_area(item.box) for item in track.observations) / max(1, count)
    face_bonus = 0.08 if any(item.kind == "face" for item in track.observations) else 0
    class_consistency = max(
        sum(1 for item in track.observations if item.kind == "face"),
        sum(1 for item in track.observations if item.kind == "person"),
    ) / max(1, count)
    return (
        (count / max(1, frame_count)) * 0.48
        + avg_confidence * 0.28
        + min(avg_area * 4, 0.1)
        + class_consistency * 0.06
        + face_bonus
    )


def _crop_pixels(
    source_width: int,
    source_height: int,
    target_width: int,
    target_height: int,
    subject_center_x: float,
    subject_center_y: float,
    target_y_ratio: float,
) -> dict[str, int]:
    source_aspect = source_width / source_height
    target_aspect = target_width / target_height
    if source_aspect > target_aspect:
        crop_height = source_height
        crop_width = round(crop_height * target_aspect)
    else:
        crop_width = source_width
        crop_height = round(crop_width / target_aspect)

    x = round(subject_center_x * source_width - crop_width / 2)
    y = round(subject_center_y * source_height - crop_height * target_y_ratio)
    x = round(_clamp(x, 0, max(0, source_width - crop_width)))
    y = round(_clamp(y, 0, max(0, source_height - crop_height)))
    return {"x": x, "y": y, "width": crop_width, "height": crop_height}


def _interpolate(before: Observation, after: Observation, time_ms: int, frame_index: int) -> Observation:
    span = max(1, after.time_ms - before.time_ms)
    t = _clamp((time_ms - before.time_ms) / span, 0, 1)

    def lerp(a: float, b: float) -> float:
        return a + (b - a) * t

    return Observation(
        frame_index=frame_index,
        time_ms=time_ms,
        kind=before.kind,
        box=DetectionBox(
            x=lerp(before.box.x, after.box.x),
            y=lerp(before.box.y, after.box.y),
            width=lerp(before.box.width, after.box.width),
            height=lerp(before.box.height, after.box.height),
            confidence=min(before.box.confidence, after.box.confidence) * 0.82,
            label=before.box.label,
        ),
    )


def _smoothing_settings(smoothness: str) -> tuple[float, float, float]:
    if smoothness == "low":
        return 0.35, 0.018, 0.014
    if smoothness == "high":
        return 0.14, 0.035, 0.028
    return 0.20, 0.025, 0.020


def _smooth_crop_path(crop_path: list[CropKeyframe], source_width: int, source_height: int, smoothness: str) -> list[CropKeyframe]:
    if len(crop_path) <= 1:
        return crop_path
    alpha, deadband_x_pct, deadband_y_pct = _smoothing_settings(smoothness)
    deadband_x = source_width * deadband_x_pct
    deadband_y = source_height * deadband_y_pct
    smoothed = [crop_path[0]]

    for current in crop_path[1:]:
        previous = smoothed[-1]
        dx = current.x - previous.x
        dy = current.y - previous.y
        elapsed_sec = max(0.001, (current.timeMs - previous.timeMs) / 1000)
        max_dx = source_width * MAX_CROP_SHIFT_PER_SECOND_X * elapsed_sec
        max_dy = source_height * MAX_CROP_SHIFT_PER_SECOND_Y * elapsed_sec
        eased_dx = 0 if abs(dx) < deadband_x else _clamp(dx * alpha, -max_dx, max_dx)
        eased_dy = 0 if abs(dy) < deadband_y else _clamp(dy * alpha, -max_dy, max_dy)
        next_x = round(previous.x + eased_dx)
        next_y = round(previous.y + eased_dy)
        smoothed.append(
            CropKeyframe(
                timeMs=current.timeMs,
                x=round(_clamp(next_x, 0, max(0, source_width - current.width))),
                y=round(_clamp(next_y, 0, max(0, source_height - current.height))),
                width=current.width,
                height=current.height,
                confidence=current.confidence,
                detectionType=current.detectionType,
            )
        )
    return smoothed


def track_subject(request: TrackSubjectRequest) -> TrackSubjectResponse:
    source_width = request.sourceWidth
    source_height = request.sourceHeight
    if source_width is None or source_height is None:
        probed_width, probed_height = probe_video_size(request.sourcePath)
        source_width = source_width or probed_width
        source_height = source_height or probed_height

    sampled_frames = len(request.detections)
    face_detections = sum(len(frame.faces) for frame in request.detections)
    person_detections = sum(len(frame.persons) for frame in request.detections)

    if not source_width or not source_height:
        return TrackSubjectResponse(
            cropPath=[],
            strategy="center_crop",
            confidence=0,
            provider="nearest-center",
            sampledFrames=sampled_frames,
            faceDetections=face_detections,
            personDetections=person_detections,
            fallbackReason="Could not determine source video dimensions.",
        )

    observations = _build_observations(request)
    if not observations:
        return TrackSubjectResponse(
            cropPath=[],
            strategy="center_crop",
            confidence=0,
            provider="nearest-center",
            sampledFrames=sampled_frames,
            faceDetections=face_detections,
            personDetections=person_detections,
            fallbackReason="No face or person detections available for tracking.",
        )

    tracks = _build_tracks(observations)
    tracks.sort(key=lambda track: _score_track(track, sampled_frames), reverse=True)
    primary = tracks[0]
    confidence = round(min(1, _score_track(primary, sampled_frames)), 2)
    settings = get_settings()
    if confidence < settings.tracking_confidence_threshold:
        return TrackSubjectResponse(
            cropPath=[],
            strategy="center_crop",
            confidence=confidence,
            provider="nearest-center",
            sampledFrames=sampled_frames,
            faceDetections=face_detections,
            personDetections=person_detections,
            primaryTrackLength=len(primary.observations),
            fallbackReason="Primary subject track confidence is too low.",
        )

    strategy = "face_tracking" if any(item.kind == "face" for item in primary.observations) else "person_tracking"
    target_y = _strategy_target_y(strategy, request.subjectPosition)
    by_frame = {item.frame_index: item for item in primary.observations}
    crop_path: list[CropKeyframe] = []

    for frame_index, frame in enumerate(request.detections):
        observation = by_frame.get(frame_index)
        detection_type = observation.kind if observation else "fallback"
        if observation is None:
            before = next((item for item in reversed(primary.observations) if item.frame_index < frame_index), None)
            after = next((item for item in primary.observations if item.frame_index > frame_index), None)
            if before and after and after.time_ms - before.time_ms <= MISSING_DETECTION_INTERPOLATE_MS:
                observation = _interpolate(before, after, frame.timeMs, frame_index)
                detection_type = "interpolated"

        if observation is None:
            crop = _crop_pixels(source_width, source_height, request.targetWidth, request.targetHeight, 0.5, 0.5, 0.5)
            crop_path.append(CropKeyframe(timeMs=frame.timeMs, **crop, confidence=0, detectionType="fallback"))
            continue

        center_x, center_y = _center(observation.box)
        crop = _crop_pixels(
            source_width,
            source_height,
            request.targetWidth,
            request.targetHeight,
            center_x,
            center_y,
            target_y,
        )
        crop_path.append(
            CropKeyframe(
                timeMs=frame.timeMs,
                **crop,
                confidence=observation.box.confidence,
                detectionType=detection_type,  # type: ignore[arg-type]
            )
        )

    return TrackSubjectResponse(
        cropPath=_smooth_crop_path(crop_path, source_width, source_height, request.smoothness),
        strategy=strategy,  # type: ignore[arg-type]
        confidence=confidence,
        provider="nearest-center",
        sampledFrames=sampled_frames,
        faceDetections=face_detections,
        personDetections=person_detections,
        primaryTrackLength=len(primary.observations),
        interpolatedKeyframes=sum(1 for keyframe in crop_path if keyframe.detectionType == "interpolated"),
        fallbackKeyframes=sum(1 for keyframe in crop_path if keyframe.detectionType == "fallback"),
        fallbackReason=(
            "Some frames had no primary subject detection and used center fallback keyframes."
            if any(keyframe.detectionType == "fallback" for keyframe in crop_path)
            else None
        ),
    )
