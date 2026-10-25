from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://planer@localhost:5433/planer"
    db_pool_size: int = Field(default=5, ge=1)
    data_dir: Path = Path("data")
    port: int = Field(default=8000, ge=1, le=65535)
    app_timezone: str = "Europe/Warsaw"
    import_backend: Literal["ytdlp", "disabled", "fake"] = "ytdlp"
    import_timeout_s: int = Field(default=120, gt=0)
    web_import_enabled: bool = True
    web_import_timeout_s: int = Field(default=15, gt=0)
    web_import_max_html_mb: int = Field(default=3, gt=0)
    max_video_mb: int = Field(default=300, gt=0)
    max_pdf_mb: int = Field(default=50, gt=0)
    max_photo_mb: int = Field(default=15, gt=0)
    log_level: str = "info"
