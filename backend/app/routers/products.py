from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import ValidationError

from app.models import Product, ProductCreate, ProductEdit

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[Product])
def list_products(request: Request):
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute("SELECT * FROM product ORDER BY lower(name), id").fetchall()


@router.post("", response_model=Product, status_code=201)
def create_product(product: ProductCreate, request: Request):
    try:
        with (
            request.app.state.pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            return cursor.execute(
                "INSERT INTO product (name, units, nutrition_basis, kcal, protein, carbs, fat, unit_conversions) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (
                    product.name,
                    product.units,
                    product.nutrition_basis,
                    product.kcal,
                    product.protein,
                    product.carbs,
                    product.fat,
                    Jsonb(product.unit_conversions),
                ),
            ).fetchone()
    except UniqueViolation as error:
        raise HTTPException(status_code=409, detail="Produkt o tej nazwie już istnieje.") from error


@router.put("/{product_id}", response_model=Product)
def update_product(product_id: UUID, product: ProductEdit, request: Request):
    try:
        with (
            request.app.state.pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            current = cursor.execute(
                "SELECT * FROM product WHERE id = %s FOR UPDATE", (product_id,)
            ).fetchone()
            if current is None:
                raise HTTPException(404, "Nie znaleziono produktu.")

            effective_units = (
                product.units
                if "units" in product.model_fields_set and product.units is not None
                else current["units"]
            )

            removed_units = [u for u in current["units"] if u not in effective_units]
            for u in removed_units:
                res = cursor.execute(
                    "SELECT count(DISTINCT recipe_id) AS count FROM recipe_ingredient WHERE product_id = %s AND unit = %s",
                    (product_id, u),
                ).fetchone()
                count = res["count"] if res else 0
                if count > 0:
                    raise HTTPException(
                        409,
                        f"Jednostka „{u}” jest używana w przepisach ({count}). Najpierw zmień je w przepisach.",
                    )

            effective_basis = (
                product.nutrition_basis
                if "nutrition_basis" in product.model_fields_set
                else current["nutrition_basis"]
            )

            if (
                "unit_conversions" in product.model_fields_set
                and product.unit_conversions is not None
            ):
                if effective_basis is None and len(product.unit_conversions) > 0:
                    raise HTTPException(
                        422, "Przeliczniki wymagają wybranej podstawy wartości odżywczych."
                    )
                for u in product.unit_conversions:
                    if u not in effective_units:
                        raise HTTPException(
                            422,
                            f"Jednostka przelicznika „{u}” musi znajdować się na liście jednostek produktu.",
                        )
                    if u == effective_basis:
                        raise HTTPException(
                            422,
                            f"Jednostka przelicznika „{u}” nie może być równa podstawie wartości odżywczych.",
                        )
                effective_conversions = product.unit_conversions
            else:
                raw_conversions = current["unit_conversions"] or {}
                effective_conversions = {
                    u: v
                    for u, v in raw_conversions.items()
                    if u in effective_units and effective_basis is not None and u != effective_basis
                }

            if effective_basis is None:
                effective_conversions = {}

            merged = {
                key: getattr(product, key) if key in product.model_fields_set else current[key]
                for key in ProductEdit.model_fields
            }
            merged["units"] = effective_units
            merged["unit_conversions"] = effective_conversions
            values = ProductEdit.model_validate(merged)

            return cursor.execute(
                "UPDATE product SET name=%s, units=%s, nutrition_basis=%s, kcal=%s, protein=%s, carbs=%s, fat=%s, unit_conversions=%s WHERE id=%s RETURNING *",
                (
                    values.name,
                    values.units,
                    values.nutrition_basis,
                    values.kcal,
                    values.protein,
                    values.carbs,
                    values.fat,
                    Jsonb(values.unit_conversions or {}),
                    product_id,
                ),
            ).fetchone()
    except HTTPException:
        raise
    except UniqueViolation as error:
        raise HTTPException(409, "Produkt o tej nazwie już istnieje.") from error
    except ValidationError as error:
        raise HTTPException(422, "Wybierz podstawę wartości odżywczych.") from error
