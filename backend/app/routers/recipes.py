from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response

from app.importers.web.fetch import WebImportError
from app.importers.web.photo import save_with_photo
from app.models import RecipeCreate
from app.services.recipes import delete_recipe, get_recipe

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


@router.get("")
def list_recipes(request: Request):
    with request.app.state.pool.connection() as connection:
        ids = connection.execute("SELECT id FROM recipe ORDER BY created_at DESC, id").fetchall()
        return [get_recipe(connection, row[0]) for row in ids]


@router.get("/{recipe_id}")
def read_recipe(recipe_id: UUID, request: Request):
    with request.app.state.pool.connection() as connection:
        return get_recipe(connection, recipe_id)


@router.post("", status_code=201)
def add_recipe(payload: RecipeCreate, request: Request):
    try:
        return save_with_photo(
            request.app.state.pool, request.app.state.storage, request.app.state.settings, payload
        )
    except WebImportError as error:
        raise HTTPException(422, detail={"code": error.code}) from error
    except OSError as error:
        raise HTTPException(500, "Nie udało się zapisać pliku.") from error


@router.put("/{recipe_id}")
def update_recipe(recipe_id: UUID, payload: RecipeCreate, request: Request):
    try:
        return save_with_photo(
            request.app.state.pool,
            request.app.state.storage,
            request.app.state.settings,
            payload,
            recipe_id,
        )
    except WebImportError as error:
        raise HTTPException(422, detail={"code": error.code}) from error
    except OSError as error:
        raise HTTPException(500, "Nie udało się zapisać pliku.") from error


@router.delete("/{recipe_id}", status_code=204)
def remove_recipe(recipe_id: UUID, request: Request):
    try:
        delete_recipe(request.app.state.pool, request.app.state.storage, recipe_id)
    except OSError as error:
        raise HTTPException(500, "Nie udało się zapisać pliku.") from error
    return Response(status_code=204)
