import logging
import shutil
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from fastapi import HTTPException
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.importers.base import ImportError, Limits, platform_for_url
from app.importers.registry import create_importer

logger = logging.getLogger(__name__)


class ImportJobs:
    def __init__(self, pool, storage, settings):
        self.pool = pool
        self.storage = storage
        self.importer = create_importer(settings.import_backend)
        self.limits = Limits(
            settings.import_timeout_s,
            settings.max_video_mb * 1024**2,
            settings.max_photo_mb * 1024**2,
        )
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="import")
        with pool.connection() as connection:
            interrupted = connection.execute(
                "UPDATE import_job SET status = 'failed', error_code = 'unavailable' "
                "WHERE status = 'running' RETURNING id"
            ).fetchall()
            queued = connection.execute(
                "SELECT id FROM import_job WHERE status = 'queued' ORDER BY created_at"
            ).fetchall()
        for (job_id,) in interrupted:
            shutil.rmtree(self.workdir(job_id), ignore_errors=True)
        for (job_id,) in queued:
            self.executor.submit(self.run, job_id)

    @property
    def enabled(self):
        return self.importer is not None

    def workdir(self, job_id):
        return self.storage.path(f"tmp/import-{job_id}")

    def close(self):
        self.executor.shutdown(wait=True, cancel_futures=True)

    def enqueue(self, url):
        platform = platform_for_url(url)
        if not self.enabled:
            raise HTTPException(503, detail={"code": "unavailable"})
        job_id = uuid4()
        with self.pool.connection() as connection:
            connection.execute(
                "INSERT INTO import_job (id, url, platform) VALUES (%s, %s, %s)",
                (job_id, url, platform),
            )
        self.executor.submit(self.run, job_id)
        return self.read(job_id)

    def read(self, job_id):
        with (
            self.pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            result = cursor.execute("SELECT * FROM import_job WHERE id = %s", (job_id,)).fetchone()
        if result is None:
            raise HTTPException(404, "Import nie istnieje.")
        return result

    def run(self, job_id):
        workdir = self.workdir(job_id)
        published = []
        try:
            with self.pool.connection() as connection:
                row = connection.execute(
                    "UPDATE import_job SET status = 'running' WHERE id = %s AND status = 'queued' RETURNING url",
                    (job_id,),
                ).fetchone()
            if not row:
                return
            if not self.enabled:
                raise ImportError("unavailable")
            workdir.mkdir()
            result = self.importer.fetch(row[0], workdir, self.limits)
            metadata = []
            for path, mime in (
                (result.video_path, "video/mp4"),
                (result.thumbnail_path, "image/jpeg"),
            ):
                if path is None:
                    metadata.append(None)
                    continue
                if path.is_symlink() or not path.resolve().is_relative_to(workdir.resolve()):
                    raise ImportError("unavailable")
                size = path.stat().st_size
                if size > (
                    self.limits.max_video_bytes
                    if mime == "video/mp4"
                    else self.limits.max_photo_bytes
                ):
                    raise ImportError("too_large")
                relative = f"tmp/{uuid4()}." + ("mp4" if mime == "video/mp4" else "jpg")
                path.replace(self.storage.path(relative))
                published.append(relative)
                metadata.append(Jsonb({"path": relative, "mime_type": mime, "size_bytes": size}))
            with self.pool.connection() as connection:
                connection.execute(
                    "UPDATE import_job SET status = 'done', video = %s, thumbnail = %s, description = %s, title = %s, size_bytes = %s WHERE id = %s",
                    (*metadata, result.description, result.title, result.size_bytes, job_id),
                )
        except Exception as error:  # noqa: BLE001 -- importer plugins cannot crash the application
            code = error.code if isinstance(error, ImportError) else "unavailable"
            for path in published:
                self.storage.remove(path)
            logger.warning("Import %s failed (%s)", job_id, code)
            with self.pool.connection() as connection:
                connection.execute(
                    "UPDATE import_job SET status = 'failed', error_code = %s WHERE id = %s",
                    (code, job_id),
                )
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def cleanup(self):
        with self.pool.connection() as connection:
            expired = connection.execute(
                "SELECT id, video, thumbnail FROM import_job WHERE status IN ('done', 'failed') AND created_at < now() - interval '24 hours' FOR UPDATE SKIP LOCKED"
            ).fetchall()
            for job_id, video, thumbnail in expired:
                for file in (video, thumbnail):
                    if file and file["path"].startswith("tmp/"):
                        self.storage.remove(file["path"])
                shutil.rmtree(self.workdir(job_id), ignore_errors=True)
                connection.execute("DELETE FROM import_job WHERE id = %s", (job_id,))
