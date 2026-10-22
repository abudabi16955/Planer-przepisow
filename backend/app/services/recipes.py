from uuid import uuid4

from fastapi import HTTPException
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.models import RecipeCreate
from app.storage import FileChanges

FIELDS = (
    "title",
    "category",
    "time_min",
    "servings",
    "source_type",
    "source_platform",
    "source_url",
    "source_description",
    "kcal",
    "protein",
    "carbs",
    "fat",
    "steps",
)
FILE_FIELDS = ("video", "pdf", "photo")


def get_recipe(connection, recipe_id, lock=False):
    with connection.cursor(row_factory=dict_row) as cursor:
        recipe = cursor.execute(
            "SELECT * FROM recipe WHERE id = %s" + (" FOR UPDATE" if lock else ""),
            (recipe_id,),
        ).fetchone()
        if recipe is None:
            raise HTTPException(404, "Przepis nie istnieje.")
        recipe["ingredients"] = cursor.execute(
            "SELECT product_id, quantity, unit FROM recipe_ingredient "
            "WHERE recipe_id = %s ORDER BY position",
            (recipe_id,),
        ).fetchall()
        return recipe


def validate_ingredients(connection, ingredients):
    for ingredient in ingredients:
        product = connection.execute(
            "SELECT units FROM product WHERE id = %s", (ingredient.product_id,)
        ).fetchone()
        if product is None or (ingredient.unit and ingredient.unit not in product[0]):
            raise HTTPException(422, "Wybierz produkt i jedną z jego jednostek.")


def discard_uploads(pool, storage, uploads, new_paths):
    with pool.connection() as connection:
        for upload_id in uploads:
            row = connection.execute(
                "SELECT path FROM upload WHERE id = %s AND recipe_id IS NULL FOR UPDATE",
                (upload_id,),
            ).fetchone()
            if row:
                storage.remove(row[0])
                if upload_id in new_paths:
                    storage.remove(new_paths[upload_id])
                connection.execute("DELETE FROM upload WHERE id = %s", (upload_id,))


def save_recipe(pool, storage, payload: RecipeCreate, recipe_id=None):
    is_new = recipe_id is None
    recipe_id = recipe_id or uuid4()
    changes = FileChanges(storage)
    uploads = {}
    new_paths = {}
    job_files = []
    try:
        with pool.connection() as connection, connection.cursor(row_factory=dict_row) as cursor:
            old = None if is_new else get_recipe(connection, recipe_id, lock=True)
            for field, upload_id, mime in (
                ("pdf", payload.pdf_upload_id, "application/pdf"),
                ("photo", payload.photo_upload_id, "image/"),
            ):
                if upload_id:
                    record = cursor.execute(
                        "SELECT * FROM upload WHERE id = %s AND recipe_id IS NULL FOR UPDATE",
                        (upload_id,),
                    ).fetchone()
                    if record is None or not record["mime_type"].startswith(mime):
                        raise HTTPException(422, "Wybierz poprawny, nieużyty plik.")
                    uploads[upload_id] = (field, record)
            validate_ingredients(connection, payload.ingredients)
            files = {field: old[field] if old else None for field in FILE_FIELDS}
            if payload.source_type != "pdf":
                files["pdf"] = None
            if payload.source_type != "link":
                files["video"] = None
            values = {field: getattr(payload, field) for field in FIELDS}
            if payload.import_job_id:
                job = cursor.execute(
                    "SELECT * FROM import_job WHERE id = %s FOR UPDATE", (payload.import_job_id,)
                ).fetchone()
                if not job or job["status"] != "done" or not job["video"]:
                    raise HTTPException(422, "Najpierw pobierz wideo.")
                values.update(
                    source_platform=job["platform"],
                    source_url=job["url"],
                    source_description=job["description"],
                )
                for job_field, recipe_field, directory in (
                    ("video", "video", "videos"),
                    ("thumbnail", "photo", "thumbs"),
                ):
                    if not job[job_field]:
                        continue
                    metadata = dict(job[job_field])
                    source = metadata["path"]
                    if not source.startswith("tmp/"):
                        raise HTTPException(422, "Wynik importu nie jest plikiem tymczasowym.")
                    destination = directory + "/" + storage.path(source).name
                    job_files.append((source, destination))
                    if job_field == "thumbnail" and payload.photo_upload_id:
                        changes.retire(source)
                    else:
                        storage.move(source, destination)
                        metadata["path"] = destination
                        files[recipe_field] = metadata
                cursor.execute(
                    "UPDATE import_job SET video = NULL, thumbnail = NULL WHERE id = %s",
                    (payload.import_job_id,),
                )
            elif payload.source_type == "link" and old and old["source_type"] == "link":
                for field in ("source_platform", "source_url", "source_description"):
                    values[field] = old[field]
            for upload_id, (field, record) in uploads.items():
                destination = ("pdfs/" if field == "pdf" else "photos/") + storage.path(
                    record["path"]
                ).name
                new_paths[upload_id] = destination
                storage.move(record["path"], destination)
                files[field] = {
                    "path": destination,
                    "size_bytes": record["size_bytes"],
                    "original_name": record["original_name"],
                    "mime_type": record["mime_type"],
                }
            if payload.source_type == "pdf" and files["pdf"] is None:
                raise HTTPException(422, "Wybierz plik PDF.")
            if payload.source_type == "link" and files["video"] is None:
                raise HTTPException(422, "Najpierw pobierz wideo.")
            if old:
                for field in FILE_FIELDS:
                    if old[field] and old[field] != files[field]:
                        changes.retire(old[field]["path"])
                cursor.execute(
                    "UPDATE recipe SET "
                    + ", ".join(f"{field} = %s" for field in FIELDS)
                    + ", video = %s, pdf = %s, photo = %s, updated_at = now() WHERE id = %s",
                    (
                        *values.values(),
                        *(Jsonb(files[field]) if files[field] else None for field in FILE_FIELDS),
                        recipe_id,
                    ),
                )
                cursor.execute("DELETE FROM recipe_ingredient WHERE recipe_id = %s", (recipe_id,))
                for field in ("pdf", "photo"):
                    if old[field] and old[field] != files[field]:
                        cursor.execute(
                            "DELETE FROM upload WHERE recipe_id = %s AND path = %s",
                            (recipe_id, old[field]["path"]),
                        )
            else:
                cursor.execute(
                    "INSERT INTO recipe (id, "
                    + ", ".join(FIELDS)
                    + ", video, pdf, photo) VALUES ("
                    + ", ".join(["%s"] * (len(FIELDS) + 4))
                    + ")",
                    (
                        recipe_id,
                        *values.values(),
                        *(Jsonb(files[field]) if files[field] else None for field in FILE_FIELDS),
                    ),
                )
            for position, ingredient in enumerate(payload.ingredients):
                cursor.execute(
                    "INSERT INTO recipe_ingredient (recipe_id, position, product_id, quantity, unit) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (
                        recipe_id,
                        position,
                        ingredient.product_id,
                        ingredient.quantity,
                        ingredient.unit,
                    ),
                )
            for upload_id, destination in new_paths.items():
                cursor.execute(
                    "UPDATE upload SET path = %s, recipe_id = %s WHERE id = %s",
                    (destination, recipe_id, upload_id),
                )
            result = get_recipe(connection, recipe_id)
        changes.commit()
        return result
    except BaseException:
        changes.rollback()
        if job_files:
            with pool.connection() as connection:
                job = connection.execute(
                    "SELECT video FROM import_job WHERE id = %s FOR UPDATE",
                    (payload.import_job_id,),
                ).fetchone()
                if job and job[0] and job[0]["path"] == job_files[0][0]:
                    for source, destination in job_files:
                        storage.remove(source)
                        storage.remove(destination)
                    connection.execute(
                        "UPDATE import_job SET video = NULL, thumbnail = NULL, status = 'failed', "
                        "error_code = 'unavailable' WHERE id = %s",
                        (payload.import_job_id,),
                    )
        discard_uploads(pool, storage, uploads, new_paths)
        raise


def delete_recipe(pool, storage, recipe_id):
    changes = FileChanges(storage)
    try:
        with pool.connection() as connection:
            recipe = get_recipe(connection, recipe_id, lock=True)
            for field in FILE_FIELDS:
                if recipe[field]:
                    changes.retire(recipe[field]["path"])
            connection.execute("DELETE FROM recipe WHERE id = %s", (recipe_id,))
        changes.commit()
    except BaseException:
        changes.rollback()
        raise
