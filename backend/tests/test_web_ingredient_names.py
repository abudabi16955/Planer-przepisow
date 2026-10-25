from pathlib import Path

import pytest

from app.importers.web.draft import create_draft
from app.importers.web.ingredients import match_product, parse_ingredient


@pytest.mark.parametrize(
    "line,name",
    [
        ("cebula 2 średnie - 340 g", "cebula"),
        ("2 małe cebule", "cebule"),
        ("2 mała cebula", "cebula"),
        ("1 mały pomidor", "pomidor"),
        ("1 średni pomidor", "pomidor"),
        ("1 średnia cebula", "cebula"),
        ("1 duży pomidor", "pomidor"),
        ("1 duża cebula", "cebula"),
        ("2 duże pomidory", "pomidory"),
        ("2 spore ziemniaki", "ziemniaki"),
        ("1 spory ziemniak", "ziemniak"),
        ("1 płaska łyżka cukru", "cukru"),
        ("1 czubata łyżka mąki", "mąki"),
        ("2 garści szpinaku", "szpinaku"),
        ("1 garść szpinaku", "szpinaku"),
        ("średnie 2 cebule", "cebule"),
        ("cebula 2 sztuki średnie - 340 g", "cebula"),
        ("plastry schabu - u mnie od karczku 7 sztuk - 700 g", "plastry schabu"),
    ],
)
def test_descriptors_near_quantity_do_not_pollute_name(line, name):
    ingredient, _ = parse_ingredient(line)
    assert ingredient["name"] == name
    assert ingredient["raw"] == line


@pytest.mark.parametrize(
    "line,name",
    [
        ("200 g fasoli białej", "fasoli białej"),
        ("2 łyżki papryki słodkiej", "papryki słodkiej"),
        ("2 małopolskie jabłka", "małopolskie jabłka"),
        ("średnia cebula", "średnia cebula"),
    ],
)
def test_meaningful_names_and_words_away_from_quantity_are_preserved(line, name):
    assert parse_ingredient(line)[0]["name"] == name


@pytest.mark.parametrize(
    "units,quantity,unit",
    [
        (["g"], 340, "g"),
        (["szt."], 2, "szt."),
        (["szt.", "g"], 2, "szt."),
        (["g", "szt."], 340, "g"),
    ],
)
def test_selects_variant_allowed_by_product_and_keeps_both(units, quantity, unit):
    ingredient, notes = parse_ingredient("cebula 2 średnie - 340 g")
    result = match_product(ingredient, [{"id": "onion", "name": "Cebula", "units": units}])
    assert (result["qty"], result["unit"], result["unit_ok"]) == (quantity, unit, True)
    assert result["product_id"] == "onion" and result["match"] == "exact"
    assert result["quantity_variants"] == [{"qty": 2, "unit": "szt."}, {"qty": 340, "unit": "g"}]
    assert "2 szt." in notes[0] and "340 g" in notes[0]
    assert result["notes"] == notes[:1]


@pytest.mark.parametrize(
    "line,quantity,unit",
    [
        ("cebula 2 średnie - 340 g", 340, "g"),
        ("plastry schabu - u mnie od karczku 7 sztuk - 700 g", 700, "g"),
        ("mleko 2 szklanki - 500 ml", 500, "ml"),
        ("dynia 1 duża - 1,5 kg", 1.5, "kg"),
    ],
)
def test_unknown_product_prefers_mass_or_volume(line, quantity, unit):
    result = match_product(parse_ingredient(line)[0], [])
    assert (result["qty"], result["unit"]) == (quantity, unit)
    assert result["product_id"] is None and result["match"] == "none"
    assert result["unit_ok"] is None
    assert len(result["quantity_variants"]) == 2


def test_incompatible_product_stays_flagged_without_implicit_conversion():
    result = match_product(
        parse_ingredient("cebula 2 średnie - 340 g")[0],
        [{"id": "onion", "name": "Cebula", "units": ["kg"]}],
    )
    assert result["unit_ok"] is False
    assert result["quantity_variants"][1] == {"qty": 340, "unit": "g"}


def test_synthetic_microdata_separate_name_and_amount():
    html = (Path(__file__).parent / "fixtures/web/separate-ingredients.html").read_text()
    products = [
        {"id": "onion", "name": "Cebula", "units": ["szt."]},
        {"id": "pork", "name": "Schab", "units": ["g"]},
        {"id": "milk", "name": "Mleko", "units": ["ml"]},
    ]
    draft = create_draft(html, "https://recipes.example/synthetic", products)
    onion, pork, milk, squash = draft["ingredients"]
    assert onion["name"] == "cebula" and onion["qty"] == 2 and onion["unit_ok"]
    assert pork["name"] == "plastry schabu" and pork["qty"] == 700 and pork["unit"] == "g"
    assert pork["product_id"] == "pork" and pork["unit_ok"]
    assert milk["qty"] == 500 and milk["unit"] == "ml" and milk["unit_ok"]
    assert squash["qty"] == 1.5 and squash["unit"] == "kg" and squash["match"] == "none"
    assert all(len(row["quantity_variants"]) == 2 for row in draft["ingredients"])
    assert "u mnie od karczku" in pork["raw"]
    assert any("7 szt." in note and "700 g" in note for note in draft["notes"])


@pytest.mark.parametrize("units,qty,unit", [(["szt."], 2, "szt."), (["g"], 340, "g")])
def test_mass_before_piece_count_also_keeps_both_variants(units, qty, unit):
    parsed, _ = parse_ingredient("cebula 340 g - 2 sztuki")
    result = match_product(parsed, [{"id": "onion", "name": "Cebula", "units": units}])
    assert result["name"] == "cebula"
    assert (result["qty"], result["unit"], result["unit_ok"]) == (qty, unit, True)
    assert result["quantity_variants"] == [{"qty": 340, "unit": "g"}, {"qty": 2, "unit": "szt."}]
