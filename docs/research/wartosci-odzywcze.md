# Rozpoznanie techniczne: Wartości odżywcze i przeliczniki dla 29 produktów bazy (seed)

- **Issue:** [#12](https://github.com/abudabi16955/Planer-przepisow/issues/12) (Etap 1: Researcher)
- **Status:** Gotowe do zatwierdzenia / Etap 2 (Developer)
- **Data:** 2026-10-21
- **Autor:** Researcher — Planer przepisów
- **Kontekst:** `design/telefon.dc.html` (T:889 `catalog()`), `docs/SPEC.md` (p. 5.1, 6.1 — po aktualizacji z PR #15), `docs/ARCHITECTURE.md` (p. 10.7)

---

## 1. Cel i zasady doboru danych

Celem rozpoznania jest przygotowanie referencyjnych danych makroskładników (energia kcal, białko, węglowodany, tłuszcze) oraz mapy przeliczników jednostek (`unit_conversions`) dla 29 produktów startowych z prototypu aplikacji.

### Reguły przyjęte zgodnie ze specyfikacją (`docs/SPEC.md` p. 5.1 i 6.1 oraz decyzją z PR #15):
1. **Podstawa wartości (`basis` / `nutrition_basis`):**
   - **na 100 g** (`g`) — dla produktów stałych i sypkich (w tym warzyw i owoców, mięsa, serów, bakalii),
   - **na 100 ml** (`ml`) — dla płynów (woda, mleko, oleje, sos sojowy, śmietanka),
   - **na 1 szt.** (`szt.`) — wyłącznie dla Jajek (standardowa porcja kulinarna).
2. **Przeliczniki jednostek nietrywialnych (`unit_conversions`):**
   - Aplikacja automatycznie przelicza jednostki wagowe i objętościowe w systemie metrycznym: `g ↔ kg (×1000)` oraz `ml ↔ l (×1000)`.
   - Dla **wszystkich pozostałych jednostek** występujących w katalogu produktu (`szt.`, `ząbek`, `puszka`, `szklanka`, `łyżka`, `łyżeczka`, `szczypta`), w tabeli produktów definiujemy mapę przeliczenia: `jednostka → ile to jednostek podstawy` (g dla podstawy `g`, ml dla podstawy `ml`).
3. **Stan produktów:**
   - Produkty sypkie (ryż jaśminowy, makaron penne) ujęto w **stanie suchym / surowym** (przed ugotowaniem),
   - Mięso (pierś z kurczaka) — **surowe, bez skóry i kości**,
   - Warzywa i owoce — **świeże, surowe, część jadalna** (przeliczniki `szt.` uwzględniają wagę części jadalnej po odliczeniu standardowego odpadu).
4. **Źródła danych:**
   - **USDA FoodData Central** (SR Legacy Foods oraz Foundation Foods),
   - **Tabele składu i wartości odżywczej żywności PZWL / IŻŻ / NCEZ** (Instytut Żywności i Żywienia / Narodowe Centrum Edukacji Żywieniowej) oraz normy handlowe i etykiety producentów w Polsce.

---

## 2. Tabela wartości odżywczych i przeliczników (29 produktów)

> **Oznaczenia w uwagach:**
> - `[SPRAWDZONE]` — wartość odżywcza lub standaryzowana objętość (np. szklanka 250 ml, łyżka 15 ml) pochodzi bezpośrednio z danych laboratoryjnych / normatywnych.
> - `[SZACUNEK]` — masa jednostki kulinarnej (1 szt. warzywa/owocu, 1 ząbek czosnku, waga odsączonej puszki, gęstość nasypowa produktów sypkich) przyjęta na podstawie standardów IŻŻ, wagi rynkowej lub etykiet.

| Lp. | Produkt | Podstawa | kcal | B (g) | W (g) | T (g) | Przeliczniki (`unit_conversions`) | Źródło (link) | Uwagi |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---|:---|
| 1 | **Jajka** | na 1 szt. | 72 | 6.3 | 0.4 | 4.8 | *(brak)* | [USDA FDC #171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) | `[SPRAWDZONE]` 143 kcal/100 g; `[SZACUNEK]` 1 jajko = 50 g części jadalnej (klasa M). Jednostka podstawy to `szt.`. |
| 2 | **Mleko 2%** | na 100 ml | 50 | 3.4 | 4.8 | 2.0 | `szklanka` = 250 ml<br>`łyżka` = 15 ml | [USDA FDC #2705386](https://fdc.nal.usda.gov/food-details/2705386/nutrients) / IŻŻ | `[SPRAWDZONE]` Mleko pasteryzowane 2%. Miary płynów: szklanka = 250 ml, łyżka = 15 ml. |
| 3 | **Woda** | na 100 ml | 0 | 0.0 | 0.0 | 0.0 | `szklanka` = 250 ml | [USDA FDC #174620](https://fdc.nal.usda.gov/food-details/174620/nutrients) | `[SPRAWDZONE]` Czysta woda; 0 kcal. Miara standardowa: szklanka = 250 ml. |
| 4 | **Płatki owsiane** | na 100 g | 379 | 13.2 | 67.7 | 6.5 | `szklanka` = 100 g<br>`łyżka` = 10 g | [USDA FDC #173904](https://fdc.nal.usda.gov/food-details/173904/nutrients) | `[SPRAWDZONE]` Suche płatki owsiane. `[SZACUNEK]` miary nasypowe wg IŻŻ: 1 szklanka (250 ml) ≈ 100 g, 1 płaska łyżka ≈ 10 g. |
| 5 | **Mąka pszenna** | na 100 g | 364 | 10.3 | 76.3 | 1.0 | `szklanka` = 150 g<br>`łyżka` = 15 g | [USDA FDC #168936](https://fdc.nal.usda.gov/food-details/168936/nutrients) | `[SPRAWDZONE]` Mąka pszenna typ 500. `[SZACUNEK]` wg tabel IŻŻ: 1 szklanka mąki ≈ 150 g (nieubita), 1 kopiasta łyżka ≈ 15 g. |
| 6 | **Cukier** | na 100 g | 387 | 0.0 | 100.0 | 0.0 | `łyżeczka` = 5 g<br>`łyżka` = 12 g | [USDA FDC #169655](https://fdc.nal.usda.gov/food-details/169655/nutrients) | `[SPRAWDZONE]` Sacharoza biała. `[SZACUNEK]` wg IŻŻ: 1 łyżeczka = 5 g (ok. 20 kcal), 1 łyżka = 12 g (ok. 46 kcal). |
| 7 | **Sól** | na 100 g | 0 | 0.0 | 0.0 | 0.0 | `szczypta` = 1 g<br>`łyżeczka` = 6 g | [USDA FDC #173468](https://fdc.nal.usda.gov/food-details/173468/nutrients) | `[SPRAWDZONE]` Sól kuchenna (NaCl); 0 kcal. `[SZACUNEK]` 1 szczypta ≈ 1 g, 1 łyżeczka ≈ 6 g. |
| 8 | **Cynamon** | na 100 g | 247 | 4.0 | 80.6 | 1.2 | `łyżeczka` = 3 g | [USDA FDC #171320](https://fdc.nal.usda.gov/food-details/171320/nutrients) | `[SPRAWDZONE]` Mielona kora cynamonowca. `[SZACUNEK]` 1 łyżeczka przyprawy ≈ 3 g (7.4 kcal). |
| 9 | **Papryka wędzona** | na 100 g | 282 | 14.1 | 54.0 | 12.9 | `łyżeczka` = 3 g | [USDA FDC #171329](https://fdc.nal.usda.gov/food-details/171329/nutrients) | `[SPRAWDZONE]` Mielona słodka papryka wędzona. `[SZACUNEK]` 1 łyżeczka ≈ 3 g (8.5 kcal). |
| 10 | **Oliwa z oliwek** | na 100 ml | 828 | 0.0 | 0.0 | 92.0 | `łyżka` = 15 ml<br>`łyżeczka` = 5 ml | [USDA FDC #171413](https://fdc.nal.usda.gov/food-details/171413/nutrients) | `[SPRAWDZONE]` 884 kcal/100 g. `[SZACUNEK]` gęstość $\rho=0.92\text{ g/ml} \rightarrow 828\text{ kcal/100 ml}$. Łyżka = 15 ml (124 kcal), łyżeczka = 5 ml (41 kcal). |
| 11 | **Olej** | na 100 ml | 828 | 0.0 | 0.0 | 92.0 | `łyżka` = 15 ml<br>`łyżeczka` = 5 ml | [USDA FDC #172336](https://fdc.nal.usda.gov/food-details/172336/nutrients) | `[SPRAWDZONE]` Uniwersalny olej roślinny / rzepakowy. $\rho=0.92\text{ g/ml}$. Łyżka = 15 ml, łyżeczka = 5 ml. |
| 12 | **Miód** | na 100 g | 304 | 0.3 | 82.4 | 0.0 | `łyżeczka` = 7 g<br>`łyżka` = 21 g | [USDA FDC #169640](https://fdc.nal.usda.gov/food-details/169640/nutrients) | `[SPRAWDZONE]` Miód naturalny pszczeli. `[SZACUNEK]` gęsty syrop: 1 łyżeczka ≈ 7 g (21 kcal), 1 łyżka ≈ 21 g (64 kcal). |
| 13 | **Sos sojowy** | na 100 ml | 61 | 9.4 | 5.7 | 0.7 | `łyżka` = 15 ml<br>`łyżeczka` = 5 ml | [USDA FDC #174277](https://fdc.nal.usda.gov/food-details/174277/nutrients) | `[SPRAWDZONE]` 53 kcal/100 g (Shoyu). `[SZACUNEK]` $\rho \approx 1.15\text{ g/ml} \rightarrow 61\text{ kcal/100 ml}$. Łyżka = 15 ml, łyżeczka = 5 ml. |
| 14 | **Pomidory z puszki** | na 100 g | 19 | 1.0 | 3.6 | 0.2 | `puszka` = 400 g | [USDA FDC #170051](https://fdc.nal.usda.gov/food-details/170051/nutrients) | `[SPRAWDZONE]` Pomidory krojone/całe w soku. `[SZACUNEK]` standardowa puszka handlowa netto = 400 g (76 kcal). |
| 15 | **Pomidor** | na 100 g | 18 | 0.9 | 3.9 | 0.2 | `szt.` = 130 g | [USDA FDC #170457](https://fdc.nal.usda.gov/food-details/170457/nutrients) / IŻŻ | `[SPRAWDZONE]` Świeży pomidor surowy (18 kcal/100 g). `[SZACUNEK]` 1 średnia sztuka = 130 g części jadalnej (ok. 23 kcal). |
| 16 | **Papryka czerwona** | na 100 g | 26 | 1.0 | 6.0 | 0.3 | `szt.` = 140 g | [USDA FDC #170108](https://fdc.nal.usda.gov/food-details/170108/nutrients) | `[SPRAWDZONE]` Papryka słodka surowa. `[SZACUNEK]` 1 sztuka = 140 g części jadalnej (brutto ze szypułką ~175 g, 36 kcal). |
| 17 | **Cebula** | na 100 g | 40 | 1.1 | 9.3 | 0.1 | `szt.` = 100 g | [USDA FDC #170000](https://fdc.nal.usda.gov/food-details/170000/nutrients) | `[SPRAWDZONE]` Cebula biała/żółta surowa. `[SZACUNEK]` 1 średnia obrana sztuka = 100 g (40 kcal). |
| 18 | **Czosnek** | na 100 g | 149 | 6.4 | 33.1 | 0.5 | `ząbek` = 5 g | [USDA FDC #169230](https://fdc.nal.usda.gov/food-details/169230/nutrients) | `[SPRAWDZONE]` Ząbki czosnku surowe. `[SZACUNEK]` 1 obrany ząbek = 5 g (7.4 kcal). |
| 19 | **Cukinia** | na 100 g | 17 | 1.2 | 3.1 | 0.3 | `szt.` = 200 g | [USDA FDC #169291](https://fdc.nal.usda.gov/food-details/169291/nutrients) | `[SPRAWDZONE]` Cukinia surowa ze skórką. `[SZACUNEK]` 1 średnia/młoda sztuka = 200 g (34 kcal). |
| 20 | **Jabłko** | na 100 g | 52 | 0.3 | 13.8 | 0.2 | `szt.` = 150 g | [USDA FDC #171688](https://fdc.nal.usda.gov/food-details/171688/nutrients) | `[SPRAWDZONE]` Jabłko ze skórką surowe. `[SZACUNEK]` 1 średnie jabłko = 150 g części jadalnej (bez gniazda nasiennego, 78 kcal). |
| 21 | **Pierś z kurczaka** | na 100 g | 120 | 22.5 | 0.0 | 2.6 | *(brak)* | [USDA FDC #171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) / IŻŻ | `[SPRAWDZONE]` Filet z piersi kurczaka surowy, bez skóry. Dopuszczalne jednostki to `g` i `kg` (automatyczne przeliczenie). |
| 22 | **Ryż jaśminowy** | na 100 g | 365 | 7.1 | 80.0 | 0.7 | `szklanka` = 200 g | [USDA FDC #169756](https://fdc.nal.usda.gov/food-details/169756/nutrients) / IŻŻ | `[SPRAWDZONE]` Ryż biały suchy (surowy). `[SZACUNEK]` 1 szklanka ryżu suchego ≈ 200 g (730 kcal). |
| 23 | **Makaron penne** | na 100 g | 371 | 13.0 | 74.7 | 1.5 | *(brak)* | [USDA FDC #169736](https://fdc.nal.usda.gov/food-details/169736/nutrients) / IŻŻ | `[SPRAWDZONE]` Makaron durum suchy (niegotowany). Jednostki w katalogu: `g`, `kg`. |
| 24 | **Feta** | na 100 g | 264 | 14.2 | 4.1 | 21.3 | *(brak)* | [USDA FDC #173420](https://fdc.nal.usda.gov/food-details/173420/nutrients) | `[SPRAWDZONE]` Ser feta grecki oryginalny (z mleka owczego i koziego). Jednostka w katalogu: `g`. |
| 25 | **Parmezan** | na 100 g | 392 | 35.8 | 3.2 | 25.8 | *(brak)* | [USDA FDC #170848](https://fdc.nal.usda.gov/food-details/170848/nutrients) / IŻŻ | `[SPRAWDZONE]` Twardy ser dojrzewający. Jednostka w katalogu: `g`. |
| 26 | **Jogurt naturalny** | na 100 g | 61 | 3.5 | 4.7 | 3.3 | `łyżka` = 20 g | [USDA FDC #171284](https://fdc.nal.usda.gov/food-details/171284/nutrients) / IŻŻ | `[SPRAWDZONE]` Jogurt naturalny niezagęszczany. `[SZACUNEK]` 1 kopiasta łyżka jogurtu ≈ 20 g (12 kcal). |
| 27 | **Śmietanka 18%** | na 100 ml | 186 | 2.6 | 4.0 | 18.0 | `łyżka` = 15 ml | [NCEZ / IŻŻ](https://ncez.pzh.gov.pl) | `[SPRAWDZONE]` Polska śmietanka słodka 18% UHT (186 kcal/100 ml). Łyżka = 15 ml (28 kcal). |
| 28 | **Masło** | na 100 g | 717 | 0.9 | 0.7 | 81.1 | `łyżka` = 15 g<br>`łyżeczka` = 5 g | [USDA FDC #173410](https://fdc.nal.usda.gov/food-details/173410/nutrients) / IŻŻ | `[SPRAWDZONE]` Tradycyjne masło ekstra. `[SZACUNEK]` 1 płaska łyżka ≈ 15 g (108 kcal), 1 łyżeczka ≈ 5 g (36 kcal). |
| 29 | **Tuńczyk w sosie własnym** | na 100 g | 86 | 19.4 | 0.0 | 1.0 | `puszka` = 120 g | [USDA FDC #173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) / IŻŻ | `[SPRAWDZONE]` Kawałki tuńczyka po odcieku. `[SZACUNEK]` puszka 160 g brutto $\rightarrow$ **120 g masy netto po odsączeniu** (103 kcal, 23.3 g B). |

---

## 3. Kompletna lista obiektów do migracji seed (JSON)

Poniższy blok danych JSON jest bezpośrednio gotowy do wklejenia w migracji bazy PostgreSQL / teście seedującym w FastAPI (Etap 2):

```json
[
  {
    "name": "Jajka",
    "units": ["szt."],
    "basis": "szt.",
    "kcal": 72,
    "protein": 6.3,
    "carbs": 0.4,
    "fat": 4.8,
    "unit_conversions": {}
  },
  {
    "name": "Mleko 2%",
    "units": ["ml", "l", "szklanka", "łyżka"],
    "basis": "ml",
    "kcal": 50,
    "protein": 3.4,
    "carbs": 4.8,
    "fat": 2.0,
    "unit_conversions": {
      "szklanka": 250,
      "łyżka": 15
    }
  },
  {
    "name": "Woda",
    "units": ["ml", "l", "szklanka"],
    "basis": "ml",
    "kcal": 0,
    "protein": 0.0,
    "carbs": 0.0,
    "fat": 0.0,
    "unit_conversions": {
      "szklanka": 250
    }
  },
  {
    "name": "Płatki owsiane",
    "units": ["g", "szklanka", "łyżka"],
    "basis": "g",
    "kcal": 379,
    "protein": 13.2,
    "carbs": 67.7,
    "fat": 6.5,
    "unit_conversions": {
      "szklanka": 100,
      "łyżka": 10
    }
  },
  {
    "name": "Mąka pszenna",
    "units": ["g", "kg", "szklanka", "łyżka"],
    "basis": "g",
    "kcal": 364,
    "protein": 10.3,
    "carbs": 76.3,
    "fat": 1.0,
    "unit_conversions": {
      "szklanka": 150,
      "łyżka": 15
    }
  },
  {
    "name": "Cukier",
    "units": ["g", "łyżeczka", "łyżka"],
    "basis": "g",
    "kcal": 387,
    "protein": 0.0,
    "carbs": 100.0,
    "fat": 0.0,
    "unit_conversions": {
      "łyżeczka": 5,
      "łyżka": 12
    }
  },
  {
    "name": "Sól",
    "units": ["g", "szczypta", "łyżeczka"],
    "basis": "g",
    "kcal": 0,
    "protein": 0.0,
    "carbs": 0.0,
    "fat": 0.0,
    "unit_conversions": {
      "szczypta": 1,
      "łyżeczka": 6
    }
  },
  {
    "name": "Cynamon",
    "units": ["g", "łyżeczka"],
    "basis": "g",
    "kcal": 247,
    "protein": 4.0,
    "carbs": 80.6,
    "fat": 1.2,
    "unit_conversions": {
      "łyżeczka": 3
    }
  },
  {
    "name": "Papryka wędzona",
    "units": ["g", "łyżeczka"],
    "basis": "g",
    "kcal": 282,
    "protein": 14.1,
    "carbs": 54.0,
    "fat": 12.9,
    "unit_conversions": {
      "łyżeczka": 3
    }
  },
  {
    "name": "Oliwa z oliwek",
    "units": ["ml", "łyżka", "łyżeczka"],
    "basis": "ml",
    "kcal": 828,
    "protein": 0.0,
    "carbs": 0.0,
    "fat": 92.0,
    "unit_conversions": {
      "łyżka": 15,
      "łyżeczka": 5
    }
  },
  {
    "name": "Olej",
    "units": ["ml", "łyżka", "łyżeczka"],
    "basis": "ml",
    "kcal": 828,
    "protein": 0.0,
    "carbs": 0.0,
    "fat": 92.0,
    "unit_conversions": {
      "łyżka": 15,
      "łyżeczka": 5
    }
  },
  {
    "name": "Miód",
    "units": ["g", "łyżeczka", "łyżka"],
    "basis": "g",
    "kcal": 304,
    "protein": 0.3,
    "carbs": 82.4,
    "fat": 0.0,
    "unit_conversions": {
      "łyżeczka": 7,
      "łyżka": 21
    }
  },
  {
    "name": "Sos sojowy",
    "units": ["ml", "łyżka", "łyżeczka"],
    "basis": "ml",
    "kcal": 61,
    "protein": 9.4,
    "carbs": 5.7,
    "fat": 0.7,
    "unit_conversions": {
      "łyżka": 15,
      "łyżeczka": 5
    }
  },
  {
    "name": "Pomidory z puszki",
    "units": ["g", "puszka"],
    "basis": "g",
    "kcal": 19,
    "protein": 1.0,
    "carbs": 3.6,
    "fat": 0.2,
    "unit_conversions": {
      "puszka": 400
    }
  },
  {
    "name": "Pomidor",
    "units": ["szt.", "g"],
    "basis": "g",
    "kcal": 18,
    "protein": 0.9,
    "carbs": 3.9,
    "fat": 0.2,
    "unit_conversions": {
      "szt.": 130
    }
  },
  {
    "name": "Papryka czerwona",
    "units": ["szt.", "g"],
    "basis": "g",
    "kcal": 26,
    "protein": 1.0,
    "carbs": 6.0,
    "fat": 0.3,
    "unit_conversions": {
      "szt.": 140
    }
  },
  {
    "name": "Cebula",
    "units": ["szt.", "g"],
    "basis": "g",
    "kcal": 40,
    "protein": 1.1,
    "carbs": 9.3,
    "fat": 0.1,
    "unit_conversions": {
      "szt.": 100
    }
  },
  {
    "name": "Czosnek",
    "units": ["ząbek", "g"],
    "basis": "g",
    "kcal": 149,
    "protein": 6.4,
    "carbs": 33.1,
    "fat": 0.5,
    "unit_conversions": {
      "ząbek": 5
    }
  },
  {
    "name": "Cukinia",
    "units": ["szt.", "g", "kg"],
    "basis": "g",
    "kcal": 17,
    "protein": 1.2,
    "carbs": 3.1,
    "fat": 0.3,
    "unit_conversions": {
      "szt.": 200
    }
  },
  {
    "name": "Jabłko",
    "units": ["szt.", "g"],
    "basis": "g",
    "kcal": 52,
    "protein": 0.3,
    "carbs": 13.8,
    "fat": 0.2,
    "unit_conversions": {
      "szt.": 150
    }
  },
  {
    "name": "Pierś z kurczaka",
    "units": ["g", "kg"],
    "basis": "g",
    "kcal": 120,
    "protein": 22.5,
    "carbs": 0.0,
    "fat": 2.6,
    "unit_conversions": {}
  },
  {
    "name": "Ryż jaśminowy",
    "units": ["g", "kg", "szklanka"],
    "basis": "g",
    "kcal": 365,
    "protein": 7.1,
    "carbs": 80.0,
    "fat": 0.7,
    "unit_conversions": {
      "szklanka": 200
    }
  },
  {
    "name": "Makaron penne",
    "units": ["g", "kg"],
    "basis": "g",
    "kcal": 371,
    "protein": 13.0,
    "carbs": 74.7,
    "fat": 1.5,
    "unit_conversions": {}
  },
  {
    "name": "Feta",
    "units": ["g"],
    "basis": "g",
    "kcal": 264,
    "protein": 14.2,
    "carbs": 4.1,
    "fat": 21.3,
    "unit_conversions": {}
  },
  {
    "name": "Parmezan",
    "units": ["g"],
    "basis": "g",
    "kcal": 392,
    "protein": 35.8,
    "carbs": 3.2,
    "fat": 25.8,
    "unit_conversions": {}
  },
  {
    "name": "Jogurt naturalny",
    "units": ["g", "łyżka"],
    "basis": "g",
    "kcal": 61,
    "protein": 3.5,
    "carbs": 4.7,
    "fat": 3.3,
    "unit_conversions": {
      "łyżka": 20
    }
  },
  {
    "name": "Śmietanka 18%",
    "units": ["ml", "łyżka"],
    "basis": "ml",
    "kcal": 186,
    "protein": 2.6,
    "carbs": 4.0,
    "fat": 18.0,
    "unit_conversions": {
      "łyżka": 15
    }
  },
  {
    "name": "Masło",
    "units": ["g", "łyżka", "łyżeczka"],
    "basis": "g",
    "kcal": 717,
    "protein": 0.9,
    "carbs": 0.7,
    "fat": 81.1,
    "unit_conversions": {
      "łyżka": 15,
      "łyżeczka": 5
    }
  },
  {
    "name": "Tuńczyk w sosie własnym",
    "units": ["g", "puszka"],
    "basis": "g",
    "kcal": 86,
    "protein": 19.4,
    "carbs": 0.0,
    "fat": 1.0,
    "unit_conversions": {
      "puszka": 120
    }
  }
]
```
