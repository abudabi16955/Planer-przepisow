import base64
import socket
import subprocess
from email.message import Message
from pathlib import Path
from unittest.mock import Mock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.importers.web.draft import create_draft
from app.importers.web.fetch import (
    PinnedConnection,
    WebImportError,
    download,
    fetch_resource,
    parse_url,
    public_address,
    resolve_public,
)
from app.importers.web.ingredients import match_product, parse_ingredient
from app.importers.web.schema import extract
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures/web"
URL = "https://recipes.example/test"


def fixture(name):
    return (FIXTURES / name).read_text()


@pytest.mark.parametrize(
    "raw,qty,unit,name",
    [
        ("2 jajka", 2, "szt.", "jajka"),
        ("0,5 kg mąki", 0.5, "kg", "mąki"),
        ("1.5 l mleka", 1.5, "l", "mleka"),
        ("1/3 szklanki cukru", 1 / 3, "szklanka", "cukru"),
        ("1 / 3 szklanki cukru", 1 / 3, "szklanka", "cukru"),
        ("½ szklanki mleka", 0.5, "szklanka", "mleka"),
        ("1½ szklanki mleka", 1.5, "szklanka", "mleka"),
        ("pół łyżki oliwy", 0.5, "łyżka", "oliwy"),
        ("ćwierć łyżeczki soli", 0.25, "łyżeczka", "soli"),
        ("2-3 łyżki oleju", 3, "łyżka", "oleju"),
        ("2–3 sztuki jajek", 3, "szt.", "jajek"),
        ("10 dag mąki", 100, "g", "mąki"),
        ("20 dkg cukru", 200, "g", "cukru"),
        ("100 gram mąki", 100, "g", "mąki"),
        ("100 gramów mąki", 100, "g", "mąki"),
        ("2 szt. jajek", 2, "szt.", "jajek"),
        ("1 szt cebuli", 1, "szt.", "cebuli"),
        ("3 ząbki czosnku", 3, "szt.", "czosnku"),
        ("2 łyż. oleju", 2, "łyżka", "oleju"),
        ("1 szkl. wody", 1, "szklanka", "wody"),
        ("2 płaskie łyżki oliwy", 2, "łyżka", "oliwy"),
        ("po pół płaskiej łyżeczki soli", 0.5, "łyżeczka", "soli"),
        ("plastry schabu 7 sztuk - 700 g", 7, "szt.", "plastry schabu"),
        ("sól i pieprz do smaku", None, "do smaku", "sól i pieprz"),
        ("1 szczypta soli", 1, "szczypta", "soli"),
        ("250 ml mleka", 250, "ml", "mleka"),
    ],
)
def test_polish_quantities(raw, qty, unit, name):
    parsed, _ = parse_ingredient(raw)
    assert parsed["qty"] == pytest.approx(qty) if qty is not None else parsed["qty"] is None
    assert parsed["unit"] == unit
    assert parsed["name"] == name


def test_quantity_notes_and_malformed_fraction():
    assert parse_ingredient("2-3 jajka")[1]
    assert parse_ingredient("10 dag mąki")[1]
    assert parse_ingredient("1/0 szklanki cukru")[0]["qty"] is None
    assert parse_ingredient("cukier")[0]["qty"] is None


def test_product_matching_is_deterministic_and_checks_units():
    products = [
        {"id": "milk", "name": "Mleko 2%", "units": ["ml", "l"]},
        {"id": "flour", "name": "Mąka", "units": ["g", "kg"]},
        {"id": "egg", "name": "Jajka", "units": ["szt."]},
    ]
    item = match_product(parse_ingredient("100 g MĄKA")[0], products)
    assert item["match"] == "exact" and item["product_id"] == "flour" and item["unit_ok"]
    item = match_product(parse_ingredient("pół szklanki mleka")[0], products)
    assert item["match"] == "fuzzy" and item["product_id"] == "milk" and not item["unit_ok"]
    assert match_product(parse_ingredient("2 jajek")[0], products)["product_id"] == "egg"
    assert match_product(parse_ingredient("1 g szafranu")[0], products)["match"] == "none"


def test_jsonld_fields_and_plain_text():
    draft = create_draft(fixture("recipe.html"), URL, [])
    assert draft["title"] == "Zupa testowa"
    assert draft["time_min"] == 120 and draft["servings"] == 4 and draft["category"] == "obiad"
    assert draft["steps"] == ["Wymieszaj.", "Gotuj."]
    assert draft["photo_url"] == "https://recipes.example/photo.png"
    assert draft["kcal"] == 330 and draft["protein"] == 12.5
    assert draft["source_host"] == "recipes.example"


def test_graph_yield_and_nutrition_mass_basis():
    draft = create_draft(fixture("graph.html"), URL, [])
    assert draft["time_min"] == 45 and draft["servings"] is None
    assert draft["category"] == "sniadanie" and draft["kcal"] is None
    assert draft["notes"]
    assert draft["steps"] == ["Krok pierwszy.", "Krok drugi."]


def test_microdata_no_guessing_or_script_execution():
    draft = create_draft(fixture("microdata.html"), URL, [])
    assert draft["servings"] == 7 and draft["category"] == "kolacja"
    assert draft["kcal"] == 220
    assert len(draft["ingredients"]) == 3
    assert draft["steps"] == ["Umyj składniki.", "Wymieszaj."]
    with pytest.raises(WebImportError, match="no_recipe"):
        extract('<h1>Przepis</h1><script>throw Error("not executed")</script>')


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/x",
        "https://user:pass@example.com",
        "https://example.com:8080",
        "https://example.com\\x",
        "https://exa\nmple.com",
    ],
)
def test_unsupported_urls(url):
    with pytest.raises(WebImportError, match="unsupported_url"):
        parse_url(url)


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.2.3.4",
        "169.254.169.254",
        "172.16.0.2",
        "192.168.0.2",
        "::1",
        "fe80::1",
        "::ffff:127.0.0.1",
        "0.0.0.0",
        "224.0.0.1",
    ],
)
def test_blocks_private_dns_addresses(address):
    record = (
        socket.AF_INET6 if ":" in address else socket.AF_INET,
        socket.SOCK_STREAM,
        6,
        "",
        (address, 443),
    )
    with (
        patch("app.importers.web.fetch.socket.getaddrinfo", return_value=[record]),
        pytest.raises(WebImportError, match="blocked_host"),
    ):
        resolve_public("recipes.example", 443)
    assert not public_address(address)


def response(body=b"html", status=200, location=None, length=None):
    value = Mock()
    value.status = status
    value.headers = Message()
    value.headers["Content-Type"] = "text/html; charset=utf-8"
    headers = {
        "Location": location,
        "Content-Length": str(length) if length else None,
        "Content-Type": "text/html; charset=utf-8",
    }
    value.getheader.side_effect = lambda key, default=None: headers.get(key) or default
    chunks = [body, b""]
    value.read.side_effect = lambda _size: chunks.pop(0)
    return value


def test_redirect_rechecks_dns_and_rejects_private_host():
    good = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))
    bad = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 80))
    with (
        patch("app.importers.web.fetch.socket.getaddrinfo", side_effect=[[good], [bad]]),
        patch("app.importers.web.fetch.PinnedConnection") as connection,
    ):
        connection.return_value.getresponse.return_value = response(
            status=302, location="http://127.0.0.1/secret"
        )
        with pytest.raises(WebImportError, match="blocked_host"):
            download(URL, 1024, 15)
        assert connection.call_count == 1


def test_size_limit_and_redirect_limit():
    with (
        patch("app.importers.web.fetch.resolve_public", return_value=()),
        patch("app.importers.web.fetch.PinnedConnection") as connection,
    ):
        connection.return_value.getresponse.return_value = response(length=9999999)
        with pytest.raises(WebImportError, match="too_large"):
            download(URL, 1024, 15)
        connection.return_value.getresponse.return_value = response(body=b"x" * 1025)
        with pytest.raises(WebImportError, match="too_large"):
            download(URL, 1024, 15)
        connection.return_value.getresponse.return_value = response(status=302, location="/loop")
        with pytest.raises(WebImportError, match="fetch_failed"):
            download(URL, 1024, 15)


def test_connection_uses_validated_address_and_original_tls_hostname():
    record = (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))
    with (
        patch("app.importers.web.fetch.socket.socket") as socket_mock,
        patch("app.importers.web.fetch.ssl.create_default_context") as context,
    ):
        connection = PinnedConnection("recipes.example", 443, record, True, 15)
        connection.connect()
        socket_mock.return_value.connect.assert_called_once_with(("8.8.8.8", 443))
        context.return_value.wrap_socket.assert_called_once_with(
            socket_mock.return_value, server_hostname="recipes.example"
        )


def test_subprocess_deadline_includes_dns_and_slow_reads():
    with (
        patch(
            "app.importers.web.fetch.subprocess.run",
            side_effect=subprocess.TimeoutExpired("worker", 0.01),
        ),
        pytest.raises(WebImportError, match="timeout"),
    ):
        fetch_resource(URL, 0.01)


@pytest.fixture
def client(clean_database, tmp_path):
    with TestClient(
        create_app(
            Settings(database_url=clean_database, data_dir=tmp_path, import_backend="disabled")
        )
    ) as client:
        yield client


def test_endpoint_returns_draft_without_writing_any_rows(client):
    with client.app.state.pool.connection() as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public'"
            )
        ]
        before = {
            table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in tables
        }
    with patch(
        "app.routers.web_import.fetch_resource",
        return_value={"html": fixture("recipe.html"), "source_url": URL},
    ):
        result = client.post("/api/web-import", json={"url": URL})
    assert result.status_code == 200, result.text
    assert result.json()["title"] == "Zupa testowa"
    with client.app.state.pool.connection() as connection:
        after = {
            table: connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
            for table in tables
        }
    assert before == after
    assert not list((client.app.state.storage.root / "tmp").iterdir())


@pytest.mark.parametrize(
    "code", ["unsupported_url", "blocked_host", "fetch_failed", "too_large", "timeout", "no_recipe"]
)
def test_endpoint_errors_do_not_break_other_features(client, code):
    with patch("app.routers.web_import.fetch_resource", side_effect=WebImportError(code)):
        result = client.post("/api/web-import", json={"url": URL})
    assert result.status_code in (422, 413, 504)
    assert result.json()["detail"]["code"] == code
    assert client.get("/api/health").status_code == 200


def test_photo_is_fetched_only_at_recipe_save_and_www_source_is_persisted(client):
    image = {"data": base64.b64encode(b"\x89PNG\r\n\x1a\ntest").decode(), "mime": "image/png"}
    payload = {
        "title": "WWW",
        "category": "obiad",
        "servings": 2,
        "source_type": "link",
        "source_platform": "www",
        "source_url": URL,
        "web_photo_url": "https://images.example/image.png",
    }
    with patch("app.importers.web.photo.fetch_resource", return_value=image) as fetch:
        response = client.post("/api/recipes", json=payload)
    assert response.status_code == 201, response.text
    assert fetch.call_args.kwargs == {"image": True}
    assert response.json()["source_platform"] == "www"
    assert client.get("/files/" + response.json()["photo"]["path"]).content.startswith(b"\x89PNG")


def test_config_disable_and_input_validation(client):
    assert client.get("/api/config").json()["web_import_enabled"] is True
    client.app.state.settings.web_import_enabled = False
    with patch("app.routers.web_import.fetch_resource") as fetch:
        assert client.post("/api/web-import", json={"url": URL}).status_code == 503
        fetch.assert_not_called()
    assert client.post("/api/web-import", json={"url": 12}).status_code == 422


def test_mixed_public_private_dns_is_rejected():
    records = [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))
        for address in ("8.8.8.8", "10.0.0.1")
    ]
    with (
        patch("app.importers.web.fetch.socket.getaddrinfo", return_value=records),
        pytest.raises(WebImportError, match="blocked_host"),
    ):
        resolve_public("recipes.example", 443)


def test_real_worker_blocks_loopback_without_network_access():
    with pytest.raises(WebImportError, match="blocked_host"):
        fetch_resource("http://127.0.0.1/private")


def test_download_has_no_cookie_header_and_decodes_html():
    with (
        patch("app.importers.web.fetch.resolve_public", return_value=()),
        patch("app.importers.web.fetch.PinnedConnection") as connection,
    ):
        connection.return_value.getresponse.return_value = response(body=b"<p>synthetic</p>")
        assert download(URL, 1024, 15)["html"] == "<p>synthetic</p>"
        headers = connection.return_value.request.call_args.kwargs["headers"]
        assert "Cookie" not in headers
        assert headers["User-Agent"].startswith("PlanerPrzepisow/")


def test_failed_recipe_save_cleans_downloaded_photo(client):
    image = {"data": base64.b64encode(b"\x89PNG\r\n\x1a\ntest").decode(), "mime": "image/png"}
    payload = {
        "title": "WWW",
        "category": "obiad",
        "servings": 2,
        "source_type": "link",
        "source_platform": "www",
        "source_url": URL,
        "web_photo_url": "https://images.example/image.png",
    }
    with (
        patch("app.importers.web.photo.fetch_resource", return_value=image),
        patch("app.importers.web.photo.save_recipe", side_effect=OSError("disk full")),
    ):
        assert client.post("/api/recipes", json=payload).status_code == 500
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM recipe").fetchone()[0] == 0
        assert connection.execute("SELECT count(*) FROM upload").fetchone()[0] == 0
    assert not list((client.app.state.storage.root / "tmp").iterdir())
