from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.importers.base import ImportError

router = APIRouter(prefix="/api/imports", tags=["imports"])


class ImportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: Annotated[str, StringConstraints(strict=True, min_length=1, max_length=4096)]


@router.post("", status_code=202)
def create_import(payload: ImportInput, request: Request):
    try:
        return request.app.state.import_jobs.enqueue(payload.url)
    except ImportError as error:
        raise HTTPException(422, detail={"code": error.code}) from error


@router.get("/{job_id}")
def read_import(job_id: UUID, request: Request):
    return request.app.state.import_jobs.read(job_id)
