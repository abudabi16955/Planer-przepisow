from importlib import import_module
from importlib.util import find_spec
from uuid import uuid4

from app.importers.base import ImportError, ImportResult, platform_for_url
from app.importers.ytdlp import YtDlpImporter


class FakeImporter:
    """Deterministic offline fixture. Error injection belongs in tests, never URL commands."""

    def fetch(self, url, workdir, limits):
        platform = platform_for_url(url)
        video = workdir / f"{uuid4()}.mp4"
        thumbnail = workdir / f"{uuid4()}.jpg"
        content = b"\x00\x00\x00\x18ftypmp42fake-public-video"
        if len(content) > limits.max_video_bytes:
            raise ImportError("too_large")
        video.write_bytes(content)
        thumbnail.write_bytes(b"\xff\xd8\xfffake-thumbnail")
        return ImportResult(
            video, thumbnail, "Opis publicznego posta", "Przepis", platform, len(content)
        )


def create_importer(backend):
    if backend == "fake":
        return FakeImporter()
    if backend == "ytdlp":
        try:
            if find_spec("yt_dlp") is not None:
                import_module("yt_dlp")
                return YtDlpImporter()
        except Exception:  # noqa: BLE001 -- a broken optional importer must not prevent startup
            return None
    return None
