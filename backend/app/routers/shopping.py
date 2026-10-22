from datetime import date
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request
from psycopg.rows import dict_row
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator

from app.routers.planner import CalendarDate

router = APIRouter(prefix="/api", tags=["shopping"])


class ShoppingCheckInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    week_start: CalendarDate
    item_key: Annotated[str, Field(strict=True, min_length=1)]
    checked: StrictBool

    @field_validator("week_start")
    @classmethod
    def monday(cls, value):
        if value.weekday() != 0:
            raise ValueError("Wybierz poniedziałek.")
        return value

    @field_validator("item_key")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Klucz nie może być pusty.")
        return value


class ShoppingCheck(BaseModel):
    week_start: date
    item_key: str
    checked: bool


@router.get("/shopping-checks", response_model=list[ShoppingCheck])
def read_checks(week: CalendarDate, request: Request):
    if week.weekday() != 0:
        raise HTTPException(422, "Wybierz poniedziałek.")
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "SELECT week_start, item_key, checked FROM shopping_check "
            "WHERE week_start = %s ORDER BY item_key",
            (week,),
        ).fetchall()


@router.put("/shopping-checks", response_model=ShoppingCheck)
def write_check(payload: ShoppingCheckInput, request: Request):
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "INSERT INTO shopping_check (week_start, item_key, checked) VALUES (%s, %s, %s) "
            "ON CONFLICT (week_start, item_key) DO UPDATE SET checked = EXCLUDED.checked "
            "RETURNING week_start, item_key, checked",
            (payload.week_start, payload.item_key, payload.checked),
        ).fetchone()
