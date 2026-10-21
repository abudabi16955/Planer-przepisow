from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def client(clean_database, tmp_path):
    with TestClient(create_app(Settings(database_url=clean_database, data_dir=tmp_path))) as client:
        yield client


def create_recipe(client, title="Przepis"):
    response = client.post(
        "/api/recipes", json={"title": title, "category": "obiad", "servings": 2}
    )
    assert response.status_code == 201
    return response.json()["id"]


def put(client, day, slot, recipe_id):
    return client.put(f"/api/plan/{day}/{slot}", json={"recipe_id": recipe_id})


def test_week_bounds_sorting_and_replacement(client):
    first, second = create_recipe(client), create_recipe(client, "Drugi")
    for day, slot in [("2027-01-04", 0), ("2027-01-03", 2), ("2026-12-28", 1), ("2026-12-27", 2)]:
        assert put(client, day, slot, first).status_code == 200
    assert put(client, "2026-12-28", 0, first).status_code == 200
    expected = {"date": "2026-12-28", "slot": 1, "recipe_id": second}
    assert put(client, "2026-12-28", 1, second).json() == expected
    response = client.get("/api/plan", params={"week": "2026-12-28"})
    assert response.status_code == 200
    assert response.json() == [
        {"date": "2026-12-28", "slot": 0, "recipe_id": first},
        expected,
        {"date": "2027-01-03", "slot": 2, "recipe_id": first},
    ]
    assert client.get("/api/plan?week=2027-01-11").json() == []


@pytest.mark.parametrize(
    "week",
    ["2026-10-20", "2026-10-25", "2026-02-30", "20261019", "2026-10-19T00:00:00Z", "invalid", "0"],
)
def test_week_requires_valid_monday(client, week):
    assert client.get("/api/plan", params={"week": week}).status_code == 422


def test_week_required_and_dst_week_is_seven_calendar_days(client):
    assert client.get("/api/plan").status_code == 422
    recipe_id = create_recipe(client)
    for day in ["2026-10-19", "2026-10-25", "2026-10-26"]:
        assert put(client, day, 0, recipe_id).status_code == 200
    assert [row["date"] for row in client.get("/api/plan?week=2026-10-19").json()] == [
        "2026-10-19",
        "2026-10-25",
    ]


@pytest.mark.parametrize(
    "day,slot",
    [
        ("2026-02-30", "0"),
        ("invalid", "1"),
        ("20261019", "2"),
        ("2026-10-19", "-1"),
        ("2026-10-19", "3"),
        ("2026-10-19", "1.5"),
        ("2026-10-19", "x"),
    ],
)
def test_invalid_keys(client, day, slot):
    assert put(client, day, slot, uuid4().hex).status_code == 422
    assert client.delete(f"/api/plan/{day}/{slot}").status_code == 422


@pytest.mark.parametrize(
    "payload",
    [{}, {"recipe_id": "bad"}, {"recipe_id": None}, {"recipe_id": str(uuid4()), "other": 1}],
)
def test_invalid_payload(client, payload):
    assert client.put("/api/plan/2026-10-19/0", json=payload).status_code == 422


def test_missing_recipe_preserves_existing_slot_and_delete_is_idempotent(client):
    recipe_id = create_recipe(client)
    put(client, "2026-10-19", 0, recipe_id)
    assert put(client, "2026-10-19", 0, str(uuid4())).status_code == 404
    assert put(client, "2026-10-19", 1, str(uuid4())).status_code == 404
    assert client.get("/api/plan?week=2026-10-19").json() == [
        {"date": "2026-10-19", "slot": 0, "recipe_id": recipe_id}
    ]
    for _ in range(2):
        response = client.delete("/api/plan/2026-10-19/0")
        assert response.status_code == 204
        assert response.content == b""
    assert client.get("/api/plan?week=2026-10-19").json() == []


def test_recipe_delete_cascades_to_all_its_meals_only(client):
    first, second = create_recipe(client), create_recipe(client, "Drugi")
    for day in ["2026-10-19", "2026-10-26"]:
        put(client, day, 0, first)
        put(client, day, 1, first)
        put(client, day, 2, second)
    assert client.delete(f"/api/recipes/{first}").status_code == 204
    for day in ["2026-10-19", "2026-10-26"]:
        assert client.get(f"/api/plan?week={day}").json() == [
            {"date": day, "slot": 2, "recipe_id": second}
        ]


def test_goal_default_persistence_zero_and_singleton(client):
    assert client.get("/api/goal").json() == {"kcal": 2000, "protein": 100, "carbs": 250, "fat": 65}
    for values in [
        {"kcal": 2100.5, "protein": 125.25, "carbs": 200, "fat": 70},
        dict.fromkeys(["kcal", "protein", "carbs", "fat"], 0),
    ]:
        response = client.put("/api/goal", json=values)
        assert response.status_code == 200
        assert response.json() == values
        assert client.get("/api/goal").json() == values
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM daily_goal").fetchone() == (1,)


@pytest.mark.parametrize("field", ["kcal", "protein", "carbs", "fat"])
@pytest.mark.parametrize("value", [-1, "1", True, None])
def test_invalid_goals_do_not_change_saved_goal(client, field, value):
    original = client.get("/api/goal").json()
    assert client.put("/api/goal", json=original | {field: value}).status_code == 422
    assert client.get("/api/goal").json() == original


def test_goal_requires_all_fields_and_rejects_infinity(client):
    assert client.put("/api/goal", json={"kcal": 2000}).status_code == 422
    assert (
        client.put(
            "/api/goal",
            content='{"kcal": 1e999, "protein": 0, "carbs": 0, "fat": 0}',
            headers={"Content-Type": "application/json"},
        ).status_code
        == 422
    )
