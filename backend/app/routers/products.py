from fastapi import APIRouter, HTTPException, Request
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row

from app.models import Product, ProductCreate

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
