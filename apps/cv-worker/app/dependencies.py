import importlib.metadata
import importlib.util
import subprocess


def package_status(import_name: str, distribution_name: str | None = None) -> dict[str, object]:
    available = importlib.util.find_spec(import_name) is not None
    version = None
    if available:
        try:
            version = importlib.metadata.version(distribution_name or import_name)
        except importlib.metadata.PackageNotFoundError:
            version = None
    return {"available": available, "version": version}


def ffmpeg_status(binary: str = "ffmpeg") -> dict[str, object]:
    try:
        result = subprocess.run(
            [binary, "-version"],
            capture_output=True,
            text=True,
            timeout=2,
            check=False,
        )
        first_line = (result.stdout or result.stderr).splitlines()[0] if (result.stdout or result.stderr) else None
        return {"available": result.returncode == 0, "version": first_line}
    except Exception:
        return {"available": False, "version": None}
