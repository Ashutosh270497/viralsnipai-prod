import re

from app.config import get_settings
from app.schemas import SceneDetectionRequest, SceneDetectionResponse
from app.video_utils import file_exists, run_command


def detect_scenes_with_pyscenedetect(request: SceneDetectionRequest) -> SceneDetectionResponse | None:
    if not file_exists(request.sourcePath):
        return SceneDetectionResponse(cutsMs=[], provider="none", fallbackReason="Source video file does not exist.")

    try:
        from scenedetect import ContentDetector, SceneManager, open_video

        video = open_video(request.sourcePath)
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(threshold=request.threshold))
        scene_manager.detect_scenes(video, show_progress=False)
        scene_list = scene_manager.get_scene_list()
        cuts = [round(scene[0].get_seconds() * 1000) for scene in scene_list[1 : request.maxCuts + 1]]
        return SceneDetectionResponse(cutsMs=cuts, provider="pyscenedetect", fallbackReason=None)
    except Exception:
        return None


def detect_scenes_with_ffmpeg(request: SceneDetectionRequest) -> SceneDetectionResponse:
    settings = get_settings()
    if not file_exists(request.sourcePath):
        return SceneDetectionResponse(cutsMs=[], provider="none", fallbackReason="Source video file does not exist.")

    threshold = max(0.01, min(1.0, request.threshold / 100))
    args = [
        settings.ffmpeg_path,
        "-hide_banner",
        "-i",
        request.sourcePath,
        "-filter:v",
        f"select='gt(scene,{threshold:.3f})',showinfo",
        "-f",
        "null",
        "-",
    ]

    try:
        result = run_command(args, timeout=120)
        text = f"{result.stderr}\n{result.stdout}"
        cuts: list[int] = []
        for match in re.finditer(r"pts_time:([0-9]+(?:\.[0-9]+)?)", text):
            cuts.append(round(float(match.group(1)) * 1000))
            if len(cuts) >= request.maxCuts:
                break
        return SceneDetectionResponse(
            cutsMs=cuts,
            provider="ffmpeg-scene",
            fallbackReason="PySceneDetect unavailable or failed; used FFmpeg scene filter fallback.",
        )
    except Exception as exc:
        return SceneDetectionResponse(cutsMs=[], provider="ffmpeg-scene", fallbackReason=str(exc))


def detect_scenes(request: SceneDetectionRequest) -> SceneDetectionResponse:
    primary = detect_scenes_with_pyscenedetect(request)
    if primary is not None:
        return primary
    return detect_scenes_with_ffmpeg(request)
