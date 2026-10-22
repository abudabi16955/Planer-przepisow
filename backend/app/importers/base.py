from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Protocol
from urllib.parse import urlsplit

ErrorCode = Literal["private_or_missing", "too_large", "timeout", "unsupported_url", "unavailable"]
Platform = Literal["instagram", "facebook"]
HOSTS: dict[str, Platform] = {
    "instagram.com": "instagram",
    "www.instagram.com": "instagram",
    "facebook.com": "facebook",
    "www.facebook.com": "facebook",
    "m.facebook.com": "facebook",
    "fb.watch": "facebook",
}


class ImportError(Exception):
    def __init__(self, code: ErrorCode):
        self.code = code
        super().__init__(code)


def platform_for_url(url: str) -> Platform:
    try:
        parts = urlsplit(url)
        if (
            any(char.isspace() or ord(char) < 32 for char in url)
            or "\\" in url
            or parts.scheme != "https"
            or parts.hostname not in HOSTS
            or parts.username is not None
            or parts.password is not None
            or parts.port not in (None, 443)
        ):
            raise ValueError
        return HOSTS[parts.hostname]
    except (ValueError, TypeError) as error:
        raise ImportError("unsupported_url") from error


@dataclass(frozen=True)
class Limits:
    timeout_s: float
    max_video_bytes: int
    max_photo_bytes: int


@dataclass(frozen=True)
class ImportResult:
    video_path: Path
    thumbnail_path: Path | None
    description: str
    title: str
    platform: Platform
    size_bytes: int


class Importer(Protocol):
    def fetch(self, url: str, workdir: Path, limits: Limits) -> ImportResult: ...
