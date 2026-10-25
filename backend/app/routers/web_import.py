from typing import Annotated

from fastapi import APIRouter, HTTPException, Request
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.importers.web.draft import create_draft
from app.importers.web.fetch import WebImportError, fetch_resource, log_failure, technical_reason

router = APIRouter(prefix="/api", tags=["web-import"])


class WebImportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=4096)]


@router.post("/web-import")
def web_import(payload: WebImportInput, request: Request):
    settings = request.app.state.settings
    if not settings.web_import_enabled:
        log_failure(WebImportError("fetch_failed", "disabled"), payload.url)
        raise HTTPException(503, detail={"code": "fetch_failed"})
    try:
        page = fetch_resource(
            payload.url, settings.web_import_timeout_s, settings.web_import_max_html_mb * 1024**2
        )
        with (
            request.app.state.pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            products = cursor.execute(
                "SELECT id, name, units FROM product ORDER BY lower(name), id"
            ).fetchall()
        return create_draft(page["html"], page["source_url"], products)
    except WebImportError as error:
        log_failure(error, payload.url)
        status = 413 if error.code == "too_large" else 504 if error.code == "timeout" else 422
        raise HTTPException(status, detail={"code": error.code}) from error
    except (RecursionError, ValueError, TypeError) as error:
        log_failure(WebImportError("no_recipe", technical_reason(error)), payload.url)
        raise HTTPException(422, detail={"code": "no_recipe"}) from error
