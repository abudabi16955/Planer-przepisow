from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
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
                "INSERT INTO product (name, units, nutrition_basis, kcal, protein, carbs, fat) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
                (
                    product.name,
                    product.units,
                    product.nutrition_basis,
                    product.kcal,
                    product.protein,
                    product.carbs,
                    product.fat,
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
            # A name-only update must not erase the existing nutritional values.
            values = ProductEdit.model_validate(
                {
                    key: getattr(product, key) if key in product.model_fields_set else current[key]
                    for key in ProductEdit.model_fields
                }
            )
            return cursor.execute(
                "UPDATE product SET name=%s, nutrition_basis=%s, kcal=%s, protein=%s, carbs=%s, fat=%s WHERE id=%s RETURNING *",
                (
                    values.name,
                    values.nutrition_basis,
                    values.kcal,
                    values.protein,
                    values.carbs,
                    values.fat,
                    product_id,
                ),
            ).fetchone()
    except UniqueViolation as error:
        raise HTTPException(409, "Produkt o tej nazwie już istnieje.") from error
    except ValidationError as error:
        raise HTTPException(422, "Wybierz podstawę wartości odżywczych.") from error
