from unittest.mock import patch

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg_pool import ConnectionPool

from app.config import Settings
from app.db import migrate
from app.main import create_app


def test_settings_from_env(monkeypatch):
    values = {
        "DATABASE_URL": "postgresql://localhost/example",
        "DB_POOL_SIZE": "2",
        "DATA_DIR": "example",
        "PORT": "9000",
        "APP_TIMEZONE": "UTC",
        "IMPORT_BACKEND": "disabled",
        "IMPORT_TIMEOUT_S": "20",
        "MAX_VIDEO_MB": "10",
        "MAX_PDF_MB": "5",
        "MAX_PHOTO_MB": "2",
        "LOG_LEVEL": "debug",
    }
    for key, value in values.items():
        monkeypatch.setenv(key, value)
    settings = Settings(_env_file=None)
    for key, value in values.items():
        assert str(getattr(settings, key.lower())) == value


def test_migrations_from_empty_and_idempotent(clean_database):
    with ConnectionPool(clean_database) as pool:
        migrate(pool)
        migrate(pool)
        with pool.connection() as connection:
            assert connection.execute(
                "SELECT version FROM schema_version ORDER BY version"
            ).fetchall() == [
                ("001_init.sql",),
                ("002_schema.sql",),
                ("003_seed_products.sql",),
                ("004_web_source.sql",),
            ]


def test_failed_migration_rolls_back(clean_database, tmp_path):
    (tmp_path / "001_test.sql").write_text("CREATE TABLE example (id int);")
    (tmp_path / "002_fail.sql").write_text("INVALID SQL;")
    with ConnectionPool(clean_database) as pool:
        with pytest.raises(psycopg.Error):
            migrate(pool, tmp_path)
        with pool.connection() as connection:
            assert connection.execute("SELECT to_regclass('example')").fetchone() == (None,)
            assert connection.execute("SELECT to_regclass('schema_version')").fetchone() == (None,)


def test_health_config_and_spa(clean_database, tmp_path):
    static = tmp_path / "static"
    static.mkdir()
    (static / "index.html").write_text('<html lang="pl">Planer przepisów</html>')
    settings = Settings(
        database_url=clean_database, data_dir=tmp_path / "data", import_backend="disabled"
    )
    with TestClient(create_app(settings, static)) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        assert client.get("/api/config").json() == {
            "import_enabled": False,
            "max_video_mb": 300,
            "web_import_enabled": True,
        }
        assert "Planer przepisów" in client.get("/planer").text
        assert client.get("/api/missing").status_code == 404
        assert client.get("/missing.js").status_code == 404
        with patch("app.main.TemporaryFile", side_effect=OSError):
            assert client.get("/api/health").status_code == 503
        with patch.object(
            client.app.state.pool, "connection", side_effect=psycopg.OperationalError
        ):
            assert client.get("/api/health").status_code == 503


@pytest.mark.parametrize(
    ("backend", "available", "enabled"),
    [
        ("fake", False, True),
        ("disabled", True, False),
        ("ytdlp", False, False),
        ("ytdlp", True, True),
    ],
)
def test_import_availability(clean_database, tmp_path, backend, available, enabled):
    settings = Settings(database_url=clean_database, data_dir=tmp_path, import_backend=backend)
    with (
        patch("app.importers.registry.find_spec", return_value=object() if available else None),
        TestClient(create_app(settings)) as client,
    ):
        assert client.get("/api/config").json() == {
            "import_enabled": enabled,
            "max_video_mb": 300,
            "web_import_enabled": True,
        }
