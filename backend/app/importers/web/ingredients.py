import re
import unicodedata
from difflib import SequenceMatcher
from fractions import Fraction

from app.importers.web.schema import clean

UNITS = {
    "g": "g",
    "gram": "g",
    "gramy": "g",
    "gramów": "g",
    "grama": "g",
    "dag": "g",
    "dkg": "g",
    "dekagram": "g",
    "dekagramy": "g",
    "dekagramów": "g",
    "kg": "kg",
    "kilogram": "kg",
    "kilogramy": "kg",
    "kilograma": "kg",
    "kilogramów": "kg",
    "ml": "ml",
    "mililitr": "ml",
    "mililitrów": "ml",
    "l": "l",
    "litr": "l",
    "litra": "l",
    "litry": "l",
    "litrów": "l",
    "szt": "szt.",
    "sztuka": "szt.",
    "sztuki": "szt.",
    "sztuk": "szt.",
    "ząbek": "szt.",
    "ząbki": "szt.",
    "ząbków": "szt.",
    "łyżeczka": "łyżeczka",
    "łyżeczki": "łyżeczka",
    "łyżeczek": "łyżeczka",
    "łyżeczce": "łyżeczka",
    "łyżecz": "łyżeczka",
    "łyżka": "łyżka",
    "łyżki": "łyżka",
    "łyżek": "łyżka",
    "łyż": "łyżka",
    "łyżce": "łyżka",
    "szklanka": "szklanka",
    "szklanki": "szklanka",
    "szklanek": "szklanka",
    "szkl": "szklanka",
    "szczypta": "szczypta",
    "szczypty": "szczypta",
    "szczypt": "szczypta",
}
UNIT_PATTERN = "|".join(re.escape(unit) for unit in sorted(UNITS, key=len, reverse=True))
NUMBER = r"(?:\d+\s+\d+\s*/\s*\d+|\d+\s*/\s*\d+|\d+[.,]\d+|\d+|pół|ćwierć)"
QUANTITY = re.compile(rf"(?<!\w)({NUMBER})(?:\s*[-–—]\s*({NUMBER}))?(?!\w)", re.IGNORECASE)
DESCRIPTOR = (
    r"(?:mał(?:y|a|e|ego|ej|ych|ą|ym|ymi)|średn(?:i|ia|ie|iego|iej|ich|ią|im|imi)"
    r"|duż(?:y|a|e|ego|ej|ych|ą|ym|ymi)|spor(?:y|a|e|ego|ej|ych|ą|ym|ymi)"
    r"|płask(?:i|a|ie|iego|iej|ich|ą|im|imi)|czubat(?:y|a|e|ego|ej|ych|ą|ym|ymi)"
    r"|pełn(?:y|a|e|ego|ej|ych|ą|ym|ymi)|kopiast(?:y|a|e|ego|ej|ych|ą|ym|ymi)|garść|garści|garście|garściami)"
)
UNIT = re.compile(rf"^\s*(?:{DESCRIPTOR}\s+)*({UNIT_PATTERN})\.?(?=\W|$)", re.IGNORECASE)


def amount(value):
    value = value.strip().lower().replace(",", ".")
    if value in ("pół", "ćwierć"):
        return 0.5 if value == "pół" else 0.25
    if "/" in value:
        parts = value.split()
        if re.fullmatch(r"\d+\s+\d+\s*/\s*\d+", value):
            return int(parts[0]) + float(Fraction("".join(parts[1:])))
        return float(Fraction(re.sub(r"\s+", "", value)))
    return float(value)


def parse_ingredient(raw):
    text = clean(raw)
    normalized = (
        text.lower()
        .replace("½", " 1/2 ")
        .replace("¼", " 1/4 ")
        .replace("¾", " 3/4 ")
        .replace("⅓", " 1/3 ")
        .replace("⅔", " 2/3 ")
    )
    notes = []
    result = {
        "raw": text,
        "qty": None,
        "unit": "do smaku",
        "name": text,
        "product_id": None,
        "match": "none",
        "unit_ok": None,
    }
    if re.search(r"\bdo smaku\b", normalized):
        result["name"] = re.sub(r"\bdo smaku\b", "", text, flags=re.IGNORECASE).strip(" ,-")
        return result, notes
    # Ignore parenthetical comments for the primary amount, retaining string offsets.
    quantity_text = re.sub(r"\([^)]*\)", lambda item: " " * len(item[0]), normalized)
    match = QUANTITY.search(quantity_text)
    if not match:
        notes.append(f"Sprawdź ilość składnika: {text}.")
        return result, notes
    try:
        quantity = max(amount(match[1]), amount(match[2])) if match[2] else amount(match[1])
        if not 0 < quantity <= 1000000:
            raise ValueError
    except (ValueError, ZeroDivisionError, OverflowError):
        notes.append(f"Nie odczytano ilości: {text}.")
        return result, notes
    if match[2]:
        notes.append(f"Zakres ilości: przyjęto górną wartość dla „{text}”.")
    suffix = quantity_text[match.end() :]
    unit_match = UNIT.match(suffix)
    unit = UNITS[unit_match[1]] if unit_match else "szt."
    start, end = match.span()
    if unit_match:
        end += unit_match.end()
        if unit_match[1] in ("dag", "dkg", "dekagram", "dekagramy", "dekagramów"):
            quantity *= 10
            notes.append(f"Przeliczono dekagramy na gramy: {text}.")
        if unit_match[1].startswith("ząb"):
            notes.append(f"Ząbki zapisano jako sztuki; sprawdź jednostkę: {text}.")
    prefix = re.sub(rf"(?:\b{DESCRIPTOR}\s*)+$", "", quantity_text[:start])
    suffix = re.sub(rf"^(?:\s*{DESCRIPTOR}\b)+", "", quantity_text[end:])
    name = (prefix + " " + suffix).strip(" ,:–—-")
    name = re.sub(r"^(?:(?:po|do|około|ok\.)\s+)+", "", name)
    name = re.split(r"\s+[-–—]\s+|\s*[-–—]\s*(?=\d|u mnie\b)", name, maxsplit=1)[0]
    name = re.sub(r"(?:\b(?:po|do|około|ok\.?)\s*)+$", "", name).strip(" ,:–—-…")
    name = re.sub(r"\s+", " ", name)
    variants = [{"qty": quantity, "unit": unit}]
    for secondary in QUANTITY.finditer(normalized, end):
        secondary_unit = UNIT.match(normalized[secondary.end() :])
        if not secondary_unit or UNITS[secondary_unit[1]] not in ("g", "kg", "ml", "l", "szt."):
            continue
        try:
            value = (
                max(amount(secondary[1]), amount(secondary[2]))
                if secondary[2]
                else amount(secondary[1])
            )
        except (ValueError, ZeroDivisionError, OverflowError):
            continue
        if secondary_unit[1] in ("dag", "dkg", "dekagram", "dekagramy", "dekagramów"):
            value *= 10
        variant = {"qty": value, "unit": UNITS[secondary_unit[1]]}
        if 0 < value <= 1000000 and variant not in variants:
            variants.append(variant)
    if len(variants) > 1:
        result["quantity_variants"] = variants
        description = " / ".join(
            f"{format(item['qty'], 'g').replace('.', ',')} {item['unit']}" for item in variants
        )
        note = f"Sprawdź warianty ilości dla „{name or text}”: {description}."
        result["notes"] = [note]
        notes.append(note)
    result.update(qty=quantity, unit=unit, name=name or text)
    if not unit_match:
        notes.append(f"Brak jednostki: przyjęto sztuki dla „{text}”.")
    return result, notes


def normalize(value):
    value = value.lower().replace("ł", "l")
    return " ".join(
        re.findall(
            r"[a-z0-9]+",
            "".join(
                char
                for char in unicodedata.normalize("NFKD", value)
                if not unicodedata.combining(char)
            ),
        )
    )


def select_quantity(ingredient, units=None):
    variants = ingredient.get("quantity_variants", [])
    for unit in units if units is not None else ("g", "ml", "kg", "l"):
        for variant in variants:
            if variant["unit"] == unit:
                return ingredient | variant
    return ingredient


def match_product(ingredient, products):
    name = normalize(ingredient["name"])
    exact = [product for product in products if normalize(product["name"]) == name]
    if exact:
        product, kind = min(exact, key=lambda item: str(item["id"])), "exact"
    else:
        words = name.split()
        ranked = []
        for product in products:
            candidate = normalize(product["name"])
            tokens = candidate.split()
            # Inflected Polish forms share a prefix; do not guess across very short words.
            covered = any(
                word == token
                or (
                    min(len(word), len(token)) >= 3
                    and word[:3] == token[:3]
                    and SequenceMatcher(None, word, token).ratio() >= 0.55
                )
                for word in words
                for token in tokens
                if not token.isdigit()
            )
            if words and tokens and covered:
                score = SequenceMatcher(None, name, candidate).ratio()
                ranked.append((score, candidate, str(product["id"]), product))
        if not ranked:
            return select_quantity(ingredient)
        product, kind = min(ranked, key=lambda item: (-item[0], item[1], item[2]))[3], "fuzzy"
    ingredient = select_quantity(ingredient, product["units"])
    return ingredient | {
        "product_id": product["id"],
        "match": kind,
        "unit_ok": ingredient["unit"] == "do smaku" or ingredient["unit"] in product["units"],
    }
