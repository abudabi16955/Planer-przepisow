from contextlib import asynccontextmanager
from importlib.util import find_spec
from pathlib import Path
from tempfile import TemporaryFile

import psycopg
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from psycopg_pool import ConnectionPool, PoolTimeout
from starlette.exceptions import HTTPException

from app.config import Settings
from app.db import migrate


class SPAFiles(StaticFiles):
    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as error:
            # Missing assets and unknown API routes must remain real 404s.
            if (
                error.status_code == 404
                and not path.startswith(("api", "files"))
                and "." not in Path(path).name
            ):
                return await super().get_response("index.html", scope)
            raise


def create_app(settings: Settings | None = None, static_dir: Path | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        with ConnectionPool(
            settings.database_url, min_size=1, max_size=settings.db_pool_size, timeout=5
        ) as pool:
            pool.wait(timeout=10)
            migrate(pool)
            app.state.pool = pool
            yield

    app = FastAPI(title="Planer przepisów", lifespan=lifespan)

    @app.get("/api/health")
    def health():
        try:
            with app.state.pool.connection() as connection:
                connection.execute("SELECT 1").fetchone()
            with TemporaryFile(dir=settings.data_dir) as probe:
                probe.write(b"health")
                probe.flush()
        except (OSError, psycopg.Error, PoolTimeout):
            return JSONResponse({"status": "unavailable"}, status_code=503)
        return {"status": "ok"}

    @app.get("/api/config")
    def config():
        return {
            "import_enabled": settings.import_backend == "fake"
            or (settings.import_backend == "ytdlp" and find_spec("yt_dlp") is not None)
        }

    static_dir = static_dir or Path("frontend/dist").resolve()
    if static_dir.is_dir():
        app.mount("/", SPAFiles(directory=static_dir, html=True), name="spa")
    return app


app = create_app()
