from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Unit = Literal[
    "g", "kg", "ml", "l", "szt.", "łyżeczka", "łyżka", "szklanka", "szczypta", "ząbek", "puszka"
]
NutritionBasis = Literal["g", "ml", "szt."]
NutritionValue = Annotated[float, Field(ge=0, allow_inf_nan=False, strict=True)]


class ProductCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]
    units: Annotated[list[Unit], Field(min_length=1)]
    nutrition_basis: NutritionBasis | None = None
    kcal: NutritionValue | None = None
    protein: NutritionValue | None = None
    carbs: NutritionValue | None = None
    fat: NutritionValue | None = None

    @field_validator("units")
    @classmethod
    def unique_units(cls, units):
        if len(set(units)) != len(units):
            raise ValueError("Jednostki nie mogą się powtarzać.")
        return units

    @model_validator(mode="after")
    def nutrition_requires_basis(self):
        if self.nutrition_basis is None and any(
            value is not None for value in (self.kcal, self.protein, self.carbs, self.fat)
        ):
            raise ValueError("Wybierz podstawę wartości odżywczych.")
        return self


class Product(ProductCreate):
    id: UUID
    unit_conversions: dict[str, float]
    is_custom: bool
    created_at: datetime
