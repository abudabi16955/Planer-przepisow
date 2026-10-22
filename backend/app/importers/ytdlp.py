import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

from app.importers.base import ImportError, ImportResult, Limits, platform_for_url


class YtDlpImporter:
    def __init__(self, command=None):
        self.command = command or [sys.executable, "-m", "yt_dlp"]

    def fetch(self, url: str, workdir: Path, limits: Limits) -> ImportResult:
        platform = platform_for_url(url)
        deadline = time.monotonic() + limits.timeout_s
        if urlsplit(url).hostname == "fb.watch":
            try:
                redirect = subprocess.run(
                    [sys.executable, "-m", "app.importers.redirect", url, str(limits.timeout_s)],
                    capture_output=True,
                    timeout=limits.timeout_s,
                    check=False,
                )
                if redirect.returncode:
                    raise ImportError("private_or_missing")
                url = json.loads(redirect.stdout)
                if platform_for_url(url) != platform:
                    raise ImportError("unsupported_url")
            except subprocess.TimeoutExpired as error:
                raise ImportError("timeout") from error
            except (OSError, ValueError) as error:
                raise ImportError("unavailable") from error
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ImportError("timeout")
        stem = str(uuid4())
        arguments = [
            *self.command,
            "--ignore-config",
            "--no-cookies",
            "--no-cookies-from-browser",
            "--no-cache-dir",
            "--no-playlist",
            "--playlist-items",
            "1",
            "--use-extractors",
            "Instagram.*,Facebook.*",
            "--no-progress",
            "--no-warnings",
            "--no-overwrites",
            "--socket-timeout",
            str(limits.timeout_s),
            "--max-filesize",
            str(limits.max_video_bytes),
            "--format",
            "best[ext=mp4][height<=1080]/bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]",
            "--merge-output-format",
            "mp4",
            "--write-thumbnail",
            "--convert-thumbnails",
            "jpg",
            "--write-info-json",
            "--output",
            str(workdir / (stem + ".%(ext)s")),
            "--",
            url,
        ]
        try:
            # No shell, user config, login or inherited browser cookies. Kill ffmpeg too on timeout.
            with (workdir / "process.log").open("wb+") as log:
                process = subprocess.Popen(
                    arguments,
                    stdout=log,
                    stderr=log,
                    start_new_session=True,
                    stdin=subprocess.DEVNULL,
                )
                try:
                    process.wait(timeout=remaining)
                except BaseException:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    process.wait()
                    raise
                log.seek(max(0, log.tell() - 8192))
                message = log.read(8192).decode("utf-8", errors="replace").lower()
            if process.returncode:
                code = "private_or_missing"
                if "unsupported url" in message:
                    code = "unsupported_url"
                elif "max-filesize" in message or "larger than" in message:
                    code = "too_large"
                elif "timed out" in message:
                    code = "timeout"
                elif "no module named" in message:
                    code = "unavailable"
                raise ImportError(code)
            video = workdir / (stem + ".mp4")
            info = workdir / (stem + ".info.json")
            if not video.is_file() or video.is_symlink() or not info.is_file():
                raise ImportError(
                    "too_large"
                    if "max-filesize" in message or "larger than" in message
                    else "private_or_missing"
                )
            metadata = json.loads(info.read_text(encoding="utf-8"))
            if metadata.get("availability") in (
                "private",
                "premium_only",
                "subscriber_only",
                "needs_auth",
            ):
                raise ImportError("private_or_missing")
            size = video.stat().st_size
            if size > limits.max_video_bytes:
                raise ImportError("too_large")
            if not size or (metadata.get("height") or 0) > 1080:
                raise ImportError("private_or_missing")
            thumbnail = workdir / (stem + ".jpg")
            if not thumbnail.is_file() or thumbnail.is_symlink():
                thumbnail = None
            elif thumbnail.stat().st_size > limits.max_photo_bytes:
                raise ImportError("too_large")
            return ImportResult(
                video,
                thumbnail,
                str(metadata.get("description") or ""),
                str(metadata.get("title") or ""),
                platform,
                size,
            )
        except subprocess.TimeoutExpired as error:
            raise ImportError("timeout") from error
        except (OSError, ValueError, TypeError, AttributeError) as error:
            raise ImportError("unavailable") from error
