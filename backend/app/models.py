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


class ProductEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)] | None
    ) = None
    units: Annotated[list[Unit], Field(min_length=1)] | None = None
    nutrition_basis: NutritionBasis | None = None
    kcal: NutritionValue | None = None
    protein: NutritionValue | None = None
    carbs: NutritionValue | None = None
    fat: NutritionValue | None = None
    unit_conversions: (
        dict[Unit, Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]] | None
    ) = None

    @field_validator("units")
    @classmethod
    def unique_units(cls, units):
        if units is not None and len(set(units)) != len(units):
            raise ValueError("Jednostki nie mogą się powtarzać.")
        return units

    @model_validator(mode="after")
    def nutrition_requires_basis(self):
        if self.nutrition_basis is None and any(
            value is not None for value in (self.kcal, self.protein, self.carbs, self.fat)
        ):
            raise ValueError("Wybierz podstawę wartości odżywczych.")
        return self


class ProductCreate(ProductEdit):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]
    units: Annotated[list[Unit], Field(min_length=1)]
    unit_conversions: dict[
        Unit, Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)]
    ] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_create_conversions(self):
        if self.unit_conversions:
            if self.nutrition_basis is None:
                raise ValueError("Przeliczniki wymagają wybranej podstawy wartości odżywczych.")
            for unit in self.unit_conversions:
                if unit not in self.units:
                    raise ValueError(
                        f"Jednostka przelicznika {unit} musi znajdować się na liście jednostek."
                    )
                if unit == self.nutrition_basis:
                    raise ValueError(
                        f"Jednostka przelicznika nie może być równa podstawie ({self.nutrition_basis})."
                    )
        return self


class Product(ProductCreate):
    id: UUID
    is_custom: bool
    created_at: datetime


class IngredientCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    product_id: UUID
    quantity: Annotated[float, Field(gt=0, allow_inf_nan=False, strict=True)] | None = None
    unit: Unit | Literal[""] = ""

    @model_validator(mode="after")
    def taste_or_quantity(self):
        if (self.quantity is None) != (self.unit == ""):
            raise ValueError("Dla „do smaku” ilość i jednostka muszą być puste.")
        return self


class RecipeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, strict=True)]
    category: Literal["sniadanie", "obiad", "kolacja"]
    time_min: Annotated[int, Field(gt=0, strict=True)] | None = None
    servings: Annotated[int, Field(ge=1, le=50, strict=True)]
    source_type: Literal["manual", "pdf", "link"] = "manual"
    source_platform: Literal["instagram", "facebook", "www"] | None = None
    source_url: str | None = None
    source_description: str | None = None
    kcal: NutritionValue | None = None
    protein: NutritionValue | None = None
    carbs: NutritionValue | None = None
    fat: NutritionValue | None = None
    steps: list[str] = Field(default_factory=list)
    ingredients: list[IngredientCreate] = Field(default_factory=list)
    pdf_upload_id: UUID | None = None
    photo_upload_id: UUID | None = None
    import_job_id: UUID | None = None
    web_photo_url: str | None = None

    @field_validator("steps")
    @classmethod
    def nonempty_steps(cls, steps):
        return [step.strip() for step in steps if step.strip()]

    @model_validator(mode="after")
    def source_matches_attachment(self):
        if self.source_platform == "www" or self.web_photo_url:
            from app.importers.web.fetch import WebImportError, parse_url

            if (
                self.source_type != "link"
                or self.source_platform != "www"
                or not self.source_url
                or self.import_job_id
            ):
                raise ValueError("Strona WWW wymaga poprawnego źródła.")
            try:
                parse_url(self.source_url)
                if self.web_photo_url:
                    parse_url(self.web_photo_url)
            except WebImportError as error:
                raise ValueError("Niepoprawny adres strony lub zdjęcia.") from error
        if self.pdf_upload_id and self.source_type != "pdf":
            raise ValueError("PDF wymaga źródła PDF.")
        if self.import_job_id and self.source_type != "link":
            raise ValueError("Import wymaga źródła Link.")
        if self.source_type != "link" and (self.source_platform or self.source_url):
            raise ValueError("Link do źródła jest dostępny tylko dla importu.")
        return self
