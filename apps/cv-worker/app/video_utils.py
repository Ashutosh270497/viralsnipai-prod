import json
import math
import os
import subprocess
import tempfile
from pathlib import Path

from app.config import get_settings


def file_exists(path: str) -> bool:
    return bool(path) and Path(path).expanduser().exists()


def run_command(args: list[str], timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )


def probe_video_size(source_path: str) -> tuple[int | None, int | None]:
    settings = get_settings()
    ffprobe = os.getenv("FFPROBE_PATH") or settings.ffmpeg_path.replace("ffmpeg", "ffprobe")
    try:
      result = run_command(
          [
              ffprobe,
              "-v",
              "error",
              "-select_streams",
              "v:0",
              "-show_entries",
              "stream=width,height",
              "-of",
              "json",
              source_path,
          ],
          timeout=10,
      )
      if result.returncode != 0:
          return None, None
      payload = json.loads(result.stdout or "{}")
      stream = (payload.get("streams") or [{}])[0]
      width = stream.get("width")
      height = stream.get("height")
      if isinstance(width, int) and isinstance(height, int):
          return width, height
    except Exception:
        return None, None
    return None, None


def sample_frame_paths(
    source_path: str,
    clip_start_ms: int,
    clip_end_ms: int,
    sample_interval_ms: int,
    max_frames: int,
) -> tuple[list[tuple[int, str]], str | None, str | None]:
    if not file_exists(source_path):
        return [], None, "Source video file does not exist."

    settings = get_settings()
    duration_ms = max(0, clip_end_ms - clip_start_ms)
    if duration_ms <= 0:
        return [], None, "Clip duration must be greater than zero."

    interval_ms = max(1, sample_interval_ms)
    desired_frames = min(max_frames, max(1, math.ceil(duration_ms / interval_ms)))
    temp_dir = tempfile.mkdtemp(prefix="cv-worker-frames-")
    output_pattern = str(Path(temp_dir) / "frame_%04d.jpg")
    fps = desired_frames / (duration_ms / 1000)

    args = [
        settings.ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        str(clip_start_ms / 1000),
        "-i",
        source_path,
        "-t",
        str(duration_ms / 1000),
        "-vf",
        f"fps={fps:.4f},scale=640:-1",
        "-frames:v",
        str(desired_frames),
        "-q:v",
        "4",
        "-f",
        "image2",
        output_pattern,
        "-y",
    ]

    try:
        result = run_command(args, timeout=max(20, int(duration_ms / 1000) + 15))
        if result.returncode != 0:
            return [], temp_dir, (result.stderr or "FFmpeg frame extraction failed.").strip()
    except Exception as exc:
        return [], temp_dir, str(exc)

    frame_paths = sorted(Path(temp_dir).glob("frame_*.jpg"))
    if not frame_paths:
        return [], temp_dir, "FFmpeg produced no sample frames."

    frames: list[tuple[int, str]] = []
    for index, frame_path in enumerate(frame_paths):
        if len(frame_paths) == 1:
            time_ms = clip_start_ms
        else:
            time_ms = clip_start_ms + round((duration_ms * index) / (len(frame_paths) - 1))
        frames.append((time_ms, str(frame_path)))

    return frames, temp_dir, None
