from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

router = APIRouter()
PHOTO_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
}


@router.post("/api/uploads", status_code=201)
async def upload(file: UploadFile, request: Request):
    storage = request.app.state.storage
    settings = request.app.state.settings
    path = None
    try:
        chunk = await file.read(64 * 1024)
        if (
            file.content_type == "application/pdf"
            or (file.filename or "").lower().endswith(".pdf")
            or chunk.startswith(b"%PDF")
        ):
            if not chunk.startswith(b"%PDF"):
                raise HTTPException(422, "To nie jest plik PDF.")
            mime, extension, limit = "application/pdf", ".pdf", settings.max_pdf_mb
        elif file.content_type in PHOTO_TYPES:
            mime, extension, limit = (
                file.content_type,
                PHOTO_TYPES[file.content_type],
                settings.max_photo_mb,
            )
        else:
            raise HTTPException(422, "To nie jest obsługiwane zdjęcie ani plik PDF.")
        if not chunk:
            raise HTTPException(422, "Plik jest pusty.")
        upload_id = uuid4()
        path = f"tmp/{upload_id}{extension}"
        size = 0
        with storage.path(path).open("xb") as target:
            while chunk:
                size += len(chunk)
                if size > limit * 1024**2:
                    raise HTTPException(413, f"Plik jest za duży (limit {limit} MB).")
                target.write(chunk)
                chunk = await file.read(64 * 1024)
        original_name = (file.filename or "plik").replace("\\", "/").split("/")[-1] or "plik"
        with request.app.state.pool.connection() as connection:
            connection.execute(
                "INSERT INTO upload (id, path, original_name, mime_type, size_bytes) "
                "VALUES (%s, %s, %s, %s, %s)",
                (upload_id, path, original_name, mime, size),
            )
        return {
            "upload_id": str(upload_id),
            "original_name": original_name,
            "mime_type": mime,
            "size_bytes": size,
        }
    except BaseException as error:
        if path is not None:
            storage.remove(path)
        if isinstance(error, OSError):
            raise HTTPException(500, "Nie udało się zapisać pliku.") from error
        raise
    finally:
        await file.close()


@router.api_route("/files/{path:path}", methods=["GET", "HEAD"])
def serve_file(path: str, request: Request):
    storage = request.app.state.storage
    target = storage.path(path)
    if path.split("/")[0] == "tmp" or not target.is_file():
        raise HTTPException(404, "Plik nie istnieje.")
    return FileResponse(target, headers={"X-Content-Type-Options": "nosniff"})
