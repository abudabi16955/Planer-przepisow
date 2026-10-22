import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(clean_database, tmp_path):
    with TestClient(create_app(Settings(database_url=clean_database, data_dir=tmp_path))) as client:
        yield client


def test_checks_persist_idempotently_and_are_isolated_by_week_and_key(client):
    assert client.get("/api/shopping-checks?week=2026-12-28").json() == []
    payload = {"week_start": "2026-12-28", "item_key": "product|szt.", "checked": True}
    for _ in range(2):
        response = client.put("/api/shopping-checks", json=payload)
        assert response.status_code == 200
        assert response.json() == payload
    other = payload | {"week_start": "2027-01-04"}
    assert client.put("/api/shopping-checks", json=other).status_code == 200
    taste = payload | {"item_key": "product|do-smaku"}
    assert client.put("/api/shopping-checks", json=taste).status_code == 200
    payload["checked"] = False
    assert client.put("/api/shopping-checks", json=payload).json() == payload
    assert client.get("/api/shopping-checks?week=2026-12-28").json() == [taste, payload]
    assert client.get("/api/shopping-checks?week=2027-01-04").json() == [other]
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM shopping_check").fetchone() == (3,)


@pytest.mark.parametrize(
    "week", ["2026-12-29", "2027-01-03", "2026-02-30", "20261228", "2026-12-28T00:00:00Z", "bad"]
)
def test_monday_validation_for_read_and_write(client, week):
    assert client.get("/api/shopping-checks", params={"week": week}).status_code == 422
    assert (
        client.put(
            "/api/shopping-checks", json={"week_start": week, "item_key": "p|g", "checked": True}
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"week_start": None},
        {"week_start": 0},
        {"item_key": ""},
        {"item_key": "  "},
        {"item_key": None},
        {"item_key": 1},
        {"checked": "true"},
        {"checked": 1},
        {"checked": None},
        {"extra": True},
    ],
)
def test_invalid_payload_does_not_write(client, changes):
    payload = {"week_start": "2026-12-28", "item_key": "p|g", "checked": True} | changes
    assert client.put("/api/shopping-checks", json=payload).status_code == 422
    assert client.get("/api/shopping-checks?week=2026-12-28").json() == []


def test_required_fields(client):
    assert client.get("/api/shopping-checks").status_code == 422
    assert client.put("/api/shopping-checks", json={}).status_code == 422
