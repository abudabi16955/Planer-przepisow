import base64
from uuid import uuid4

from app.importers.web.fetch import fetch_resource
from app.services.recipes import discard_uploads, save_recipe


def save_with_photo(pool, storage, settings, payload, recipe_id=None):
    if not payload.web_photo_url or payload.photo_upload_id:
        return save_recipe(pool, storage, payload, recipe_id)
    resource = fetch_resource(
        payload.web_photo_url,
        settings.web_import_timeout_s,
        settings.max_photo_mb * 1024**2,
        image=True,
    )
    data = base64.b64decode(resource["data"], validate=True)
    extension = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
    }[resource["mime"]]
    upload_id = uuid4()
    relative = f"tmp/{upload_id}{extension}"
    try:
        storage.path(relative).write_bytes(data)
        with pool.connection() as connection:
            connection.execute(
                "INSERT INTO upload (id,path,original_name,mime_type,size_bytes) VALUES (%s,%s,%s,%s,%s)",
                (upload_id, relative, "zdjecie" + extension, resource["mime"], len(data)),
            )
        try:
            return save_recipe(
                pool, storage, payload.model_copy(update={"photo_upload_id": upload_id}), recipe_id
            )
        except BaseException:
            discard_uploads(pool, storage, {upload_id: None}, {})
            raise
    finally:
        storage.remove(relative)
