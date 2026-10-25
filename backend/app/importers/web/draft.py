import re
from urllib.parse import urljoin

from app.importers.web.fetch import WebImportError, parse_url
from app.importers.web.ingredients import match_product, normalize, parse_ingredient
from app.importers.web.schema import clean, duration, extract, instructions


def first(value):
    return value[0] if isinstance(value, list) and value else value


def category(value):
    text = normalize(
        " ".join(str(item) for item in value) if isinstance(value, list) else str(value or "")
    )
    for result, keywords in (
        ("sniadanie", ("sniadan", "breakfast", "owsiank", "jajeczn", "omlet")),
        ("obiad", ("obiad", "dinner", "lunch", "gulasz", "schab", "zupa")),
        ("kolacja", ("kolac", "supper")),
    ):
        if any(keyword in text for keyword in keywords):
            return result
    return None


def number(value):
    if isinstance(value, (float, int)) and not isinstance(value, bool):
        return value if 0 <= value <= 1000000 else None
    text = clean(str(value or ""))
    found = re.match(r"\s*(\d+(?:[.,]\d+)?)", text)
    parsed = float(found[1].replace(",", ".")) if found else None
    return parsed if parsed is not None and 0 <= parsed <= 1000000 else None


def create_draft(html, source_url, products):
    recipe = extract(html)
    notes = []
    value = first(recipe.get("recipeYield"))
    text = clean(str(value or ""))
    found = re.fullmatch(r"(\d+)\s*(?:porcj\w*|osob\w*|servings?|portions?)?", text, re.IGNORECASE)
    servings = int(found[1]) if found and 1 <= int(found[1]) <= 50 else None
    if servings is None:
        notes.append("Nie odczytano liczby porcji od 1 do 50; uzupełnij ją.")
    total = duration(recipe.get("totalTime"))
    if total is None:
        times = [duration(recipe.get(key)) for key in ("prepTime", "cookTime")]
        total = sum(item for item in times if item is not None) or None
    if total is None:
        notes.append("Brak poprawnego czasu przygotowania.")
    nutrition = first(recipe.get("nutrition"))
    values = dict.fromkeys(("kcal", "protein", "carbs", "fat"))
    if isinstance(nutrition, dict):
        basis = clean(str(nutrition.get("servingSize", ""))).lower()
        if re.search(r"\d\s*(?:g|kg|ml|l|gram\w*|mililitr\w*)\b", basis):
            notes.append("Pominięto wartości odżywcze podane na masę lub objętość, nie na porcję.")
        elif re.search(r"porcj|serving|portion", basis):
            for name, key in (
                ("kcal", "calories"),
                ("protein", "proteinContent"),
                ("carbs", "carbohydrateContent"),
                ("fat", "fatContent"),
            ):
                values[name] = number(nutrition.get(key))
        else:
            notes.append("Pominięto wartości odżywcze bez potwierdzenia, że dotyczą jednej porcji.")
    ingredients = []
    lines = recipe.get("recipeIngredient", [])
    if isinstance(lines, str):
        lines = [line for line in lines.splitlines() if line.strip()]
    if isinstance(lines, list):
        for raw in lines[:1000]:
            if not isinstance(raw, str) or not clean(raw):
                continue
            item, comments = parse_ingredient(raw)
            item = match_product(item, products)
            ingredients.append(item)
            notes.extend(comments)
            if item["match"] == "none":
                notes.append(f"Wybierz lub dodaj produkt: {item['name']}.")
            elif item["match"] == "fuzzy":
                notes.append(f"Sprawdź przybliżone dopasowanie: {item['name']}.")
            if item["unit_ok"] is False:
                notes.append(f"Wybierz jednostkę produktu: {item['name']}.")
    if not ingredients:
        notes.append("Brak składników do odczytania.")
    photo = first(recipe.get("image"))
    if isinstance(photo, dict):
        photo = photo.get("url", photo.get("contentUrl"))
    photo_url = urljoin(source_url, photo) if isinstance(photo, str) and photo.strip() else None
    if photo_url:
        try:
            parse_url(photo_url)
        except WebImportError:
            photo_url = None
            notes.append("Pominięto niepoprawny adres zdjęcia.")
    return {
        "title": clean(recipe.get("name")),
        "time_min": total,
        "servings": servings,
        "category": category(recipe.get("recipeCategory")) or category(recipe.get("name")),
        "steps": instructions(recipe.get("recipeInstructions")),
        **values,
        "ingredients": ingredients,
        "photo_url": photo_url,
        "source_url": source_url,
        "source_host": parse_url(source_url)[1],
        "notes": list(dict.fromkeys(notes)),
    }
