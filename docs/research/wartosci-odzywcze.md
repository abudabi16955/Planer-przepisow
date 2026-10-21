# Rozpoznanie techniczne: Wartości odżywcze dla 29 produktów bazowych (seed)

- **Issue:** [#12](https://github.com/abudabi16955/Planer-przepisow/issues/12) (Etap 1: Researcher)
- **Status:** Gotowe do zatwierdzenia / Etap 2 (Developer)
- **Data:** 2026-10-21
- **Autor:** Researcher — Planer przepisów
- **Kontekst:** `design/telefon.dc.html` (T:889 `catalog()`), `docs/SPEC.md` (p. 5.1, 6.1), `docs/ARCHITECTURE.md` (p. 10.7)

---

## 1. Cel i zasady doboru danych

Celem rozpoznania jest przygotowanie referencyjnych danych makroskładników (energia kcal, białko, węglowodany, tłuszcze) dla 29 produktów startowych z prototypu aplikacji.

### Reguły przyjęte zgodnie ze specyfikacją (`docs/SPEC.md` p. 5.1 i 6.1):
1. **Podstawa wartości (`nutrition_basis`):** dopuszczalne w modelu to wyłącznie:
   - `na 100 g` (dla produktów stałych/sypkich, gdzie domyślną jednostką jest `g`),
   - `na 100 ml` (dla płynów, gdzie domyślną jednostką jest `ml`),
   - `na 1 szt.` (dla produktów policzalnych, gdzie domyślną jednostką jest `szt.` lub `ząbek`).
2. **Dopasowanie do jednostki domyślnej:** Podstawa została dobrana ściśle do pierwszej (domyślnej) jednostki na liście dozwolonych jednostek produktu w `catalog()`:
   - Jajka, owoce i warzywa z domyślnym `szt.` $\rightarrow$ **na 1 szt.**
   - Płyny (woda, mleko, oleje, sos sojowy, śmietanka) $\rightarrow$ **na 100 ml**
   - Produkty sypkie, mięso, sery, bakalie $\rightarrow$ **na 100 g**
3. **Stan produktów:** Zgodnie z wytycznymi produkty ujęto w **stanie surowym** (nieprzetworzonym):
   - Ryż jaśminowy i makaron penne — **suche** (przed ugotowaniem),
   - Mięso (pierś z kurczaka) — **surowe, bez skóry i kości**,
   - Warzywa i owoce — **surowe, świeże, część jadalna**.
4. **Źródła danych:**
   - **USDA FoodData Central** (bazy SR Legacy Foods oraz Foundation Foods) — oficjalna amerykańska baza laboratoryjna Departamentu Rolnictwa USA,
   - **Tabele składu i wartości odżywczej żywności** (PZWL / Instytut Żywności i Żywienia — IŻŻ / Narodowe Centrum Edukacji Żywieniowej — NCEZ) oraz oficjalne specyfikacje handlowe dla produktów specyficznych dla rynku polskiego (np. śmietanka 18%).

---

## 2. Tabela wartości odżywczych (29 produktów)

> **Oznaczenia w uwagach:**
> - `[SPRAWDZONE]` — wartość pochodzi bezpośrednio z analiz laboratoryjnych źródła dla danej jednostki/masy.
> - `[SZACUNEK]` — masa jednostki (1 szt., 1 ząbka, 1 puszki) lub przeliczenie gęstości przyjęte na podstawie standardów handlowych i kulinarnych (IŻŻ / PN-EN / etykiety).

| Lp. | Produkt | Podstawa | kcal | Białko (g) | Węglowodany (g) | Tłuszcze (g) | Źródło (link) | Uwagi |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---|:---|
| 1 | **Jajka** | na 1 szt. | 72 | 6.3 | 0.4 | 4.8 | [USDA FDC #171287](https://fdc.nal.usda.gov/food-details/171287/nutrients) | `[SPRAWDZONE]` 143 kcal/100 g; `[SZACUNEK]` przyjęto 1 szt. = 50 g części jadalnej (standardowe jajko klasy M o masie całkowitej 55–60 g). |
| 2 | **Mleko 2%** | na 100 ml | 50 | 3.4 | 4.8 | 2.0 | [USDA FDC #2705386](https://fdc.nal.usda.gov/food-details/2705386/nutrients) / IŻŻ | `[SPRAWDZONE]` Wartość dla 100 ml mleka pasteryzowanego/UHT 2% tłuszczu (gęstość ok. 1.03 g/ml). |
| 3 | **Woda** | na 100 ml | 0 | 0.0 | 0.0 | 0.0 | [USDA FDC #174620](https://fdc.nal.usda.gov/food-details/174620/nutrients) | `[SPRAWDZONE]` Czysta woda kranowa/butelkowana; 0 kcal i makroskładników. |
| 4 | **Płatki owsiane** | na 100 g | 379 | 13.2 | 67.7 | 6.5 | [USDA FDC #173904](https://fdc.nal.usda.gov/food-details/173904/nutrients) | `[SPRAWDZONE]` Płatki zwykłe/górskie suche. `[SZACUNEK]` miar: 1 szklanka ≈ 100 g (379 kcal), 1 łyżka ≈ 10 g (38 kcal). |
| 5 | **Mąka pszenna** | na 100 g | 364 | 10.3 | 76.3 | 1.0 | [USDA FDC #168936](https://fdc.nal.usda.gov/food-details/168936/nutrients) | `[SPRAWDZONE]` Mąka pszenna uniwersalna (odpowiednik polskiego typu 500). `[SZACUNEK]` miar: 1 szklanka ≈ 150 g, 1 łyżka ≈ 15 g. |
| 6 | **Cukier** | na 100 g | 387 | 0.0 | 100.0 | 0.0 | [USDA FDC #169655](https://fdc.nal.usda.gov/food-details/169655/nutrients) | `[SPRAWDZONE]` Cukier biały (sacharoza, 99.98% W). W polskich tabelach IŻŻ często zaokrąglane do 400 kcal (4 kcal/g). `[SZACUNEK]` miar: 1 łyżka ≈ 12 g, 1 łyżeczka ≈ 5 g. |
| 7 | **Sól** | na 100 g | 0 | 0.0 | 0.0 | 0.0 | [USDA FDC #173468](https://fdc.nal.usda.gov/food-details/173468/nutrients) | `[SPRAWDZONE]` Sól kuchenna (NaCl, sód 38.8 g/100 g); 0 kcal i makroskładników. |
| 8 | **Cynamon** | na 100 g | 247 | 4.0 | 80.6 | 1.2 | [USDA FDC #171320](https://fdc.nal.usda.gov/food-details/171320/nutrients) | `[SPRAWDZONE]` Cynamon mielony. `[SZACUNEK]` miar: 1 łyżeczka ≈ 3 g (7.4 kcal). |
| 9 | **Papryka wędzona** | na 100 g | 282 | 14.1 | 54.0 | 12.9 | [USDA FDC #171329](https://fdc.nal.usda.gov/food-details/171329/nutrients) | `[SPRAWDZONE]` Mielona słodka/wędzona papryka (przyprawa). `[SZACUNEK]` miar: 1 łyżeczka ≈ 3 g (8.5 kcal). |
| 10 | **Oliwa z oliwek** | na 100 ml | 828 | 0.0 | 0.0 | 92.0 | [USDA FDC #171413](https://fdc.nal.usda.gov/food-details/171413/nutrients) / [NCEZ](https://ncez.pzh.gov.pl) | `[SPRAWDZONE]` 884 kcal i 100 g T na 100 g. `[SZACUNEK]` przeliczono gęstością $\rho = 0.92\text{ g/ml}$ (100 ml = 92 g, 828 kcal / 3404 kJ — norma etykiet UE). 1 łyżka (15 ml) = 124 kcal, 1 łyżeczka (5 ml) = 41 kcal. |
| 11 | **Olej** | na 100 ml | 828 | 0.0 | 0.0 | 92.0 | [USDA FDC #172336](https://fdc.nal.usda.gov/food-details/172336/nutrients) / IŻŻ | `[SPRAWDZONE]` Uniwersalny olej roślinny / rzepakowy. `[SZACUNEK]` gęstość $\rho = 0.92\text{ g/ml}$ (100 ml = 92 g, 92 g T). 1 łyżka (15 ml) = 124 kcal, 1 łyżeczka (5 ml) = 41 kcal. |
| 12 | **Miód** | na 100 g | 304 | 0.3 | 82.4 | 0.0 | [USDA FDC #169640](https://fdc.nal.usda.gov/food-details/169640/nutrients) | `[SPRAWDZONE]` Miód pszczeli nektarowy naturalny. `[SZACUNEK]` miar: 1 łyżka ≈ 21 g (64 kcal), 1 łyżeczka ≈ 7 g (21 kcal). |
| 13 | **Sos sojowy** | na 100 ml | 61 | 9.4 | 5.7 | 0.7 | [USDA FDC #174277](https://fdc.nal.usda.gov/food-details/174277/nutrients) | `[SPRAWDZONE]` Na 100 g: 53 kcal, B: 8.14 g, W: 4.93 g, T: 0.57 g. `[SZACUNEK]` przeliczono gęstością sosu sojowego $\rho \approx 1.15\text{ g/ml}$ na 100 ml. Popularny sos Kikkoman deklaruje na 100 ml: 77 kcal, B: 10 g, W: 3.2 g, T: 0 g. |
| 14 | **Pomidory z puszki** | na 100 g | 19 | 1.0 | 3.6 | 0.2 | [USDA FDC #170051](https://fdc.nal.usda.gov/food-details/170051/nutrients) / IŻŻ | `[SPRAWDZONE]` Pomidory krojone/całe w soku (16–21 kcal/100 g). `[SZACUNEK]` miar: standardowa puszka = 400 g netto (~76 kcal, po odsączeniu ~240 g). |
| 15 | **Pomidor** | na 1 szt. | 23 | 1.1 | 5.1 | 0.3 | [USDA FDC #170457](https://fdc.nal.usda.gov/food-details/170457/nutrients) / IŻŻ | `[SPRAWDZONE]` Na 100 g: 18 kcal, B: 0.88 g, W: 3.89 g, T: 0.20 g. `[SZACUNEK]` przyjęto 1 średnią sztukę = 130 g części jadalnej (wg IŻŻ i standardu handlowego). |
| 16 | **Papryka czerwona** | na 1 szt. | 36 | 1.4 | 8.4 | 0.4 | [USDA FDC #170108](https://fdc.nal.usda.gov/food-details/170108/nutrients) | `[SPRAWDZONE]` Na 100 g: 26 kcal, B: 0.99 g, W: 6.03 g, T: 0.30 g. `[SZACUNEK]` przyjęto 1 średnią sztukę = 140 g części jadalnej (brutto ze szypułką i nasionami ~175 g, odpad 20%). |
| 17 | **Cebula** | na 1 szt. | 40 | 1.1 | 9.3 | 0.1 | [USDA FDC #170000](https://fdc.nal.usda.gov/food-details/170000/nutrients) | `[SPRAWDZONE]` Na 100 g: 40 kcal, B: 1.10 g, W: 9.34 g, T: 0.10 g. `[SZACUNEK]` przyjęto 1 średnią sztukę = 100 g części jadalnej (brutto ~110 g). |
| 18 | **Czosnek** | na 1 szt. | 7 | 0.3 | 1.7 | 0.0 | [USDA FDC #169230](https://fdc.nal.usda.gov/food-details/169230/nutrients) | `[SPRAWDZONE]` Na 100 g: 149 kcal, B: 6.36 g, W: 33.06 g, T: 0.50 g. `[SZACUNEK]` przyjęto 1 ząbek (szt.) = 5 g części jadalnej (wg IŻŻ). *(Patrz uwaga architektoniczna dot. jednostki `ząbek` poniżej).* |
| 19 | **Cukinia** | na 1 szt. | 34 | 2.4 | 6.2 | 0.6 | [USDA FDC #169291](https://fdc.nal.usda.gov/food-details/169291/nutrients) | `[SPRAWDZONE]` Na 100 g: 17 kcal, B: 1.21 g, W: 3.11 g, T: 0.32 g. `[SZACUNEK]` przyjęto 1 młodą/średnią sztukę = 200 g (USDA medium = 196 g). |
| 20 | **Jabłko** | na 1 szt. | 78 | 0.4 | 20.7 | 0.3 | [USDA FDC #171688](https://fdc.nal.usda.gov/food-details/171688/nutrients) | `[SPRAWDZONE]` Na 100 g: 52 kcal, B: 0.26 g, W: 13.81 g, T: 0.17 g. `[SZACUNEK]` przyjęto 1 średnie jabłko = 150 g części jadalnej (ze skórką, bez gniazda nasiennego; brutto ~180 g). |
| 21 | **Pierś z kurczaka** | na 100 g | 120 | 22.5 | 0.0 | 2.6 | [USDA FDC #171077](https://fdc.nal.usda.gov/food-details/171077/nutrients) / IŻŻ | `[SPRAWDZONE]` Filet z piersi kurczaka bez skóry i kości, surowy. W polskich tabelach IŻŻ w zależności od partii: 99–120 kcal, B: 21.5–22.5 g, T: 1.3–2.6 g. |
| 22 | **Ryż jaśminowy** | na 100 g | 365 | 7.1 | 80.0 | 0.7 | [USDA FDC #169756](https://fdc.nal.usda.gov/food-details/169756/nutrients) / IŻŻ | `[SPRAWDZONE]` Ziarno suche (surowe, niegotowane). `[SZACUNEK]` miar: 1 szklanka ryżu suchego ≈ 200 g (730 kcal). |
| 23 | **Makaron penne** | na 100 g | 371 | 13.0 | 74.7 | 1.5 | [USDA FDC #169736](https://fdc.nal.usda.gov/food-details/169736/nutrients) / IŻŻ | `[SPRAWDZONE]` Makaron suchy z semoliny z pszenicy durum (niegotowany). |
| 24 | **Feta** | na 100 g | 264 | 14.2 | 4.1 | 21.3 | [USDA FDC #173420](https://fdc.nal.usda.gov/food-details/173420/nutrients) | `[SPRAWDZONE]` Oryginalny grecki ser feta z mleka owczego i koziego. (Krowie sery typu sałatkowego miewają 215–240 kcal). |
| 25 | **Parmezan** | na 100 g | 392 | 35.8 | 3.2 | 25.8 | [USDA FDC #170848](https://fdc.nal.usda.gov/food-details/170848/nutrients) / IŻŻ | `[SPRAWDZONE]` Twardy ser dojrzewający typu Parmigiano Reggiano / Grana Padano. |
| 26 | **Jogurt naturalny** | na 100 g | 61 | 3.5 | 4.7 | 3.3 | [USDA FDC #171284](https://fdc.nal.usda.gov/food-details/171284/nutrients) / IŻŻ | `[SPRAWDZONE]` Jogurt naturalny niezagęszczany (w polskich tabelach dla 2% T: 60 kcal, B: 4.3 g, W: 5.6 g, T: 2.0 g). `[SZACUNEK]` miar: 1 łyżka ≈ 20 g (12 kcal). |
| 27 | **Śmietanka 18%** | na 100 ml | 186 | 2.6 | 4.0 | 18.0 | [NCEZ / IŻŻ](https://ncez.pzh.gov.pl) | `[SPRAWDZONE]` Polska śmietanka słodka 18% UHT (standard rynkowy: 186 kcal / 768 kJ, T: 18.0 g, W: 3.6–4.0 g, B: 2.5–2.7 g). 1 łyżka (15 ml) = 28 kcal. |
| 28 | **Masło** | na 100 g | 717 | 0.9 | 0.7 | 81.1 | [USDA FDC #173410](https://fdc.nal.usda.gov/food-details/173410/nutrients) / IŻŻ | `[SPRAWDZONE]` Masło tradycyjne. W polskich normach masła ekstra (min. 82.5% T): 735–740 kcal, T: 82.5 g, B: 0.7 g, W: 0.7 g. `[SZACUNEK]` miar: 1 łyżka ≈ 15 g (108 kcal), 1 łyżeczka ≈ 5 g (36 kcal). |
| 29 | **Tuńczyk w sosie własnym** | na 100 g | 86 | 19.4 | 0.0 | 1.0 | [USDA FDC #173709](https://fdc.nal.usda.gov/food-details/173709/nutrients) / IŻŻ | `[SPRAWDZONE]` Tuńczyk w kawałkach w wodzie, po odcieku. `[SZACUNEK]` miar: puszka 160 g netto, po odsączeniu ~120 g (103 kcal, 23.3 g B). |

---

## 3. Analiza techniczno-architektoniczna i wątpliwości dla zespołu

Podczas mapowania jednostek z prototypu (`design/telefon.dc.html:889`) na reguły obliczeń makro (`docs/SPEC.md` p. 5.1 i 6.1) zidentyfikowano cztery istotne zagadnienia wymagające uwagi Developera (Etap 2) i Szefa:

### 1. Czosnek: jednostka `ząbek` vs `nutrition_basis: 'szt.'`
- **Stan obecny:** W prototypie Czosnek ma jednostki `['ząbek', 'g']`. W `SPEC.md` p. 5.1 dozwolone podstawy makro to wyłącznie: `g | ml | szt. | brak`.
- **Problem:** Reguła obliczeń (SPEC p. 6.1b) mówi:
  > *„szt.” tylko z „szt.”. Składnik w jednostce niezamienialnej, „do smaku” lub produkt bez wartości — pomijany;*
  Jeśli Czosnek otrzyma w bazie danych podstawę `szt.` (z wartościami dla 1 ząbka = 7 kcal), a składnik w przepisie zostanie dodany z jednostką `ząbek`, to algorytm potraktuje `ząbek` jako jednostkę niezamienialną ze `szt.` i **pominie czosnek w obliczeniach makro**.
- **Rekomendacja dla Developera:** W silniku obliczeń na frontendzie dodać aliasowanie: jednostka `ząbek` powinna być traktowana jako tożsama z jednostką `szt.` przy przeliczaniu na podstawę (lub w definicji bazy czosnek powinien mieć dozwolone `['ząbek', 'g']`, a przelicznik `ząbek` $\rightarrow$ podstawa `szt.` wynosi $1:1$).

### 2. Warzywa i owoce na sztuki a przepisy podające wagę w gramach
- **Stan obecny:** Pomidor, Papryka czerwona, Cebula, Cukinia, Jabłko mają jednostki `['szt.', 'g']` (i opcjonalnie `kg`). Domyślną jednostką jest `szt.`, więc podstawa makro to `na 1 szt.`.
- **Konsekwencja:** Gdy użytkownik wprowadzi w przepisie np. `Pomidor: 250 g`, silnik obliczeń pominie tę pozycję, bo jednostka `g` nie przelicza się na `szt.`.
- **Rekomendacja:** W obecnym Etapie 1–2 podstawa `na 1 szt.` jest najwygodniejsza (90% przepisów domowych operuje na „1 cebula”, „2 pomidory”). W kolejnych etapach warto rozważyć dodanie opcjonalnego pola `weight_per_piece_g` w tabeli produktów, umożliwiającego dwukierunkowy przelicznik szt. $\leftrightarrow$ g.

### 3. Miary domowe (szklanka, łyżka, łyżeczka) dla produktów na 100 g
- **Stan obecny:** Produkty sypkie (płatki owsiane, mąka pszenna, ryż) mają w katalogu dozwolone `szklanka` i `łyżka`, a cukier i miód `łyżka` i `łyżeczka`.
- **Zasada SPEC 6.1b:** Przeliczanie miar domowych (`szklanka = 250 ml`, `łyżka = 15 ml`, `łyżeczka = 5 ml`) jest zdefiniowane **wyłącznie dla produktów z podstawą `na 100 ml`**.
- **Wniosek:** Dla produktów sypkich `na 100 g`, dopóki nie zostaną zdefiniowane gęstości nasypowe (np. 1 szklanka mąki = 150 g, 1 szklanka płatków = 100 g), składniki podane w szklankach będą pomijane w makro. Rekomendacja: w instrukcji / UI sugerować podawanie składników sypkich w gramach (`g`).

### 4. Jednostka `puszka`
- Pomidory z puszki i Tuńczyk mają jednostkę `puszka`, a podstawę `na 100 g`. Podobnie jak wyżej, jednostka `puszka` bez wprowadzenia stałej wagi (np. 400 g / 120 g) będzie traktowana jako jednostka niezamienialna. W seedzie rekomendowane jest zachowanie domyślnej jednostki `g`.

---

## 4. Dane do seeda bazy danych (wsparcie dla Etapu 2)

Dla ułatwienia pracy Developera w Etapie 2, poniżej zestawiono gotowy wykaz obiektów w formacie JSON / Python do migracji seedującej tabelę `products`:

```json
[
  { "name": "Jajka", "units": ["szt."], "nutrition_basis": "szt.", "kcal": 72, "protein": 6.3, "carbs": 0.4, "fat": 4.8 },
  { "name": "Mleko 2%", "units": ["ml", "l", "szklanka", "łyżka"], "nutrition_basis": "ml", "kcal": 50, "protein": 3.4, "carbs": 4.8, "fat": 2.0 },
  { "name": "Woda", "units": ["ml", "l", "szklanka"], "nutrition_basis": "ml", "kcal": 0, "protein": 0.0, "carbs": 0.0, "fat": 0.0 },
  { "name": "Płatki owsiane", "units": ["g", "szklanka", "łyżka"], "nutrition_basis": "g", "kcal": 379, "protein": 13.2, "carbs": 67.7, "fat": 6.5 },
  { "name": "Mąka pszenna", "units": ["g", "kg", "szklanka", "łyżka"], "nutrition_basis": "g", "kcal": 364, "protein": 10.3, "carbs": 76.3, "fat": 1.0 },
  { "name": "Cukier", "units": ["g", "łyżeczka", "łyżka"], "nutrition_basis": "g", "kcal": 387, "protein": 0.0, "carbs": 100.0, "fat": 0.0 },
  { "name": "Sól", "units": ["g", "szczypta", "łyżeczka"], "nutrition_basis": "g", "kcal": 0, "protein": 0.0, "carbs": 0.0, "fat": 0.0 },
  { "name": "Cynamon", "units": ["g", "łyżeczka"], "nutrition_basis": "g", "kcal": 247, "protein": 4.0, "carbs": 80.6, "fat": 1.2 },
  { "name": "Papryka wędzona", "units": ["g", "łyżeczka"], "nutrition_basis": "g", "kcal": 282, "protein": 14.1, "carbs": 54.0, "fat": 12.9 },
  { "name": "Oliwa z oliwek", "units": ["ml", "łyżka", "łyżeczka"], "nutrition_basis": "ml", "kcal": 828, "protein": 0.0, "carbs": 0.0, "fat": 92.0 },
  { "name": "Olej", "units": ["ml", "łyżka", "łyżeczka"], "nutrition_basis": "ml", "kcal": 828, "protein": 0.0, "carbs": 0.0, "fat": 92.0 },
  { "name": "Miód", "units": ["g", "łyżeczka", "łyżka"], "nutrition_basis": "g", "kcal": 304, "protein": 0.3, "carbs": 82.4, "fat": 0.0 },
  { "name": "Sos sojowy", "units": ["ml", "łyżka", "łyżeczka"], "nutrition_basis": "ml", "kcal": 61, "protein": 9.4, "carbs": 5.7, "fat": 0.7 },
  { "name": "Pomidory z puszki", "units": ["g", "puszka"], "nutrition_basis": "g", "kcal": 19, "protein": 1.0, "carbs": 3.6, "fat": 0.2 },
  { "name": "Pomidor", "units": ["szt.", "g"], "nutrition_basis": "szt.", "kcal": 23, "protein": 1.1, "carbs": 5.1, "fat": 0.3 },
  { "name": "Papryka czerwona", "units": ["szt.", "g"], "nutrition_basis": "szt.", "kcal": 36, "protein": 1.4, "carbs": 8.4, "fat": 0.4 },
  { "name": "Cebula", "units": ["szt.", "g"], "nutrition_basis": "szt.", "kcal": 40, "protein": 1.1, "carbs": 9.3, "fat": 0.1 },
  { "name": "Czosnek", "units": ["ząbek", "g"], "nutrition_basis": "szt.", "kcal": 7, "protein": 0.3, "carbs": 1.7, "fat": 0.0 },
  { "name": "Cukinia", "units": ["szt.", "g", "kg"], "nutrition_basis": "szt.", "kcal": 34, "protein": 2.4, "carbs": 6.2, "fat": 0.6 },
  { "name": "Jabłko", "units": ["szt.", "g"], "nutrition_basis": "szt.", "kcal": 78, "protein": 0.4, "carbs": 20.7, "fat": 0.3 },
  { "name": "Pierś z kurczaka", "units": ["g", "kg"], "nutrition_basis": "g", "kcal": 120, "protein": 22.5, "carbs": 0.0, "fat": 2.6 },
  { "name": "Ryż jaśminowy", "units": ["g", "kg", "szklanka"], "nutrition_basis": "g", "kcal": 365, "protein": 7.1, "carbs": 80.0, "fat": 0.7 },
  { "name": "Makaron penne", "units": ["g", "kg"], "nutrition_basis": "g", "kcal": 371, "protein": 13.0, "carbs": 74.7, "fat": 1.5 },
  { "name": "Feta", "units": ["g"], "nutrition_basis": "g", "kcal": 264, "protein": 14.2, "carbs": 4.1, "fat": 21.3 },
  { "name": "Parmezan", "units": ["g"], "nutrition_basis": "g", "kcal": 392, "protein": 35.8, "carbs": 3.2, "fat": 25.8 },
  { "name": "Jogurt naturalny", "units": ["g", "łyżka"], "nutrition_basis": "g", "kcal": 61, "protein": 3.5, "carbs": 4.7, "fat": 3.3 },
  { "name": "Śmietanka 18%", "units": ["ml", "łyżka"], "nutrition_basis": "ml", "kcal": 186, "protein": 2.6, "carbs": 4.0, "fat": 18.0 },
  { "name": "Masło", "units": ["g", "łyżka", "łyżeczka"], "nutrition_basis": "g", "kcal": 717, "protein": 0.9, "carbs": 0.7, "fat": 81.1 },
  { "name": "Tuńczyk w sosie własnym", "units": ["g", "puszka"], "nutrition_basis": "g", "kcal": 86, "protein": 19.4, "carbs": 0.0, "fat": 1.0 }
]
```
