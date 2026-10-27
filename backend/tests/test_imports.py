import os
import sys
from unittest.mock import patch
from urllib.request import Request
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.importers.base import ImportError, Limits, platform_for_url
from app.importers.jobs import ImportJobs
from app.importers.redirect import AllowedRedirects
from app.importers.ytdlp import YtDlpImporter
from app.main import create_app

URL = "https://www.instagram.com/reel/public-example/"


@pytest.fixture
def client(clean_database, tmp_path):
    settings = Settings(
        database_url=clean_database, data_dir=tmp_path / "data", import_backend="fake"
    )
    with TestClient(create_app(settings), raise_server_exceptions=False) as client:
        yield client


def finish(client, job_id):
    client.app.state.import_jobs.executor.submit(lambda: None).result(timeout=5)
    response = client.get(f"/api/imports/{job_id}")
    assert response.status_code == 200
    return response.json()


def imported(client):
    response = client.post("/api/imports", json={"url": URL})
    assert response.status_code == 202
    return finish(client, response.json()["id"])


def payload(job):
    return {
        "title": "Przepis",
        "servings": 2,
        "category": "obiad",
        "source_type": "link",
        "import_job_id": job["id"],
    }


@pytest.mark.parametrize(
    "url",
    [
        "http://instagram.com/reel/x",
        "https://instagram.com.evil.test/x",
        "https://evil.test/?url=https://instagram.com",
        "https://instagram.com@127.0.0.1/x",
        "https://user@instagram.com/reel/x",
        "https://127.0.0.1/x",
        "https://localhost/x",
        "file:///etc/passwd",
        "https://instagram.com:444/x",
        "https://instagram.com:bad/x",
        "https://instagram.com\\@evil.test/x",
        "https://instagram.com\n.evil.test/x",
        "https://[::1]/x",
        "https://www.instagram.com./x",
        "//instagram.com/x",
        "https://[broken",
    ],
)
def test_rejects_unsafe_urls_without_queueing(client, url):
    response = client.post("/api/imports", json={"url": url})
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "unsupported_url"
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM import_job").fetchone() == (0,)


@pytest.mark.parametrize(
    "host,platform",
    [
        ("instagram.com", "instagram"),
        ("www.instagram.com", "instagram"),
        ("facebook.com", "facebook"),
        ("www.facebook.com", "facebook"),
        ("m.facebook.com", "facebook"),
        ("fb.watch", "facebook"),
    ],
)
def test_allowed_hosts(host, platform):
    assert platform_for_url(f"https://{host}/public") == platform


def test_redirects_cannot_escape_allowlist():
    redirect = AllowedRedirects()
    request = Request("https://fb.watch/example")
    with pytest.raises(ImportError, match="unsupported_url"):
        redirect.redirect_request(request, None, 302, "Found", {}, "http://127.0.0.1/private")
    result = redirect.redirect_request(
        request, None, 302, "Found", {}, "https://www.facebook.com/reel/123"
    )
    assert result.full_url == "https://www.facebook.com/reel/123"


def test_fake_job_attaches_video_thumbnail_and_plain_description(client):
    job = imported(client)
    assert job["status"] == "done"
    assert job["platform"] == "instagram"
    storage = client.app.state.storage
    for field in ("video", "thumbnail"):
        assert storage.path(job[field]["path"]).is_file()
    text = "<script>Do not execute me</script> $(touch /tmp/not-a-command)"
    with client.app.state.pool.connection() as connection:
        connection.execute(
            "UPDATE import_job SET description = %s WHERE id = %s", (text, job["id"])
        )
    response = client.post("/api/recipes", json=payload(job))
    assert response.status_code == 201, response.text
    recipe = response.json()
    assert recipe["source_description"] == text
    assert recipe["source_url"] == URL
    assert recipe["source_platform"] == "instagram"
    assert recipe["video"]["path"].startswith("videos/")
    assert recipe["photo"]["path"].startswith("thumbs/")
    for field in ("video", "photo"):
        assert client.get("/files/" + recipe[field]["path"]).status_code == 200
    assert list((storage.root / "tmp").iterdir()) == []
    assert client.post("/api/recipes", json=payload(job)).status_code == 422
    assert client.delete("/api/recipes/" + recipe["id"]).status_code == 204
    assert not storage.path(recipe["video"]["path"]).exists()
    assert not storage.path(recipe["photo"]["path"]).exists()


@pytest.mark.parametrize(
    "code", ["private_or_missing", "too_large", "timeout", "unsupported_url", "unavailable"]
)
def test_import_failures_are_isolated_and_remove_partial_files(client, code):
    def broken(url, workdir, limits):
        (workdir / "partial.mp4").write_bytes(b"partial")
        raise ImportError(code)

    with patch.object(client.app.state.import_jobs.importer, "fetch", side_effect=broken):
        job = imported(client)
    assert job["status"] == "failed"
    assert job["error_code"] == code
    assert list((client.app.state.storage.root / "tmp").iterdir()) == []
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/products").status_code == 200
    assert imported(client)["status"] == "done"


def test_unexpected_plugin_crash_is_unavailable(client):
    with patch.object(
        client.app.state.import_jobs.importer, "fetch", side_effect=RuntimeError("crash")
    ):
        job = imported(client)
    assert job["error_code"] == "unavailable"
    assert client.get("/api/health").status_code == 200


def test_recipe_failure_cleans_import_files_and_record(client):
    job = imported(client)
    storage = client.app.state.storage
    original = storage.move
    calls = 0

    def fail_second(source, target):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise OSError("disk full")
        return original(source, target)

    with patch.object(storage, "move", side_effect=fail_second):
        assert client.post("/api/recipes", json=payload(job)).status_code == 500
    assert client.get("/api/recipes").json() == []
    for directory in ("tmp", "videos", "thumbs"):
        assert list((storage.root / directory).iterdir()) == []
    failed = client.get("/api/imports/" + job["id"]).json()
    assert failed["video"] is None and failed["thumbnail"] is None
    assert failed["status"] == "failed"


def test_restart_fails_running_jobs_resumes_queued_jobs_and_is_single_worker(client):
    jobs = client.app.state.import_jobs
    assert jobs.executor._max_workers == 1
    running, queued = uuid4(), uuid4()
    jobs.workdir(running).mkdir()
    (jobs.workdir(running) / "partial.mp4").write_bytes(b"partial")
    with jobs.pool.connection() as connection:
        for job_id, status in ((running, "running"), (queued, "queued")):
            connection.execute(
                "INSERT INTO import_job(id,url,platform,status) VALUES (%s,%s,%s,%s)",
                (job_id, URL, "instagram", status),
            )
    restarted = ImportJobs(jobs.pool, jobs.storage, client.app.state.settings)
    try:
        restarted.executor.submit(lambda: None).result(timeout=5)
        assert restarted.read(running)["status"] == "failed"
        assert restarted.read(running)["error_code"] == "unavailable"
        assert not jobs.workdir(running).exists()
        assert restarted.read(queued)["status"] == "done"
    finally:
        restarted.close()


def test_cleanup_after_24_hours_preserves_referenced_or_locked_files(client):
    job = imported(client)
    storage = client.app.state.storage
    jobs = client.app.state.import_jobs
    for field in ("video", "thumbnail"):
        os.utime(storage.path(job[field]["path"]), (1, 1))
    storage.cleanup_tmp(jobs.pool)
    assert storage.path(job["video"]["path"]).exists()
    with jobs.pool.connection() as connection:
        connection.execute(
            "UPDATE import_job SET created_at = now() - interval '25 hours' WHERE id = %s",
            (job["id"],),
        )
    with jobs.pool.connection() as connection:
        connection.execute("SELECT id FROM import_job WHERE id = %s FOR UPDATE", (job["id"],))
        jobs.cleanup()
        assert storage.path(job["video"]["path"]).exists()
    jobs.cleanup()
    assert client.get("/api/imports/" + job["id"]).status_code == 404
    assert not storage.path(job["video"]["path"]).exists()
    assert not storage.path(job["thumbnail"]["path"]).exists()
    saved = imported(client)
    recipe = client.post("/api/recipes", json=payload(saved)).json()
    with jobs.pool.connection() as connection:
        connection.execute(
            "UPDATE import_job SET created_at = now() - interval '25 hours' WHERE id = %s",
            (saved["id"],),
        )
    jobs.cleanup()
    assert storage.path(recipe["video"]["path"]).exists()
    assert storage.path(recipe["photo"]["path"]).exists()


def test_disabled_and_missing_dependency_do_not_break_application(clean_database, tmp_path):
    for backend in ("disabled", "ytdlp"):
        with (
            patch("app.importers.registry.find_spec", return_value=None),
            TestClient(
                create_app(
                    Settings(database_url=clean_database, data_dir=tmp_path, import_backend=backend)
                )
            ) as client,
        ):
            assert client.get("/api/config").json() == {
                "import_enabled": False,
                "web_import_enabled": True,
                "max_video_mb": 300,
            }
            assert client.post("/api/imports", json={"url": URL}).status_code == 503
            assert client.get("/api/health").status_code == 200


def test_invalid_inputs_and_missing_jobs(client):
    for body in ({}, {"url": None}, {"url": 3}, {"url": URL, "command": "bad"}):
        assert client.post("/api/imports", json=body).status_code == 422
    assert client.get("/api/imports/bad-id").status_code == 422
    assert client.get("/api/imports/" + str(uuid4())).status_code == 404


@pytest.fixture
def script(tmp_path):
    file = tmp_path / "stub.py"
    file.write_text("""
import json, pathlib, sys, time
args = sys.argv
mode = pathlib.Path(__file__).with_suffix('.mode').read_text()
output = args[args.index('--output') + 1]
video = pathlib.Path(output.replace('%(ext)s', 'mp4'))
video.write_bytes(b'fake video')
if mode == 'timeout': time.sleep(10)
if mode.startswith('error:'):
    print(mode.split(':',1)[1], file=sys.stderr)
    sys.exit(1)
metadata = {'title': 'Tytuł', 'description': '<script>literal text</script>', 'height': 720, 'width': 1280}
if mode == 'private': metadata['availability'] = 'private'
if mode == 'height':
    metadata['height'] = 2160
    metadata.pop('width', None)
if mode == 'large': video.write_bytes(b'x' * 1001)
if mode == 'missing': video.unlink()
if mode == 'vertical_720':
    metadata['width'] = 720
    metadata['height'] = 1280
if mode == 'vertical_1080':
    metadata['width'] = 1080
    metadata['height'] = 1920
if mode == 'vertical_oversized':
    metadata['width'] = 1152
    metadata['height'] = 2048
video.with_suffix('.info.json').write_text(json.dumps(metadata))
video.with_suffix('.jpg').write_bytes(b'thumbnail')
""")
    return file


def fetch_stub(script, mode, timeout=2):
    script.with_suffix(".mode").write_text(mode)
    workdir = script.parent / "work"
    workdir.mkdir(exist_ok=True)
    importer = YtDlpImporter([sys.executable, str(script)])
    return importer.fetch(URL, workdir, Limits(timeout, 1000, 1000))


def test_subprocess_success_flags_and_plain_text(script):
    result = fetch_stub(script, "success")
    assert result.video_path.suffix == ".mp4"
    assert result.thumbnail_path.suffix == ".jpg"
    assert result.description == "<script>literal text</script>"
    assert result.size_bytes == len(b"fake video")
    # Inspect a real subprocess invocation without allowing network access.
    original = __import__("subprocess").Popen
    with patch("app.importers.ytdlp.subprocess.Popen", wraps=original) as popen:
        fetch_stub(script, "success")
    args = popen.call_args.args[0]
    for flag in (
        "--ignore-config",
        "--no-cookies",
        "--no-cookies-from-browser",
        "--max-filesize",
        "--write-thumbnail",
    ):
        assert flag in args
    assert "--username" not in args and "--password" not in args
    assert "--format-sort" in args
    sort_spec = args[args.index("--format-sort") + 1]
    assert "res:1080" in sort_spec
    assert "vcodec:h264" in sort_spec
    assert "ext:mp4:m4a" in sort_spec
    assert "--format" in args
    format_spec = args[args.index("--format") + 1]
    assert "height<=1080" in format_spec
    assert "--remux-video" in args
    assert args[args.index("--remux-video") + 1] == "mp4"
    assert popen.call_args.kwargs["start_new_session"] is True
    assert YtDlpImporter().command == [sys.executable, "-m", "yt_dlp"]


@pytest.mark.parametrize(
    "mode,code",
    [
        ("timeout", "timeout"),
        ("error:private video", "private_or_missing"),
        ("error:Unsupported URL", "unsupported_url"),
        ("error:larger than max-filesize", "too_large"),
        ("error:connection timed out", "timeout"),
        ("error:No module named yt_dlp", "unavailable"),
        ("error:Requested format is not available", "unavailable"),
        ("private", "private_or_missing"),
        ("height", "private_or_missing"),
        ("large", "too_large"),
        ("missing", "private_or_missing"),
        ("vertical_oversized", "private_or_missing"),
    ],
)
def test_subprocess_errors(script, mode, code):
    with pytest.raises(ImportError) as error:
        fetch_stub(script, mode, timeout=0.1 if mode == "timeout" else 2)
    assert error.value.code == code


@pytest.mark.parametrize("mode", ["vertical_720", "vertical_1080"])
def test_vertical_video_accepted(script, mode):
    result = fetch_stub(script, mode)
    assert result.video_path.suffix == ".mp4"
    assert result.size_bytes == len(b"fake video")


def test_ytdlp_format_selection_preferences():
    import yt_dlp

    from app.importers.ytdlp import DEFAULT_FORMAT_SELECTOR

    f_av01 = {
        "format_id": "720p_av01",
        "vcodec": "av01.0.05M.08",
        "acodec": "none",
        "width": 720,
        "height": 1280,
        "ext": "mp4",
        "url": "https://example.com/av01.mp4",
    }
    f_audio = {
        "format_id": "audio",
        "vcodec": "none",
        "acodec": "mp4a.40.5",
        "width": None,
        "height": None,
        "ext": "m4a",
        "url": "https://example.com/audio.m4a",
    }
    f_hd_unknown = {
        "format_id": "hd",
        "vcodec": "unknown",
        "acodec": "unknown",
        "width": None,
        "height": None,
        "ext": "mp4",
        "url": "https://example.com/hd.mp4",
    }
    f_h264 = {
        "format_id": "720p_h264",
        "vcodec": "avc1.64001f",
        "acodec": "none",
        "width": 720,
        "height": 1280,
        "ext": "mp4",
        "url": "https://example.com/h264.mp4",
    }

    ydl = yt_dlp.YoutubeDL({"format_sort": ["res:1080", "vcodec:h264", "ext:mp4:m4a"]})
    selector = ydl.build_format_selector(DEFAULT_FORMAT_SELECTOR)

    # 1. fake formats: av01 720x1280 + progresywny hd z unknown -> wybrany hd
    case1 = [dict(f) for f in (f_av01, f_audio, f_hd_unknown)]
    assert [f["format_id"] for f in ydl._select_formats(case1, selector)] == ["hd"]

    # 2. tylko av01 -> av01
    case2 = [dict(f) for f in (f_av01, f_audio)]
    assert [f["format_id"] for f in ydl._select_formats(case2, selector)] == ["720p_av01+audio"]

    # 3. h264 720x1280 znany -> h264 (nawet gdy jest hd z unknown i av01)
    case3 = [dict(f) for f in (f_h264, f_audio, f_av01, f_hd_unknown)]
    assert [f["format_id"] for f in ydl._select_formats(case3, selector)] == ["720p_h264+audio"]


def test_ytdlp_format_selection_picks_lower_variant_when_no_h264():
    import yt_dlp

    from app.importers.ytdlp import DEFAULT_FORMAT_SELECTOR

    formats = [
        {
            "format_id": "1152x2048",
            "vcodec": "av01.0.08M.08",
            "acodec": "none",
            "ext": "mp4",
            "width": 1152,
            "height": 2048,
            "url": "https://example.com/2k.mp4",
        },
        {
            "format_id": "720x1280",
            "vcodec": "av01.0.05M.08",
            "acodec": "none",
            "ext": "mp4",
            "width": 720,
            "height": 1280,
            "url": "https://example.com/720.mp4",
        },
        {
            "format_id": "audio",
            "vcodec": "none",
            "acodec": "mp4a.40.5",
            "width": None,
            "height": None,
            "ext": "m4a",
            "url": "https://example.com/audio.m4a",
        },
    ]
    ydl = yt_dlp.YoutubeDL({"format_sort": ["res:1080", "vcodec:h264", "ext:mp4:m4a"]})
    selector = ydl.build_format_selector(DEFAULT_FORMAT_SELECTOR)
    assert [f["format_id"] for f in ydl._select_formats(formats, selector)] == ["720x1280+audio"]


def test_subprocess_error_logs_warning(script, caplog):
    import logging

    with caplog.at_level(logging.WARNING):
        with pytest.raises(ImportError) as exc_info:
            fetch_stub(script, "error:Requested format is not available")
        assert exc_info.value.code == "unavailable"
    assert "yt-dlp import failed (unavailable)" in caplog.text
    assert "Requested format is not available" in caplog.text


def test_broken_dependency_disables_import(clean_database, tmp_path):
    with (
        patch(
            "app.importers.registry.import_module", side_effect=RuntimeError("broken dependency")
        ),
        TestClient(
            create_app(
                Settings(database_url=clean_database, data_dir=tmp_path, import_backend="ytdlp")
            )
        ) as client,
    ):
        assert client.get("/api/config").json() == {
            "import_enabled": False,
            "max_video_mb": 300,
            "web_import_enabled": True,
        }
        assert client.get("/api/products").status_code == 200


def test_short_link_resolution_uses_subprocess_and_revalidates(script):
    from subprocess import CompletedProcess

    script.with_suffix(".mode").write_text("success")
    workdir = script.parent / "short"
    workdir.mkdir()
    importer = YtDlpImporter([sys.executable, str(script)])
    with patch(
        "app.importers.ytdlp.subprocess.run",
        return_value=CompletedProcess([], 0, b'"https://www.facebook.com/reel/123"'),
    ) as resolver:
        result = importer.fetch("https://fb.watch/example", workdir, Limits(2, 1000, 1000))
    assert result.platform == "facebook"
    assert resolver.call_args.kwargs["timeout"] == 2
    with (
        patch(
            "app.importers.ytdlp.subprocess.run",
            return_value=CompletedProcess([], 0, b'"http://127.0.0.1/private"'),
        ),
        pytest.raises(ImportError, match="unsupported_url"),
    ):
        importer.fetch("https://fb.watch/example", workdir, Limits(2, 1000, 1000))


def test_real_subprocess_timeout_is_cleaned_by_job_runner(client, script):
    script.with_suffix(".mode").write_text("timeout")
    jobs = client.app.state.import_jobs
    jobs.importer = YtDlpImporter([sys.executable, str(script)])
    jobs.limits = Limits(0.1, 1000, 1000)
    job = imported(client)
    assert job["status"] == "failed"
    assert job["error_code"] == "timeout"
    assert list((jobs.storage.root / "tmp").iterdir()) == []


def test_user_photo_overrides_import_thumbnail_without_orphans(client):
    job = imported(client)
    response = client.post("/api/uploads", files={"file": ("photo.jpg", b"photo", "image/jpeg")})
    assert response.status_code == 201
    saved = client.post(
        "/api/recipes", json=payload(job) | {"photo_upload_id": response.json()["upload_id"]}
    )
    assert saved.status_code == 201
    photo = saved.json()["photo"]
    assert photo["path"].startswith("photos/")
    assert client.get("/files/" + photo["path"]).content == b"photo"
    assert list((client.app.state.storage.root / "tmp").iterdir()) == []
    assert list((client.app.state.storage.root / "thumbs").iterdir()) == []


def test_only_one_import_runs_at_a_time(client):
    from threading import Event

    jobs = client.app.state.import_jobs
    entered, release = Event(), Event()
    original = jobs.importer.fetch
    calls = 0

    def slow(url, workdir, limits):
        nonlocal calls
        calls += 1
        if calls == 1:
            entered.set()
            assert release.wait(timeout=5)
        return original(url, workdir, limits)

    with patch.object(jobs.importer, "fetch", side_effect=slow):
        try:
            first = client.post("/api/imports", json={"url": URL}).json()
            assert entered.wait(timeout=5)
            second = client.post("/api/imports", json={"url": URL}).json()
            assert second["status"] == "queued"
            assert calls == 1
        finally:
            release.set()
        assert finish(client, first["id"])["status"] == "done"
        assert finish(client, second["id"])["status"] == "done"
    assert calls == 2


def test_cleanup_cannot_remove_retired_thumbnail_before_rollback(client):
    from app.storage import FileChanges

    job = imported(client)
    storage = client.app.state.storage
    path = job["thumbnail"]["path"]
    os.utime(storage.path(path), (1, 1))
    changes = FileChanges(storage)
    changes.retire(path)
    storage.cleanup_tmp(client.app.state.pool)
    changes.rollback()
    assert storage.path(path).exists()
