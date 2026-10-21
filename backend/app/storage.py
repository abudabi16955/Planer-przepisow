import os
import time
from contextlib import suppress
from pathlib import Path, PurePosixPath
from uuid import uuid4

from fastapi import HTTPException


class Storage:
    def __init__(self, data_dir: Path):
        self.root = (data_dir / "files").resolve()
        if not self.root.is_relative_to(data_dir.resolve()):
            raise ValueError("Katalog plików musi być wewnątrz DATA_DIR.")
        for directory in ("tmp", "pdfs", "photos", "videos", "thumbs"):
            (self.root / directory).mkdir(parents=True, exist_ok=True)

    def path(self, relative: str) -> Path:
        if (
            not relative
            or PurePosixPath(relative).is_absolute()
            or "\\" in relative
            or "\x00" in relative
            or any(part in ("", ".", "..") for part in relative.split("/"))
        ):
            raise HTTPException(404, "Plik nie istnieje.")
        path = (self.root / relative).resolve()
        if not path.is_relative_to(self.root):
            raise HTTPException(404, "Plik nie istnieje.")
        return path

    def remove(self, relative: str):
        self.path(relative).unlink(missing_ok=True)

    def move(self, source: str, target: str):
        os.replace(self.path(source), self.path(target))

    def cleanup_tmp(self, pool):
        """Lock expired upload records; never sweep an upload another request is adopting."""
        cutoff = time.time() - 24 * 3600
        with pool.connection() as connection:
            expired = connection.execute(
                "SELECT id, path FROM upload WHERE recipe_id IS NULL "
                "AND created_at < now() - interval '24 hours' FOR UPDATE SKIP LOCKED"
            ).fetchall()
            for upload_id, path in expired:
                if path.startswith("tmp/"):
                    self.remove(path)
                    connection.execute("DELETE FROM upload WHERE id = %s", (upload_id,))
            referenced = {row[0] for row in connection.execute("SELECT path FROM upload")}
            for path in (self.root / "tmp").iterdir():
                relative = "tmp/" + path.name
                if (
                    relative not in referenced
                    and path.lstat().st_mtime < cutoff
                    and (path.is_symlink() or path.is_file())
                ):
                    path.unlink()


class FileChanges:
    """Retain old files until DB commit; restore them if the transaction fails."""

    def __init__(self, storage: Storage):
        self.storage = storage
        self.retired: list[tuple[str, str]] = []

    def retire(self, path: str):
        if self.storage.path(path).exists():
            temporary = f"tmp/{uuid4()}.deleted"
            self.storage.move(path, temporary)
            self.retired.append((path, temporary))

    def rollback(self):
        for original, temporary in reversed(self.retired):
            self.storage.move(temporary, original)

    def commit(self):
        for _, temporary in self.retired:
            # A failed unlink leaves an orphan in tmp for the periodic sweep.
            with suppress(OSError):
                self.storage.remove(temporary)
