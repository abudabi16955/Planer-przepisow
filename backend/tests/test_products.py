import json
import re
from pathlib import Path
from uuid import uuid4

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


def test_edit_seed_product_preserves_units_conversions_and_metadata(client):
    product = next(row for row in client.get("/api/products").json() if row["name"] == "Czosnek")
    values = {
        "name": "Czosnek poprawiony",
        "nutrition_basis": "g",
        "kcal": 140,
        "protein": 6,
        "carbs": 30,
        "fat": 0.5,
    }
    response = client.put(f"/api/products/{product['id']}", json=values)
    assert response.status_code == 200
    updated = response.json()
    for key, value in values.items():
        assert updated[key] == value
    for key in ("id", "units", "unit_conversions", "is_custom", "created_at"):
        assert updated[key] == product[key]
    assert updated["unit_conversions"]["ząbek"] == 5
    assert updated in client.get("/api/products").json()


def test_edit_unknown_product_returns_404(client):
    assert client.put(f"/api/products/{uuid4()}", json={"name": "Nieznany"}).status_code == 404


@pytest.mark.parametrize("name", ["Czosnek", "CZOSNEK", "  czosnek  "])
def test_edit_duplicate_is_case_insensitive_and_does_not_modify_product(client, name):
    product = next(row for row in client.get("/api/products").json() if row["name"] == "Jajka")
    response = client.put(f"/api/products/{product['id']}", json={"name": name})
    assert response.status_code == 409
    assert response.json()["detail"] == "Produkt o tej nazwie już istnieje."
    assert product in client.get("/api/products").json()


def test_edit_own_name_and_case_keeps_nutrition(client):
    product = next(row for row in client.get("/api/products").json() if row["name"] == "Jajka")
    for name in ("Jajka", "JAJKA", "  jajka  "):
        response = client.put(f"/api/products/{product['id']}", json={"name": name})
        assert response.status_code == 200
        assert response.json()["name"] == name.strip()
        assert response.json()["kcal"] == product["kcal"]
        assert response.json()["nutrition_basis"] == product["nutrition_basis"]


@pytest.mark.parametrize(
    "values",
    [
        {"name": ""},
        {"name": 1},
        {"name": "Nowy", "units": []},
        {"name": "Nowy", "units": ["g", "g"]},
        {"name": "Nowy", "units": ["nieznana"]},
        {"name": "Nowy", "unit_conversions": {"łyżka": 0}},
        {"name": "Nowy", "unit_conversions": {"łyżka": -1}},
        {"name": "Nowy", "kcal": -1},
        {"name": "Nowy", "nutrition_basis": "kg"},
        {"name": "Nowy", "protein": "1"},
        {"name": "Nowy", "fat": True},
        {"name": "Nowy", "nutrition_basis": None, "kcal": 100},
    ],
)
def test_edit_validation_and_readonly_unit_fields(client, values):
    product = next(row for row in client.get("/api/products").json() if row["name"] == "Jajka")
    assert client.put(f"/api/products/{product['id']}", json=values).status_code == 422
    assert product in client.get("/api/products").json()


def test_edit_can_clear_optional_nutrition(client):
    product = client.get("/api/products").json()[0]
    response = client.put(
        f"/api/products/{product['id']}",
        json={
            "name": product["name"],
            "nutrition_basis": None,
            "kcal": None,
            "protein": None,
            "carbs": None,
            "fat": None,
        },
    )
    assert response.status_code == 200
    assert response.json()["kcal"] is None and response.json()["nutrition_basis"] is None


def test_edit_product_add_units_and_reorder(client):
    czosnek = next(row for row in client.get("/api/products").json() if row["name"] == "Czosnek")
    assert czosnek["units"] == ["ząbek", "g"]

    # Zmiana kolejności i dodanie nowej jednostki
    response = client.put(
        f"/api/products/{czosnek['id']}",
        json={"units": ["g", "łyżeczka", "ząbek"]},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["units"] == ["g", "łyżeczka", "ząbek"]
    assert updated["unit_conversions"]["ząbek"] == 5
    # metadata and unchanged fields preserved
    assert updated["name"] == "Czosnek"
    assert updated["nutrition_basis"] == "g"


def test_edit_product_remove_unused_unit_removes_conversion(client):
    mleko = next(row for row in client.get("/api/products").json() if row["name"] == "Mleko 2%")
    assert "szklanka" in mleko["units"]
    assert mleko["unit_conversions"].get("szklanka") == 250

    # Usunięcie jednostki 'szklanka', która nie jest używana w żadnym przepisie
    response = client.put(
        f"/api/products/{mleko['id']}",
        json={"units": ["ml", "l", "łyżka"]},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["units"] == ["ml", "l", "łyżka"]
    assert "szklanka" not in updated["unit_conversions"]
    assert updated["unit_conversions"]["łyżka"] == 15


def test_edit_product_remove_used_unit_returns_409(client):
    czosnek = next(row for row in client.get("/api/products").json() if row["name"] == "Czosnek")
    # Stwórz 2 przepisy używające czosnku w jednostce 'ząbek'
    for i in range(2):
        res = client.post(
            "/api/recipes",
            json={
                "title": f"Danie z czosnkiem {i}",
                "category": "obiad",
                "servings": 2,
                "ingredients": [{"product_id": czosnek["id"], "quantity": 1, "unit": "ząbek"}],
            },
        )
        assert res.status_code == 201

    # Próba usunięcia 'ząbek' z jednostek czosnku powinna zwrócić 409
    response = client.put(
        f"/api/products/{czosnek['id']}",
        json={"units": ["g"]},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == (
        "Jednostka „ząbek” jest używana w przepisach (2). Najpierw zmień je w przepisach."
    )
    # Produkt pozostał niezmieniony
    current = next(row for row in client.get("/api/products").json() if row["id"] == czosnek["id"])
    assert current["units"] == czosnek["units"]


@pytest.mark.parametrize(
    "invalid_conversions",
    [
        {"łyżka": 0},
        {"łyżka": -5},
        {"szklanka": 200},  # 'szklanka' nie ma w units
        {"g": 10},  # 'g' jest podstawą wartości odżywczych (nutrition_basis)
    ],
)
def test_edit_product_invalid_conversions_returns_422(client, invalid_conversions):
    papryka = next(
        row for row in client.get("/api/products").json() if row["name"] == "Papryka wędzona"
    )
    response = client.put(
        f"/api/products/{papryka['id']}",
        json={
            "units": ["g", "łyżeczka"],
            "unit_conversions": invalid_conversions,
        },
    )
    assert response.status_code == 422


def test_edit_product_conversions_without_basis_returns_422(client):
    product = next(row for row in client.get("/api/products").json() if row["name"] == "Sól")
    response = client.put(
        f"/api/products/{product['id']}",
        json={
            "nutrition_basis": None,
            "kcal": None,
            "protein": None,
            "carbs": None,
            "fat": None,
            "unit_conversions": {"łyżeczka": 5},
        },
    )
    assert response.status_code == 422


def test_create_product_with_conversions_and_validation(client):
    payload = {
        "name": "Kmin rzymski",
        "units": ["g", "łyżeczka", "łyżka"],
        "nutrition_basis": "g",
        "kcal": 375,
        "protein": 18,
        "carbs": 44,
        "fat": 22,
        "unit_conversions": {"łyżeczka": 3, "łyżka": 9},
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["units"] == ["g", "łyżeczka", "łyżka"]
    assert created["unit_conversions"] == {"łyżeczka": 3, "łyżka": 9}

    # Błędny przelicznik przy tworzeniu (jednostka nie w units)
    bad_payload = {**payload, "name": "Inny kmin", "unit_conversions": {"szklanka": 100}}
    assert client.post("/api/products", json=bad_payload).status_code == 422
