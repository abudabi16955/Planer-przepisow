import os
import time
from unittest.mock import patch
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(clean_database, tmp_path):
    settings = Settings(
        database_url=clean_database,
        data_dir=tmp_path / "data",
        max_pdf_mb=1,
        max_photo_mb=1,
        import_backend="disabled",
    )
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        yield client


def recipe(**changes):
    return {
        "title": "Przepis",
        "category": "obiad",
        "servings": 2,
        "source_type": "manual",
        "steps": ["Pierwszy krok", "Drugi krok"],
    } | changes


def upload(client, content=b"%PDF-1.7\ntest", filename="test.pdf", mime="application/pdf"):
    response = client.post("/api/uploads", files={"file": (filename, content, mime)})
    assert response.status_code == 201, response.text
    return response.json()["upload_id"]


def assert_no_upload_files(client):
    storage = client.app.state.storage
    assert list((storage.root / "tmp").iterdir()) == []
    assert list((storage.root / "pdfs").iterdir()) == []
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM upload").fetchone() == (0,)


def test_crud_ingredients_steps_and_cascade(client):
    products = client.get("/api/products").json()
    eggs = next(product for product in products if product["name"] == "Jajka")
    payload = recipe(
        ingredients=[
            {"product_id": eggs["id"], "quantity": 2, "unit": "szt."},
            {"product_id": eggs["id"], "quantity": None, "unit": ""},
        ]
    )
    response = client.post("/api/recipes", json=payload)
    assert response.status_code == 201, response.text
    saved = response.json()
    recipe_id = saved["id"]
    assert saved["ingredients"] == payload["ingredients"]
    assert saved["steps"] == payload["steps"]
    assert saved["kcal"] is None
    assert client.get(f"/api/recipes/{recipe_id}").json() == saved
    assert client.get("/api/recipes").json() == [saved]
    updated = client.put(
        f"/api/recipes/{recipe_id}", json=recipe(title="Zmieniony", steps=[" ", " Krok "])
    )
    assert updated.status_code == 200
    assert updated.json()["steps"] == ["Krok"]
    assert updated.json()["ingredients"] == []
    with client.app.state.pool.connection() as connection:
        connection.execute("INSERT INTO plan_entry VALUES ('2026-10-21', 1, %s)", (recipe_id,))
    assert client.delete(f"/api/recipes/{recipe_id}").status_code == 204
    assert client.get(f"/api/recipes/{recipe_id}").status_code == 404
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM plan_entry").fetchone() == (0,)
        assert connection.execute("SELECT count(*) FROM recipe_ingredient").fetchone() == (0,)


def test_upload_attach_update_delete_files(client):
    pdf = upload(client, filename="../../nazwa.pdf")
    photo = upload(client, b"photo", "../danie.jpg", "image/jpeg")
    response = client.post(
        "/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf, photo_upload_id=photo)
    )
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["pdf"]["original_name"] == "nazwa.pdf"
    assert saved["pdf"]["path"].startswith("pdfs/")
    assert saved["photo"]["path"].startswith("photos/")
    assert list((client.app.state.storage.root / "tmp").iterdir()) == []
    assert client.get("/files/" + saved["pdf"]["path"]).content == b"%PDF-1.7\ntest"
    old_photo = saved["photo"]["path"]
    photo2 = upload(client, b"photo2", "new.png", "image/png")
    updated = client.put(
        "/api/recipes/" + saved["id"], json=recipe(source_type="pdf", photo_upload_id=photo2)
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["pdf"] == saved["pdf"]
    assert client.get("/files/" + old_photo).status_code == 404
    assert client.delete("/api/recipes/" + saved["id"]).status_code == 204
    assert client.get("/files/" + saved["pdf"]["path"]).status_code == 404
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM upload").fetchone() == (0,)
    assert not any(path.is_file() for path in client.app.state.storage.root.rglob("*"))


@pytest.mark.parametrize(
    "changes",
    [
        {"title": ""},
        {"category": "inne"},
        {"servings": 0},
        {"servings": 51},
        {"servings": 1.5},
        {"time_min": 0},
        {"protein": -1},
        {"source_type": "inne"},
        {"pdf": {"path": "../secret"}},
        {"source_type": "pdf"},
        {"source_type": "link"},
        {"ingredients": [{"product_id": str(uuid4()), "quantity": 1, "unit": "g"}]},
    ],
)
def test_recipe_validation(client, changes):
    assert client.post("/api/recipes", json=recipe(**changes)).status_code == 422
    assert client.get("/api/recipes").json() == []


def test_ingredient_unit_and_quantity_validation(client):
    product_id = next(p["id"] for p in client.get("/api/products").json() if p["name"] == "Jajka")
    for quantity, unit in [(1, "g"), (0, "szt."), (-1, "szt."), (None, "szt."), (1, "")]:
        payload = recipe(
            ingredients=[{"product_id": product_id, "quantity": quantity, "unit": unit}]
        )
        assert client.post("/api/recipes", json=payload).status_code == 422


def test_upload_validation_limits_and_no_leftovers(client):
    for content, name, mime, status in [
        (b"fake pdf", "plik.pdf", "application/pdf", 422),
        (b"<svg/>", "plik.svg", "image/svg+xml", 422),
        (b"", "empty.jpg", "image/jpeg", 422),
        (b"%PDF" + b"x" * 1024**2, "big.pdf", "application/pdf", 413),
        (b"x" * (1024**2 + 1), "big.jpg", "image/jpeg", 413),
    ]:
        response = client.post("/api/uploads", files={"file": (name, content, mime)})
        assert response.status_code == status, response.text
        assert_no_upload_files(client)


def test_pdf_signature_and_exact_limit(client):
    content = b"%PDF" + b"x" * (1024**2 - 4)
    upload_id = upload(client, content, "plik.bin", "application/octet-stream")
    with client.app.state.pool.connection() as connection:
        row = connection.execute(
            "SELECT path, size_bytes FROM upload WHERE id = %s", (upload_id,)
        ).fetchone()
    assert row[1] == 1024**2
    assert row[0].startswith("tmp/")
    assert client.get("/files/" + row[0]).status_code == 404


def test_reused_and_wrong_uploads_rejected(client):
    pdf = upload(client)
    first = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf)).json()
    assert (
        client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf)).status_code
        == 422
    )
    assert client.get("/files/" + first["pdf"]["path"]).status_code == 200
    pdf2 = upload(client)
    assert client.post("/api/recipes", json=recipe(photo_upload_id=pdf2)).status_code == 422


def test_move_failure_removes_new_files_and_recipe(client):
    pdf = upload(client)
    with patch.object(client.app.state.storage, "move", side_effect=OSError("disk full")):
        response = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf))
    assert response.status_code == 500
    assert client.get("/api/recipes").json() == []
    assert_no_upload_files(client)


def test_db_failure_after_move_cleans_files_and_rolls_back(client):
    pdf = upload(client)
    with patch("app.services.recipes.get_recipe", side_effect=psycopg.OperationalError("failed")):
        response = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf))
    assert response.status_code == 500
    assert client.get("/api/recipes").json() == []
    assert_no_upload_files(client)


def test_failed_update_keeps_old_recipe_and_files(client):
    pdf = upload(client)
    old = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf)).json()
    replacement = upload(client, b"%PDF-new")
    original_move = client.app.state.storage.move
    calls = 0

    def fail_retire(source, destination):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("cannot retire old file")
        original_move(source, destination)

    with patch.object(client.app.state.storage, "move", side_effect=fail_retire):
        response = client.put(
            "/api/recipes/" + old["id"],
            json=recipe(title="New", source_type="pdf", pdf_upload_id=replacement),
        )
    assert response.status_code == 500
    assert client.get("/api/recipes/" + old["id"]).json() == old
    assert client.get("/files/" + old["pdf"]["path"]).content == b"%PDF-1.7\ntest"
    assert list((client.app.state.storage.root / "tmp").iterdir()) == []
    assert len(list((client.app.state.storage.root / "pdfs").iterdir())) == 1


def test_range_full_partial_suffix_and_unsatisfiable(client):
    path = client.app.state.storage.root / "videos" / "test.mp4"
    path.write_bytes(b"0123456789")
    response = client.get("/files/videos/test.mp4")
    assert response.status_code == 200
    assert response.content == b"0123456789"
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["x-content-type-options"] == "nosniff"
    for value, content, content_range in [
        ("bytes=2-5", b"2345", "bytes 2-5/10"),
        ("bytes=7-", b"789", "bytes 7-9/10"),
        ("bytes=-3", b"789", "bytes 7-9/10"),
    ]:
        response = client.get("/files/videos/test.mp4", headers={"Range": value})
        assert response.status_code == 206
        assert response.content == content
        assert response.headers["content-range"] == content_range
    response = client.get("/files/videos/test.mp4", headers={"Range": "bytes=10-20"})
    assert response.status_code == 416
    assert response.headers["content-range"] == "bytes */10"
    assert client.head("/files/videos/test.mp4").content == b""


@pytest.mark.parametrize(
    "path",
    [
        "../secret.txt",
        "%2e%2e/secret.txt",
        "%252e%252e/secret.txt",
        "/secret.txt",
        "%2fsecret.txt",
        "..%5csecret.txt",
    ],
)
def test_traversal_never_serves_files_outside_root(client, path):
    secret = client.app.state.settings.data_dir / "secret.txt"
    secret.write_text("PRIVATE FILE")
    response = client.get("/files/" + path)
    assert response.status_code == 404
    assert b"PRIVATE FILE" not in response.content


def test_symlink_outside_files_is_rejected(client):
    storage = client.app.state.storage
    secret = client.app.state.settings.data_dir / "secret.txt"
    secret.write_text("PRIVATE FILE")
    (storage.root / "photos" / "link.jpg").symlink_to(secret)
    assert client.get("/files/photos/link.jpg").status_code == 404


def test_cleanup_expired_uploads_and_orphans_preserves_fresh_and_attached(client):
    expired = upload(client)
    fresh = upload(client)
    attached = upload(client)
    saved = client.post(
        "/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=attached)
    ).json()
    with client.app.state.pool.connection() as connection:
        connection.execute(
            "UPDATE upload SET created_at = now() - interval '25 hours' WHERE id IN (%s, %s)",
            (expired, attached),
        )
        paths = dict(connection.execute("SELECT id::text, path FROM upload").fetchall())
    orphan = client.app.state.storage.root / "tmp" / "orphan"
    orphan.write_text("old")
    os.utime(orphan, (time.time() - 25 * 3600,) * 2)
    client.app.state.storage.cleanup_tmp(client.app.state.pool)
    assert not client.app.state.storage.path(paths[expired]).exists()
    assert client.app.state.storage.path(paths[fresh]).exists()
    assert client.get("/files/" + saved["pdf"]["path"]).status_code == 200
    assert not orphan.exists()


def test_unknown_recipe_ids(client):
    unknown = str(uuid4())
    assert client.get("/api/recipes/" + unknown).status_code == 404
    assert client.put("/api/recipes/" + unknown, json=recipe()).status_code == 404
    assert client.delete("/api/recipes/" + unknown).status_code == 404


def test_update_db_failure_restores_retired_old_file(client):
    from app.services.recipes import get_recipe

    pdf = upload(client)
    old = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf)).json()
    replacement = upload(client, b"%PDF-new")
    count = 0

    def fail_final_read(*args, **kwargs):
        nonlocal count
        count += 1
        if count == 2:
            raise psycopg.OperationalError("failed before commit")
        return get_recipe(*args, **kwargs)

    with patch("app.services.recipes.get_recipe", side_effect=fail_final_read):
        response = client.put(
            "/api/recipes/" + old["id"], json=recipe(source_type="pdf", pdf_upload_id=replacement)
        )
    assert response.status_code == 500
    assert client.get("/api/recipes/" + old["id"]).json() == old
    assert client.get("/files/" + old["pdf"]["path"]).status_code == 200
    assert list((client.app.state.storage.root / "tmp").iterdir()) == []
    assert len(list((client.app.state.storage.root / "pdfs").iterdir())) == 1


def test_delete_db_failure_restores_file_and_plan(client):
    pdf = upload(client)
    old = client.post("/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf)).json()
    with client.app.state.pool.connection() as connection:
        connection.execute("INSERT INTO plan_entry VALUES ('2026-10-21', 1, %s)", (old["id"],))
        connection.execute("""
            CREATE FUNCTION fail_delete() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'simulated database failure'; END $$;
            CREATE TRIGGER fail_delete BEFORE DELETE ON recipe
                FOR EACH ROW EXECUTE FUNCTION fail_delete();
        """)
    assert client.delete("/api/recipes/" + old["id"]).status_code == 500
    assert client.get("/api/recipes/" + old["id"]).json() == old
    assert client.get("/files/" + old["pdf"]["path"]).status_code == 200
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM plan_entry").fetchone() == (1,)


def test_upload_db_failure_removes_temporary_file(client):
    with client.app.state.pool.connection() as connection:
        connection.execute("""
            CREATE FUNCTION fail_upload() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN RAISE EXCEPTION 'simulated database failure'; END $$;
            CREATE TRIGGER fail_upload BEFORE INSERT ON upload
                FOR EACH ROW EXECUTE FUNCTION fail_upload();
        """)
    response = client.post(
        "/api/uploads", files={"file": ("test.pdf", b"%PDF-data", "application/pdf")}
    )
    assert response.status_code == 500
    assert_no_upload_files(client)


def test_completed_import_is_attached_without_accepting_user_paths(client):
    from psycopg.types.json import Jsonb

    job_id = uuid4()
    path = f"tmp/{uuid4()}.mp4"
    client.app.state.storage.path(path).write_bytes(b"video")
    with client.app.state.pool.connection() as connection:
        connection.execute(
            "INSERT INTO import_job (id, url, platform, status, video, description) "
            "VALUES (%s, 'https://instagram.com/reel/example', 'instagram', 'done', %s, %s)",
            (
                job_id,
                Jsonb({"path": path, "mime_type": "video/mp4", "size_bytes": 5}),
                "<script>text</script>",
            ),
        )
    response = client.post(
        "/api/recipes", json=recipe(source_type="link", import_job_id=str(job_id))
    )
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["source_platform"] == "instagram"
    assert saved["source_description"] == "<script>text</script>"
    assert client.get("/files/" + saved["video"]["path"]).content == b"video"
    assert (
        client.post(
            "/api/recipes", json=recipe(source_type="link", import_job_id=str(job_id))
        ).status_code
        == 422
    )
    assert client.delete("/api/recipes/" + saved["id"]).status_code == 204
    assert client.get("/files/" + saved["video"]["path"]).status_code == 404


def test_partial_multi_file_move_failure_cleans_both_uploads(client):
    pdf = upload(client)
    photo = upload(client, b"photo", "photo.jpg", "image/jpeg")
    original_move = client.app.state.storage.move
    calls = 0

    def fail_second(source, target):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("failed second file")
        original_move(source, target)

    with patch.object(client.app.state.storage, "move", side_effect=fail_second):
        response = client.post(
            "/api/recipes", json=recipe(source_type="pdf", pdf_upload_id=pdf, photo_upload_id=photo)
        )
    assert response.status_code == 500
    assert client.get("/api/recipes").json() == []
    assert_no_upload_files(client)
    assert list((client.app.state.storage.root / "photos").iterdir()) == []


def test_cleanup_skips_locked_upload_being_attached(client):
    upload_id = upload(client)
    with client.app.state.pool.connection() as connection:
        connection.execute(
            "UPDATE upload SET created_at = now() - interval '25 hours' WHERE id = %s", (upload_id,)
        )
    with client.app.state.pool.connection() as connection:
        path = connection.execute(
            "SELECT path FROM upload WHERE id = %s FOR UPDATE", (upload_id,)
        ).fetchone()[0]
        client.app.state.storage.cleanup_tmp(client.app.state.pool)
        assert client.app.state.storage.path(path).is_file()
    client.app.state.storage.cleanup_tmp(client.app.state.pool)
    assert not client.app.state.storage.path(path).exists()
