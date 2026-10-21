import json
import re
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.db import migrate
from app.main import create_app


@pytest.fixture
def client(clean_database, tmp_path):
    settings = Settings(database_url=clean_database, data_dir=tmp_path, import_backend="disabled")
    with TestClient(create_app(settings)) as client:
        yield client


def test_seed_exactly_matches_approved_data(client):
    response = client.get("/api/products")
    assert response.status_code == 200
    products = response.json()
    assert len(products) == 29
    # Docs are only read by this test, never by application startup/migrations.
    research = Path(__file__).resolve().parents[2] / "docs/research/wartosci-odzywcze.md"
    expected = json.loads(re.search(r"```json\s*(.*?)```", research.read_text(), re.DOTALL)[1])
    by_name = {product["name"]: product for product in products}
    assert set(by_name) == {product["name"] for product in expected}
    for source in expected:
        actual = by_name[source["name"]]
        assert actual["is_custom"] is False
        assert actual["units"] == source["units"]
        assert actual["nutrition_basis"] == source["basis"]
        assert actual["nutrition_basis"] in actual["units"]
        assert actual["unit_conversions"] == source["unit_conversions"]
        for field in ["kcal", "protein", "carbs", "fat"]:
            assert actual[field] == source[field]
            assert actual[field] >= 0
        assert set(actual["unit_conversions"]) <= set(actual["units"])
    assert by_name["Czosnek"]["unit_conversions"]["ząbek"] == 5
    assert by_name["Jajka"]["nutrition_basis"] == "szt."
    assert by_name["Mleko 2%"]["nutrition_basis"] == "ml"


def test_create_custom_product_preserves_order_and_persists(client):
    payload = {
        "name": "  Sumak  ",
        "units": ["łyżeczka", "g"],
        "nutrition_basis": "g",
        "kcal": 20,
        "protein": 1.2,
        "carbs": 0,
        "fat": 0.1,
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201
    product = response.json()
    assert product["name"] == "Sumak"
    assert product["units"] == ["łyżeczka", "g"]
    assert product["unit_conversions"] == {}
    assert product["is_custom"] is True
    assert product["protein"] == 1.2
    assert product["created_at"]
    with client.app.state.pool.connection() as connection:
        assert connection.execute("SELECT count(*) FROM product").fetchone() == (30,)
    migrate(client.app.state.pool)
    assert product in client.get("/api/products").json()


def test_product_without_optional_nutrition(client):
    response = client.post("/api/products", json={"name": "Przyprawa", "units": ["g"]})
    assert response.status_code == 201
    product = response.json()
    assert all(
        product[field] is None for field in ["nutrition_basis", "kcal", "protein", "carbs", "fat"]
    )


@pytest.mark.parametrize("name", ["SUMAK", "sumak", "  SuMaK  "])
def test_case_insensitive_duplicate_and_transaction_recovery(client, name):
    assert client.post("/api/products", json={"name": "Sumak", "units": ["g"]}).status_code == 201
    assert client.post("/api/products", json={"name": name, "units": ["g"]}).status_code == 409
    assert (
        client.post("/api/products", json={"name": "Inny produkt", "units": ["g"]}).status_code
        == 201
    )
    assert len(client.get("/api/products").json()) == 31


@pytest.mark.parametrize("name", ["czosnek", "śMIETANKA 18%"])
def test_seed_names_are_also_unique(client, name):
    assert client.post("/api/products", json={"name": name, "units": ["g"]}).status_code == 409


@pytest.mark.parametrize(
    "changes",
    [
        {"name": ""},
        {"name": "  \t\n "},
        {"name": None},
        {"name": 42},
        {"units": []},
        {"units": ["filiżanka"]},
        {"units": ["g", "g"]},
        {"units": [None]},
        {"nutrition_basis": "kg"},
        {"kcal": -1, "nutrition_basis": "g"},
        {"protein": -0.1, "nutrition_basis": "g"},
        {"carbs": -1, "nutrition_basis": "g"},
        {"fat": -1, "nutrition_basis": "g"},
        {"kcal": 1},
        {"nutrition_basis": None, "kcal": 0},
        {"nutrition_basis": "g", "kcal": "NaN"},
        {"nutrition_basis": "g", "fat": "Infinity"},
        {"nutrition_basis": "g", "protein": True},
        {"unit_conversions": {"łyżeczka": 5}},
        {"is_custom": False},
    ],
)
def test_validation_rejects_invalid_products(client, changes):
    payload = {"name": "Nowy produkt", "units": ["g"]} | changes
    assert client.post("/api/products", json=payload).status_code == 422
    assert len(client.get("/api/products").json()) == 29


@pytest.mark.parametrize(
    "basis,units", [("g", ["g", "kg"]), ("ml", ["ml", "l"]), ("szt.", ["szt."])]
)
def test_nutrition_basis_and_zero_values(client, basis, units):
    payload = {
        "name": "Nowy produkt",
        "units": units,
        "nutrition_basis": basis,
        "kcal": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
    }
    assert client.post("/api/products", json=payload).status_code == 201


def test_schema_defaults_keys_and_recipe_cascade(client):
    with client.app.state.pool.connection() as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
            )
        }
        assert {
            "product",
            "recipe",
            "recipe_ingredient",
            "plan_entry",
            "daily_goal",
            "shopping_check",
            "import_job",
            "upload",
        } <= tables
        assert connection.execute(
            "SELECT kcal, protein, carbs, fat FROM daily_goal"
        ).fetchall() == [(2000, 100, 250, 65)]
        assert connection.execute("SELECT count(*) FROM recipe").fetchone() == (0,)
        recipe_id = connection.execute(
            "INSERT INTO recipe (title, category, servings, source_type) "
            "VALUES ('Test', 'obiad', 2, 'manual') RETURNING id"
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO recipe_ingredient (recipe_id, position, product_id, quantity, unit) "
            "SELECT %s, 0, id, 1, 'szt.' FROM product WHERE name = 'Jajka'",
            (recipe_id,),
        )
        connection.execute(
            "INSERT INTO plan_entry (date, slot, recipe_id) VALUES ('2026-10-21', 1, %s)",
            (recipe_id,),
        )
        with pytest.raises(psycopg.errors.UniqueViolation), connection.transaction():
            connection.execute(
                "INSERT INTO plan_entry (date, slot, recipe_id) VALUES ('2026-10-21', 1, %s)",
                (recipe_id,),
            )
        with pytest.raises(psycopg.errors.CheckViolation), connection.transaction():
            connection.execute("INSERT INTO daily_goal VALUES (2, 2000, 100, 250, 65)")
        with pytest.raises(psycopg.errors.ForeignKeyViolation), connection.transaction():
            connection.execute("INSERT INTO plan_entry VALUES ('2026-10-21', 0, gen_random_uuid())")
        connection.execute("DELETE FROM recipe WHERE id = %s", (recipe_id,))
        assert connection.execute("SELECT count(*) FROM recipe_ingredient").fetchone() == (0,)
        assert connection.execute("SELECT count(*) FROM plan_entry").fetchone() == (0,)
