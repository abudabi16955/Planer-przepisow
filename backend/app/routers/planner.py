import math
import re
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from psycopg.errors import ForeignKeyViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, BeforeValidator, ConfigDict, field_validator

from app.models import NutritionValue

router = APIRouter(prefix="/api", tags=["planner"])


def calendar_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise ValueError("Wymagana data YYYY-MM-DD.")
    return date.fromisoformat(value)


CalendarDate = Annotated[date, BeforeValidator(calendar_date)]
Slot = Literal["0", "1", "2"]


class PlanInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    recipe_id: UUID


class PlanEntry(BaseModel):
    date: date
    slot: Literal[0, 1, 2]
    recipe_id: UUID


class Goal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kcal: NutritionValue
    protein: NutritionValue
    carbs: NutritionValue
    fat: NutritionValue

    @field_validator("kcal", "protein", "carbs", "fat", mode="before")
    @classmethod
    def reject_nonfinite(cls, value):
        # Keep invalid non-finite input JSON-safe in FastAPI's 422 response.
        # Strict numeric validation rejects the resulting string.
        return str(value) if isinstance(value, float) and not math.isfinite(value) else value


@router.get("/plan", response_model=list[PlanEntry])
def read_week(week: CalendarDate, request: Request):
    if week.weekday() != 0:
        raise HTTPException(422, "Wybierz poniedziałek.")
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "SELECT date, slot, recipe_id FROM plan_entry "
            "WHERE date BETWEEN %s AND %s::date + 6 ORDER BY date, slot",
            (week, week),
        ).fetchall()


@router.put("/plan/{day}/{slot}", response_model=PlanEntry)
def write_slot(day: CalendarDate, slot: Slot, payload: PlanInput, request: Request):
    try:
        with (
            request.app.state.pool.connection() as connection,
            connection.cursor(row_factory=dict_row) as cursor,
        ):
            return cursor.execute(
                "INSERT INTO plan_entry (date, slot, recipe_id) VALUES (%s, %s, %s) "
                "ON CONFLICT (date, slot) DO UPDATE SET recipe_id = EXCLUDED.recipe_id "
                "RETURNING date, slot, recipe_id",
                (day, int(slot), payload.recipe_id),
            ).fetchone()
    except ForeignKeyViolation as error:
        raise HTTPException(404, "Przepis nie istnieje.") from error


@router.delete("/plan/{day}/{slot}", status_code=204)
def clear_slot(day: CalendarDate, slot: Slot, request: Request):
    with request.app.state.pool.connection() as connection:
        connection.execute("DELETE FROM plan_entry WHERE date = %s AND slot = %s", (day, int(slot)))


@router.get("/goal", response_model=Goal)
def read_goal(request: Request):
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "SELECT kcal, protein, carbs, fat FROM daily_goal WHERE id = 1"
        ).fetchone()


@router.put("/goal", response_model=Goal)
def write_goal(goal: Goal, request: Request):
    with (
        request.app.state.pool.connection() as connection,
        connection.cursor(row_factory=dict_row) as cursor,
    ):
        return cursor.execute(
            "INSERT INTO daily_goal (id, kcal, protein, carbs, fat) VALUES (1, %s, %s, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET kcal = EXCLUDED.kcal, protein = EXCLUDED.protein, "
            "carbs = EXCLUDED.carbs, fat = EXCLUDED.fat RETURNING kcal, protein, carbs, fat",
            (goal.kcal, goal.protein, goal.carbs, goal.fat),
        ).fetchone()
