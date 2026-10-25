# Planer przepisów — specyfikacja funkcjonalna

Wersja: 0.1 (Etap 0, do akceptacji) · Data: 2026-10-21 · Autor: Szef (Chief of Staff)

Źródło prawdy: `design/telefon.dc.html` (główny, 390×844) i `design/laptop.dc.html` (1440×900).
Teksty interfejsu, układ i kolory bierzemy z prototypu. Robocza nazwa „Kuchnia domowa” → **„Planer przepisów”**.
Dane przykładowe z prototypu (7 przepisów, plan tygodnia) są fikcyjne — w aplikacji nie występują, poza bazą produktów (p. 5.1).

Odniesienia do prototypu w formacie `T:<linia>` (telefon) i `L:<linia>`.

---

## 1. Cel i zakres

Aplikacja webowa (PWA, mobile-first) dla jednego gospodarstwa domowego:

1. zapisywanie przepisów z trzech źródeł: **link** (Instagram/Facebook — pobranie wideo i opisu), **PDF**, **ręcznie**;
2. przeglądanie przepisu: makro na porcję, składniki z przeliczaniem porcji i odhaczaniem, kroki, źródło (wideo / PDF / link);
3. **planer tygodnia**: 7 dni × 3 posiłki (śniadanie, obiad, kolacja), podsumowanie dnia względem celu dziennego;
4. **lista zakupów** generowana z planera dla wybranych dni, z odhaczaniem kupionych pozycji;
5. **baza produktów** (własna) z jednostkami i opcjonalnymi wartościami odżywczymi.

Poza zakresem: konta i logowanie (decyzja właściciela: brak logowania), wielu użytkowników,
automatyczne parsowanie składników z opisu posta, integracja z Open Food Facts.
Uzupełnienia spoza prototypu zaakceptowane przez właściciela (2026-10-21): edycja i usuwanie przepisów,
nawigacja między tygodniami w planerze, zapis opisu posta — szczegóły w p. 9.

## 2. Nawigacja i układ

| | Telefon (< 1024 px) | Laptop (≥ 1024 px) |
|---|---|---|
| Nawigacja | dolny pasek: **Przepisy · Dodaj · Planer** (T:647). „Dodaj” jako zielone kółko z „+”. Pasek ukryty w szczegółach przepisu. Lista zakupów otwierana z Planera; w pasku podświetla się wtedy „Planer”. | pasek boczny 248 px (L:34): nazwa aplikacji, **Przepisy · Planer · Lista zakupów**, na dole przycisk **„Dodaj przepis”**. |
| Szczegóły przepisu | osobny ekran pełnoekranowy, przycisk „Wróć”, dolny pasek „Dodaj do planera” | prawy panel 480 px obok siatki przepisów (L:106) |
| Arkusze / okna | dolne arkusze (bottom sheet) z przyciemnionym tłem; modal pop-up dla produktów | okno modalne (wybór przepisu, produkt) lub panel rozwijany w miejscu (dodaj do planera, cel dzienny) |
| Toast | nad paskiem nawigacji, 2,4 s | na dole, wyśrodkowany, 400 px, 2,4 s |

Adresy (URL) ekranów: `/` (przepisy), `/przepis/:id`, `/dodaj`, `/planer`, `/zakupy`. Na laptopie `/przepis/:id` otwiera listę z zaznaczonym przepisem w panelu.

## 3. Ekrany

### 3.1 Przepisy (T:35, L:60)
- Nagłówek „Przepisy”, obok licznik z odmianą: „1 przepis”, „2–4 przepisy” (z wyjątkiem 12–14), „5 przepisów”.
- Pole „Szukaj przepisu”: filtr po nazwie, bez rozróżniania wielkości liter, dopasowanie fragmentu.
- Filtry (jeden aktywny): **Wszystkie · Z wideo · Śniadania · Obiady · Kolacje**. „Z wideo” = przepisy ze źródłem Instagram/Facebook.
- Siatka kart: 2 kolumny (telefon), 3 kolumny (laptop). Karta: zdjęcie/okładka (lub kolorowy placeholder z ikoną talerza), plakietka źródła (Instagram / Facebook / PDF / — dla ręcznych brak plakietki), ikona ▶ gdy jest wideo, tytuł (max 2 linie), linia „330 kcal · 25 min”.
- Kolejność: najnowsze na górze.
- Brak wyników: „Brak przepisów dla tego filtra.”
- Pusta baza (brak przepisów) — patrz p. 8.
- Laptop: kliknięcie karty zaznacza ją (zielona obwódka 2 px) i pokazuje szczegóły w panelu.

### 3.2 Szczegóły przepisu (T:86, L:106)
- Góra: zdjęcie / okładka wideo / placeholder (telefon 250 px z przyciskiem „Wróć”; laptop 180 px).
- Plakietki: kategoria, „⏱ 25 min”, „Źródło: Instagram|Facebook|PDF|Ręcznie”.
- Tytuł.
- Karta makro „na 1 porcję”: duża liczba kcal, pasek proporcji energii (białko #14201A, węglowodany #3F8F68, tłuszcze #A9D1BB), trzy wartości w gramach.
- Zakładki: **Składniki · Przygotowanie · Źródło**.
  - **Składniki**: licznik „Porcje” − / + w zakresie **1–12** (start = liczba porcji przepisu). Ilości = ilość × porcje / porcje bazowe. Kliknięcie wiersza odhacza składnik (przekreślenie, szary kolor) — stan tylko lokalny, resetuje się przy ponownym otwarciu przepisu. Pod listą tekst pomocniczy z T:175 (tylko telefon).
  - **Przygotowanie**: numerowane karty kroków.
  - **Źródło**:
    - wideo (Instagram/Facebook): odtwarzacz pionowy 9:16 z przyciskiem ▶/❚❚ i paskiem postępu, „Wideo zapisane w aplikacji · 21,3 MB”; karta „Oryginalny post” (host skrócony, np. `instagram.com/reel/…`, „Zapisano 9 paź 2026”), przycisk „Otwórz oryginał (Instagram)” → prawdziwy URL w nowej karcie; tekst „Kopia wideo jest w aplikacji, więc przepis zostaje…”.
    - PDF: nazwa pliku, opis „1,2 MB · zapisano 3 paź 2026”, przycisk „Otwórz oryginalny PDF” (otwiera plik w nowej karcie).
    - ręczny: zakładka pokazuje „Własny przepis bez źródła.” (prototyp nie ma tego wariantu — minimalne uzupełnienie).
- Akcja **„Dodaj do planera”**:
  - telefon: dolny pasek → arkusz „Dodaj do planera” (T:707): tytuł przepisu, wybór **Dzień** (7 dni tygodnia) i **Posiłek** (3), notka „Zastąpi: <tytuł>” albo „To miejsce w planerze jest wolne.”, przycisk „Dodaj”.
  - laptop: przycisk rozwija panel w miejscu (L:235), przycisk zmienia się na „Zamknij”, zatwierdzenie „Dodaj do wybranego dnia”.
  - Domyślnie: dzień = dzień wybrany w planerze (lub dziś), posiłek = kategoria przepisu.
  - Po dodaniu toast „Dodano do planera: środa, obiad”; planer przełącza wybrany dzień na ten dzień.

### 3.3 Dodaj przepis (T:261, L:425)
- Zakładki źródła: **Link · PDF · Ręcznie**.
- **Link**: pole „Link do posta lub reela”, notka „Działa tylko z postami publicznymi…”, przycisk „Pobierz wideo i opis”.
  - Rozpoznanie platformy: `instagram.com` → Instagram, `facebook.com` / `fb.watch` → Facebook; inny adres → toast „Wklej link z Instagrama lub Facebooka”.
  - W trakcie: „Pobieram wideo z Instagram…” + nieokreślony pasek postępu.
  - Po sukcesie: miniatura, „Wideo zapisane · 18,4 MB”, „Wykryto: Instagram”, „Opis z posta: „…””. Tytuł posta (jeśli jest) wstępnie wypełnia pole „Nazwa” tylko gdy jest puste.
  - Błąd pobrania: komunikat w karcie (p. 8) i przycisk ponowienia; reszta formularza działa, można przełączyć się na „Ręcznie”.
  - Zmiana linku po pobraniu resetuje stan do „Pobierz”.
  - **„Zapisz przepis” jest nieaktywne, dopóki wideo nie zostanie pobrane** (dla zakładki Link).
- **PDF**: „Wybierz plik PDF” (pole przerywane) → po wyborze: nazwa, „1,2 MB · zapisze się razem z przepisem”, przycisk ✕ usuwa wybór.
- **Ręcznie**: tekst „Własny przepis bez źródła. Wypełnij pola poniżej.”
- Formularz (wspólny):
  - **Nazwa** (wymagana), placeholder „np. Shakshuka z fetą”;
  - **Kategoria**: Śniadanie · Obiad · Kolacja (dokładnie jedna, domyślnie Śniadanie);
  - **Czas (min)** i **Porcje** (liczby całkowite > 0; czas opcjonalny, porcje wymagane, placeholder „2”);
  - **Składniki** — lista dodanych (nazwa, ilość z jednostką, ✕ usuń) + wyszukiwarka „Dodaj składnik z bazy produktów” (p. 3.6);
  - **Przygotowanie**: textarea „Kolejne kroki, po jednym w linii” — każda niepusta linia = krok;
  - **Wartości na 1 porcję**: kcal, Białko g, Węgle g, Tłuszcz g (opcjonalne, p. 6);
  - **Zdjęcie dania**: „Dodaj zdjęcie dania” (galeria/aparat na telefonie, plik na laptopie). Po pobraniu wideo: „Okładka z wideo · zmień zdjęcie”.
- Przycisk **„Zapisz przepis”**: telefon — przyklejony na dole ekranu; laptop — w nagłówku obok tytułu. Po zapisie: przejście do szczegółów nowego przepisu i toast „Przepis zapisany”.
- Laptop: dwie kolumny — lewa (źródło + pola), prawa 460 px (składniki).

### 3.4 Planer (T:477, L:266)
- Nagłówek „Planer”, podtytuł „19–25 października · 11 z 21 posiłków” (zakres bieżącego tygodnia pon–nd; przy przełomie miesięcy „27 października – 2 listopada”).
- **Telefon**: pasek 7 dni (skrót Pn…Nd, numer dnia, 3 kolorowe paski = zajęte sloty; podpis „Paski od góry: śniadanie, obiad, kolacja.”). Wybór dnia pokazuje poniżej:
  - przycisk „Lista zakupów” z podtytułem „Wybierz dni · zaplanowane posiłki: 11” albo nieaktywny „Najpierw zaplanuj posiłki”;
  - nagłówek dnia „Środa, 21 października” + plakietka „Dziś”;
  - karta podsumowania dnia (p. 3.4.1);
  - 3 sloty: wypełniony (miniatura, tytuł, „330 kcal · 25 min”, ✕ „Usuń z planera”) lub pusty („+ Dodaj przepis”).
- **Laptop**: tablica 7 kolumn × 3 kafle (148 px); kafel wypełniony w kolorze przepisu (nazwa posiłku, tytuł do 3 linii, kcal, ✕); pusty — przerywana ramka z „+ Śniadanie”. Klik nagłówka dnia wybiera dzień do podsumowania. Prawy panel 320 px „Podsumowanie dnia”. Przycisk „Lista zakupów” w nagłówku. Klik w kafel otwiera przepis (widok Przepisy z panelem).
- Pusty slot → wybór przepisu: arkusz (telefon) / okno modalne 2-kolumnowe (laptop) „Wybierz przepis”, podtytuł „Środa · Obiad”, lista wszystkich przepisów. Wybór → toast „Dodano do planera: <tytuł>”.
- Jeden przepis na slot. Ten sam przepis może być w wielu slotach.

#### 3.4.1 Podsumowanie dnia i cel dzienny
- 4 wiersze: **Kalorie, Białko, Węglowodany, Tłuszcze**: „zjedzone / cel”, pasek (max 100%), komunikat: „Brakuje 420 kcal” · „Cel osiągnięty” · „Przekroczono o 35 g” (kolor #A3412A) · gdy cel = 0: „brak celu” i „Ustaw cel w „Zmień cel””.
- Suma = suma wartości **1 porcji** każdego zaplanowanego posiłku dnia. Przepis bez wartości odżywczych liczy się jako 0.
- „Proporcje z kalorii” (gdy dzień ma energię > 0): pasek i tekst „Białko 23% · węgle 52% · tłuszcze 25%”, pod spodem „W celu: 20% · 50% · 29%” albo „Uzupełnij cele makro, żeby zobaczyć docelowe proporcje.”.
- Podpis „Suma z zaplanowanych posiłków, po 1 porcji każdy.”.
- **Zmień cel**: telefon — arkusz „Dzienne zapotrzebowanie” (4 pola, zmiany działają od razu, przycisk „Gotowe”); laptop — panel rozwijany „Zmień cel dzienny” / „Ukryj edycję celu”.
- Domyślny cel: 2000 kcal, 100 g białka, 250 g węglowodanów, 65 g tłuszczu. Cel jest jeden (globalny), zapisywany trwale.

### 3.5 Lista zakupów (T:577, L:362)
- Nagłówek „Lista zakupów”, podtytuł „19–25 października · Pozycje: 24 · Posiłki: 11”. Telefon: przycisk „Wróć do planera”.
- Karta „Na które dni kupujesz?”: presety **Cały tydzień · Od dziś · Weekend** (aktywny, gdy wybór dokładnie mu odpowiada; „Od dziś” = dziś…niedziela) + 7 przełączników dni z liczbą zaplanowanych posiłków pod datą; podpis „Cyfra pod datą to liczba zaplanowanych posiłków tego dnia.”. Domyślnie: cały tydzień.
- Postęp: „Kupione: 3 z 24” + pasek.
- Lista pozycji (telefon 1 kolumna, laptop 2 kolumny): okrąg/✓, nazwa, ilość; klik odhacza (przekreślenie). Stan odhaczenia zapisywany trwale per tydzień.
- Puste stany: „Wybierz co najmniej jeden dzień.” / „W wybranych dniach nie ma zaplanowanych posiłków.”
- Podpis z zasadami: „Ilości są zsumowane ze wszystkich zaplanowanych posiłków, po 1 porcji każdy. Sztuki zaokrąglone w górę. Ten sam produkt w różnych jednostkach jest w osobnych wierszach.”.
- Laptop: dostęp też z paska bocznego; przycisk w planerze nieaktywny przy pustym planie.

### 3.6 Wybór składnika i nowy produkt (T:389, T:746, L:555)
- Pole „Szukaj produktu, np. mleko” (combobox). Po wpisaniu ≥ 1 znaku lista do 6 dopasowań (fragment nazwy, bez wielkości liter) z podpowiedzią „jedn.: g”.
- Brak dopasowań: „Nie ma takiego produktu w bazie.” Zawsze na dole: „+ Nie ma na liście? Dodaj „sumak” jako nowy produkt” (lub „Dodaj nowy produkt” przy pustym polu).
- Po wyborze produktu: chipy **Jednostka** (jednostki produktu + „do smaku”), pole **Ilość** (ukryte dla „do smaku”), przycisk „Dodaj składnik” aktywny, gdy ilość > 0 albo „do smaku”. Akceptujemy przecinek i kropkę.
- **Nowy produkt** (modal pop-up wyśrodkowany na ekranie z przyciemnionym tłem, na telefonie i na laptopie):
  - „Nazwa produktu” (wymagana, unikalna bez względu na wielkość liter — przy duplikacie przycisk nieaktywny);
  - „W jakich jednostkach go dodajesz? (pierwsza wybrana jest domyślna)” — chipy: g, kg, ml, l, szt., łyżeczka, łyżka, szklanka, szczypta; min. 1; kolejność wyboru = kolejność jednostek;
  - „Wartości odżywcze (opcjonalnie)” — podstawa: **na 100 g · na 100 ml · na 1 szt.** + kcal, Białko g, Węgle g, Tłuszcz g;
  - notka „Bez wartości odżywczych produkt zapisze się w przepisie, ale nie wliczy się do kalorii i makro.”;
  - „Zapisz produkt” → produkt trafia do bazy i od razu zostaje wybrany; toast „Dodano produkt do bazy: Sumak”.

## 4. Formatowanie

- Liczby: przecinek dziesiętny; wartość ≥ 10 zaokrąglana do całości, < 10 do 1 miejsca („0,5”, „2,5”, „140”).
- Daty: „9 paź 2026” (skróty miesięcy: sty, lut, mar, kwi, maj, cze, lip, sie, wrz, paź, lis, gru); nagłówki dni „Środa, 21 października”.
- Rozmiar plików: „21,3 MB” (1 miejsce po przecinku; < 1 MB w KB).
- Jednostki z odmianą liczebnika dla: łyżka, łyżeczka, szklanka, szczypta, puszka, ząbek (np. 1 łyżka, 3 łyżki, 5 łyżek, 0,5 łyżki). g, kg, ml, l, szt. bez odmiany.
- Ilość „do smaku” wyświetlana jako „do smaku”, nie skaluje się.

## 5. Model danych (logiczny)

### 5.1 Produkt
`id`, `name` (unikalna, bez wielkości liter), `units[]` (uporządkowane, pierwsza domyślna, min. 1 jednostka; dozwolone: g, kg, ml, l, szt., łyżeczka, łyżka, szklanka, szczypta, ząbek, puszka), `nutrition_basis` (g | ml | szt. | brak), `kcal`, `protein`, `carbs`, `fat` (na 100 g / 100 ml / 1 szt., opcjonalne), `unit_conversions` (opcjonalna mapa jednostka → liczba > 0 jednostek podstawy, np. Pomidor na 100 g: `{"szt.": 150}`, Mąka: `{"szklanka": 160, "łyżka": 10}`, Czosnek: `{"ząbek": 5}`; edytowalna w formularzu produktu z walidacją liczb dodatnich), `is_custom`, `created_at`.
Startowa baza: 29 produktów z `catalog()` prototypu (T:889) + wartości odżywcze z publicznych tabel (do przygotowania przez Researchera, zatwierdzane przeze mnie).

### 5.2 Przepis
`id`, `title`, `category` (sniadanie | obiad | kolacja), `time_min`, `servings` (porcje bazowe, 1–50; licznik w szczegółach ma zakres 1–12), `source_type` (link | pdf | manual), `source_platform` (instagram | facebook | null), `source_url`, `source_description` (opis posta — tekst, traktowany jak dane), `video` / `pdf` / `photo` (odnośniki do plików: ścieżka względna, rozmiar, nazwa oryginalna, typ MIME), `kcal`, `protein`, `carbs`, `fat` (na 1 porcję, ręczne, opcjonalne), `steps[]` (lista tekstów), `created_at`, `updated_at`.

### 5.3 Składnik przepisu
`recipe_id`, `position`, `product_id`, `quantity` (liczba > 0 albo null = „do smaku”), `unit` (jedna z jednostek produktu albo pusta dla „do smaku”).

### 5.4 Wpis planera
`date` (YYYY-MM-DD), `slot` (0 śniadanie, 1 obiad, 2 kolacja), `recipe_id`. Klucz: (`date`, `slot`).

### 5.5 Cel dzienny
Jeden rekord: `kcal`, `protein`, `carbs`, `fat` (liczby ≥ 0; 0 = brak celu).

### 5.6 Odhaczenia listy zakupów
`week_start` (poniedziałek), `item_key` (`product_id|unit` albo `product_id|do-smaku`), `checked`.

### 5.7 Zadanie importu
`id`, `url`, `platform`, `status` (queued | running | done | failed), `error_code`, `video`, `thumbnail`, `description`, `title`, `size_bytes`, `created_at`. Wynik zadania jest „przypinany” do przepisu przy zapisie; nieużyte zadania i pliki sprzątane po 24 h.

## 6. Reguły obliczeń

1. **Wartości na porcję przepisu**:
   a) jeśli użytkownik wpisał makro (białko/węgle/tłuszcz) — używamy ich; kcal = wpisane kcal, a gdy puste: 4·B + 4·W + 9·T;
   b) jeśli nic nie wpisał — liczymy z produktów: Σ(wartość produktu × ilość w podstawie) / porcje. Przeliczenia na podstawę, w kolejności: (1) jednostka = jednostka podstawy; (2) g←kg, ml←l (×1000); (3) `unit_conversions` produktu; (4) dla produktów „na 100 ml” standardowe miary: łyżka = 15 ml, łyżeczka = 5 ml, szklanka = 250 ml. Składnik w jednostce bez przelicznika, „do smaku” lub produkt bez wartości — pomijany;
   c) brak jakichkolwiek danych → przepis „bez wartości” (wyświetlamy „—” zamiast kcal, pasek makro pusty, w linii karty tylko „25 min”).
2. **Proporcje energii**: B% = round(4B/E·100), W% = round(4W/E·100), T% = 100 − B% − W%, gdzie E = 4B + 4W + 9T.
3. **Skalowanie porcji**: ilość × porcje / porcje bazowe; zakres licznika 1–12.
4. **Lista zakupów**: dla każdego wpisu planera w wybranych dniach i każdego składnika: ilość / porcje bazowe (czyli 1 porcja na posiłek). Grupowanie po (produkt, jednostka); bez przeliczania jednostek. „szt.” → zaokrąglenie w górę (z tolerancją 0,0001); pozostałe wg p. 4. „Do smaku” — jeden wiersz na produkt z ilością „do smaku”. Sortowanie alfabetyczne wg polskiej kolacji.
5. **Licznik posiłków**: „X z 21 posiłków” = liczba zajętych slotów w tygodniu.
6. **Dziś** i **tydzień** liczone w strefie czasowej aplikacji (domyślnie Europe/Warsaw); tydzień = poniedziałek–niedziela.

## 7. Wymagania niefunkcjonalne

- PWA: manifest, ikona, instalacja na ekranie głównym; service worker cache’uje powłokę aplikacji (bez trybu offline dla danych w v1).
- Mobile-first, cele dotykowe ≥ 44 px (jak w prototypie), kontrast i atrybuty ARIA z prototypu (role tab/tablist, dialog, combobox, aria-pressed, aria-label), `prefers-reduced-motion`.
- Czcionki Bricolage Grotesque (nagłówki) i DM Sans (tekst) — hostowane lokalnie.
- Paleta: tło #F3F5F0, tekst #14201A, wyciszony #56655B, akcent #1C6B47, jasna zieleń #DCEBE2, szarość #E3E8E0, nieaktywne #D5DCD6, ostrzeżenie #A3412A; kolory kart przepisów z palety prototypu (tint/ink, przypisywane deterministycznie dla przepisów bez zdjęcia).
- Interfejs w całości po polsku; `lang="pl"`.
- Import jest wymiennym modułem: jego awaria (brak yt-dlp, błąd sieci, zmiana API platformy) nie wpływa na resztę aplikacji.
- Wszystkie pliki użytkownika w jednym katalogu (wolumen). Konfiguracja przez zmienne środowiskowe.
- Limity rozmiaru (konfigurowalne): wideo 300 MB, PDF 50 MB, zdjęcie 15 MB.

## 8. Przypadki brzegowe

| Sytuacja | Zachowanie |
|---|---|
| Pusta baza przepisów | Ekran Przepisy: „0 przepisów” i pusta karta „Brak przepisów dla tego filtra.” (tekst prototypu); wybór przepisu w planerze — pusta lista z tym samym komunikatem. |
| Pusty plan | Przycisk „Lista zakupów” nieaktywny, podtytuł „Najpierw zaplanuj posiłki”; lista zakupów — komunikat pustego stanu. |
| Link nie z Instagrama/Facebooka | Toast „Wklej link z Instagrama lub Facebooka”, brak żądania do serwera. |
| Post prywatny / usunięty / wymaga logowania | Karta błędu: „Nie udało się pobrać wideo. Post może być prywatny lub usunięty.” + „Spróbuj ponownie”. Nie przekazujemy żadnych ciasteczek ani loginów do yt-dlp. |
| Import niedostępny (brak yt-dlp / wyłączony) | Zakładka Link pokazuje „Pobieranie z linku jest chwilowo niedostępne.”; PDF i Ręcznie działają. |
| Wideo przekracza limit | Błąd „Wideo jest za duże (limit 300 MB).” |
| Przekroczony czas pobierania (domyślnie 120 s) | Błąd jak przy niepowodzeniu, zadanie przerwane, pliki tymczasowe usunięte. |
| Opis posta zawiera HTML/skrypty/„polecenia” | Wyświetlany wyłącznie jako zwykły tekst (escapowany); nigdy nie interpretowany. |
| Plik „PDF” nie jest PDF-em | Odrzucony („To nie jest plik PDF.”) — sprawdzamy sygnaturę `%PDF`, nie tylko rozszerzenie. |
| Zdjęcie nie jest obrazem / za duże | Odrzucone z komunikatem; na kliencie zdjęcie zmniejszane do max 2000 px przed wysłaniem. |
| Przepis bez składników / kroków | Dozwolony; zakładki pokazują puste listy. |
| Ilość ułamkowa szt. (np. 0,5 cebuli) | W przepisie „0,5 szt.”; na liście zakupów zaokrąglone w górę do 1 szt. |
| Ten sam produkt w różnych jednostkach | Osobne wiersze na liście zakupów. |
| Ten sam przepis kilka razy w tygodniu | Każde wystąpienie dolicza 1 porcję. |
| Dodanie do zajętego slotu | Zastępuje poprzedni przepis (notka „Zastąpi: …”). |
| Cel = 0 lub puste pole celu | „brak celu”, pasek 0%, komunikat „Ustaw cel w „Zmień cel””. |
| Ujemne / nienumeryczne wartości w polach liczbowych | Traktowane jak puste (0); walidacja po stronie serwera odrzuca wartości < 0. |
| Duplikat nazwy produktu | „Zapisz produkt” nieaktywny. |
| Nowy tydzień | Planer i lista zakupów pokazują bieżący tydzień; odhaczenia listy są per tydzień, więc zaczynają od zera. |
| Zmiana planu po odhaczeniu pozycji | Odhaczenie zostaje przy pozycji (klucz produkt+jednostka); pozycje, które zniknęły, nie są liczone w postępie. |
| Brak miejsca na dysku / błąd zapisu pliku | Błąd „Nie udało się zapisać pliku.”; przepis nie jest zapisywany częściowo. |
| Brak sieci (PWA) | Powłoka się ładuje, akcje kończą się komunikatem „Brak połączenia z serwerem.” |

## 9. Decyzje właściciela (2026-10-21)

1. **Bez logowania.** Aplikacja nie ma kont ani hasła; jedno gospodarstwo. Ewentualna ochrona dostępu to sprawa infrastruktury (Ingress/VPN), poza aplikacją.
2. **Edycja i usuwanie przepisów — tak.** W szczegółach przepisu przyciski „Edytuj” (ten sam formularz co „Dodaj przepis”, wypełniony danymi; zapis → toast „Przepis zapisany”) i „Usuń” (potwierdzenie „Usunąć przepis? Zniknie też z planera.”; usuwa wpisy planera i pliki przepisu; toast „Przepis usunięty”). Plik źródłowy (wideo/PDF) przy edycji można podmienić tylko przez nowy import/upload.
3. **Nawigacja między tygodniami — tak.** Strzałki ‹ › przy zakresie dat w planerze (telefon i laptop) i na liście zakupów; „Dziś”/plakietka tylko w bieżącym tygodniu; domyślnie bieżący tydzień. Lista zakupów dotyczy tygodnia wybranego w planerze; preset „Od dziś” aktywny tylko w bieżącym tygodniu.
4. **Opis posta — zapisujemy.** Pokazywany w zakładce „Źródło” pod kartą „Oryginalny post” jako zwykły tekst (escapowany), nagłówek „Opis z posta”. Bez automatycznego parsowania składników.

## 10. Import przepisu ze strony WWW (2026-10-25)

Własny parser schema.org, bez AI i płatnych API. `POST /api/web-import` przyjmuje
`{url}` i zwraca szkic bez zapisu w bazie ani tworzenia plików. Najpierw szuka
`Recipe` w JSON-LD (również tablice, `@graph`, lista `@type`), potem w microdata.
Brak danych strukturalnych oznacza `no_recipe`; nie zgadujemy przepisu z HTML.

Szkic zawiera `title`, `time_min`, `servings`, `category`, `steps`, `kcal`, `protein`,
`carbs`, `fat`, `photo_url`, `source_url`, `source_host`, `ingredients` i `notes`.
Czas pochodzi z ISO 8601 `totalTime` lub sumy `prepTime` i `cookTime`. Liczba porcji
musi być jednoznaczną liczbą całkowitą 1–50; inaczej jest `null` z uwagą. Kategorie
rozpoznajemy po słowach kluczowych; brak dopasowania daje `null`. Kroki są
spłaszczone z tekstu, HowToStep i HowToSection, bez HTML. Wartości odżywcze
przyjmujemy tylko przy jawnym oznaczeniu jednej porcji w `servingSize`; masę,
objętość (np. 100 g) lub brak potwierdzenia podstawy pomijamy z uwagą.

Każdy składnik ma `raw`, `qty`, `unit`, `name`, `product_id`, `match`
(`exact`, `fuzzy`, `none`) i `unit_ok`. Parser obsługuje polskie liczby, przecinek,
ułamki, „pół”, „ćwierć”, odmiany jednostek i zakresy (górna wartość z uwagą).
Dekagramy zamienia na gramy, ząbki na sztuki z uwagą, brak jednostki przy liczbie
na sztuki. „Do smaku” pozostaje bez ilości. Dopasowanie produktu: normalizacja
nazwy, następnie podobieństwo słów/prefiksów; nieznane i przybliżone dopasowania
wymagają zatwierdzenia. Nie tworzymy produktów automatycznie. Jednostka spoza
listy produktu daje `unit_ok: false`.

Zdjęcie pobieramy **dopiero przy zapisie**. Szkic zwraca pierwszy adres `image`;
klient nie powinien renderować go bezpośrednio z obcej strony. Potwierdzony
formularz wysyła `source_type: "link"`, `source_platform: "www"`, `source_url`
i opcjonalne `web_photo_url` do POST/PUT `/api/recipes`. Serwer ponownie sprawdza
adres i przekierowania zdjęcia, limit `MAX_PHOTO_MB` i sygnaturę PNG/JPEG/GIF/WebP,
a następnie przenosi zdjęcie do plików przepisu. Błąd zapisu usuwa pliki tymczasowe.
Ręcznie wgrane `photo_upload_id` ma pierwszeństwo. Migracja 004 dopuszcza źródło
`www`; nie zmienia pozostałych źródeł. UI importu WWW jest osobnym zadaniem #54.

Pobieranie dopuszcza wyłącznie HTTP/HTTPS na portach 80/443, bez ciasteczek,
z własnym User-Agent. Każde rozwiązanie DNS i każde z maksymalnie 5 przekierowań
musi wskazywać wyłącznie publiczne adresy IP. Połączenie używa sprawdzonego IP
(z weryfikacją TLS dla oryginalnej nazwy hosta), bez ponownego DNS.
Treść strony to dane, nigdy kod ani polecenia.

Konfiguracja: `WEB_IMPORT_ENABLED=true`, `WEB_IMPORT_TIMEOUT_S=15`,
`WEB_IMPORT_MAX_HTML_MB=3`. `/api/config` zwraca `web_import_enabled`.
Limit czasu obejmuje DNS i pobieranie. Kody błędów: `unsupported_url`,
`blocked_host`, `fetch_failed`, `too_large`, `timeout`, `no_recipe`.
Wyłączenie modułu daje HTTP 503; pozostałe funkcje aplikacji nadal działają.

### 10.1. Zakładka Link i przegląd składników WWW

Linki IG/FB zachowują import wideo. Pozostałe poprawne adresy HTTP(S) używają
`POST /api/web-import`; błędny tekst daje toast „Wklej poprawny link do przepisu”.
Notka: „Instagram, Facebook (posty publiczne) lub strona z przepisem”. Przycisk
„Pobierz przepis ze strony”, postęp „Pobieram przepis z {host}…”. Flaga
`web_import_enabled: false` ukrywa przycisk WWW i pokazuje „Pobieranie ze stron
jest chwilowo niedostępne.”, bez blokowania pozostałych sposobów dodawania.

Szkic wypełnia pustą nazwę, rozpoznaną kategorię, czas, porcje, kroki i wartości
na porcję. Zdjęcie pobiera serwer przy zapisie; użytkownik może zastąpić je
własnym plikiem. Uwagi i oryginalne linie składników wyświetlamy jako tekst.
Składniki mają edytowalną ilość, chipy jednostek i możliwość usunięcia/zamiany
produktu. Dopasowanie przybliżone oznaczamy „sprawdź” i wymaga zatwierdzenia;
niezgodna jednostka wymaga wybrania jednej z jednostek produktu. Nieznany składnik
można wybrać z bazy, dodać jako nowy produkt (nazwa i jednostka ze szkicu) albo
pominąć. Dopóki są nierozstrzygnięte pozycje, zapis jest nieaktywny i pokazujemy
„Zatwierdź albo pomiń {n} składników”. Do zapisu trafiają tylko zatwierdzone pozycje.
Układ pozostaje mobile-first, z kolumną składników 460 px na laptopie.

Po zapisie źródło ma typ `link` i platformę `www`, plakietkę „WWW”; nie trafia do
filtra „Z wideo”. Zakładka Źródło pokazuje „Oryginalna strona”, host i datę zapisu
oraz „Otwórz oryginał” w nowej karcie z `rel="noopener noreferrer"`.

Błędy: `no_recipe` — „Na tej stronie nie znalazłem przepisu. Dodaj go ręcznie.”;
`blocked_host`/`unsupported_url` — „Nie mogę otworzyć tego adresu.”;
`fetch_failed`/`timeout` — „Nie udało się pobrać strony.”; `too_large` — „Strona
jest za duża.”. Dostępny jest przycisk „Spróbuj ponownie”, a formularz ręczny
pozostaje dostępny. Brak sieci: „Brak połączenia z serwerem.”.

### 10.2. Nazwy składników i alternatywne ilości WWW

Określenia rozmiaru/opisu bezpośrednio przy ilości (np. mały/mała/małe,
średni/średnia/średnie, duży/duża/duże, spory, płaska/czubata, garść i odmiany)
nie wchodzą do nazwy produktu. Dopisek osobisty po „- u mnie …” także nie służy
do dopasowania produktu. Oryginalna linia pozostaje w `raw`, a spacje w nazwie
są normalizowane. Nie usuwamy dowolnych przymiotników z nazw: np. „fasola biała”
i „papryka słodka” zachowują znaczenie.

Gdy linia zawiera dwie ilości, np. „cebula 2 średnie - 340 g” albo „plastry schabu
- u mnie od karczku 7 sztuk - 700 g”, szkic zachowuje warianty w opcjonalnym
`quantity_variants: [{qty, unit}, …]`. Główny `qty`/`unit` jest wybierany po
dopasowaniu produktu: według kolejności jego jednostek, wyłącznie spośród
wariantów podanych na stronie. Gdy produkt jest nieznany, preferujemy g lub ml,
następnie kg lub l. Jeśli żaden wariant nie pasuje do jednostek znanego produktu,
pozostaje `unit_ok: false`; nie zgadujemy przeliczników.

Obie ilości pozostają w `raw`, w `notes` składnika i w uwagach szkicu, widocznych
przy przeglądzie. Np. produkt dopuszczający tylko g dostaje 340 g, a produkt
dopuszczający tylko szt. — 2 szt. Syntetyczny test microdata obejmuje także
strukturę z nazwą i ilością w oddzielnych elementach HTML.

Przy odczycie jednostki „pełna/pełne/pełnej” działa tak jak „płaska/czubata”:
„1 pełna łyżka - 20 g” zachowuje warianty 1 łyżka i 20 g. Końcowe łączniki
przed ilością („po”, „do”, „około”, „ok.”), dopiski po rozdzielającym „ - ”
i uwagi w nawiasach nie są częścią nazwy produktu; nadal pozostają w `raw`.
Np. „mąka pszenna - do zagęszczenia sosu do 2 płaskich łyżek” daje nazwę
„mąka pszenna” i 2 łyżki. Liczby w nawiasowym opisie (np. typ mąki) nie zastępują
ilości składnika. Ułamki pozostają dokładne do obliczeń, a pole przeglądu pokazuje
je z polskim przecinkiem i do dwóch miejsc, np. 1/3 → „0,33” (dla bardzo małych
ilości zachowuje więcej miejsc). Zaokrąglenie prezentacji nie zmienia ilości
zapisywanej bez edycji.

### 10.3. Widoczny stan zatwierdzenia składników WWW

Przegląd pokazuje licznik „Zatwierdzone: X z Y”, pomijając usunięte/pominięte
wiersze w obu liczbach. Składnik gotowy do zapisu ma plakietkę „✓ zatwierdzony”
w kolorze `--accent` i spokojny wygląd. Składnik wymagający sprawdzenia (także
przy niezgodnej jednostce) ma plakietkę „sprawdź”, lewy pasek i delikatne tło
w kolorze `--warning`. Stan jest podany tekstem i opisem ARIA, nie tylko kolorem.

„Zatwierdź składnik” jest przyciskiem głównym (tło `--accent`, biały tekst);
wybór produktu, usunięcie i pominięcie pozostają drugorzędne. „Sprawdź” znika
po jawnym zatwierdzeniu. Wybór lub dodanie produktu pozostawia `confirmed=false`,
również przy zmianie pierwotnego dopasowania exact albo fuzzy. Kliknięcie produktu
w wyszukiwarce od razu wraca do wiersza przeglądu z przyciskiem „Zatwierdź składnik”,
bez pośredniego „Dodaj składnik”. Nowy produkt także wymaga zatwierdzenia wiersza.
Do tego czasu licznik i blokada zapisu wskazują nierozstrzygnięty składnik.
„Cofnij zatwierdzenie” ustawia `confirmed=false` i ponownie blokuje zapis do
kolejnego zatwierdzenia; działa także dla dopasowań exact. Edycja ilości lub
jednostki nie cofa flagi zatwierdzenia; niepoprawna wartość nadal blokuje zapis.
Przyciski mają etykiety ARIA z nazwą produktu. Edycja danych katalogu produktów
pozostaje osobnym zadaniem #62.

### 3.6.1. Edycja produktu (2026-10-25)

Po wybraniu produktu w wyszukiwarce składników i przy dopasowanym wierszu
przeglądu importu dostępny jest przycisk „Edytuj produkt”. Ten sam formularz co
„Nowy produkt” otwiera się z wypełnioną nazwą, jednostkami, przelicznikami,
podstawą i wartościami odżywczymi. Formularz „Nowy produkt” i „Edytuj produkt” to
modal pop-up wyśrodkowany na ekranie z przyciemnionym tłem, na telefonie i na
laptopie (`role="dialog"`, `aria-modal="true"`, pułapka fokusu na obu szerokościach,
blokada przewijania tła). Przyciski: „Zapisz zmiany” / „Zapisz produkt” oraz
„Anuluj” (wyraźny przycisk drugorzędny na dole obok przycisku zapisu, min. 44 px
wysokości) oraz ikona ✕ w nagłówku (`aria-label="Zamknij"`). Przyciski „Nie ma na
liście? Dodaj „…” jako nowy produkt” i „Edytuj produkt” mają styl przycisku
drugorzędnego z obramowaniem w kolorze akcentu. Notka: „Zmiana dotyczy wszystkich
przepisów z tym produktem.”. Nie usuwamy produktów z bazy.

Zmieniać można nazwę, listę dozwolonych jednostek (min. 1 jednostka wymagana;
pierwsza wybrana jest domyślną), przeliczniki jednostek, podstawę (100 g, 100 ml,
1 szt. lub brak) i kcal/białko/węgle/tłuszcz. Wybranie „brak” podstawy czyści
wartości odżywcze i przeliczniki. Dla każdej jednostki różnej od podstawy (i innej
niż automatycznie przeliczalna: kg↔g, l↔ml oraz dla ml także łyżka/łyżeczka/szklanka)
dostępne jest opcjonalne pole przelicznika: `1 {jednostka} = [____] {podstawa}`
z dopiskiem: „Bez przelicznika ta jednostka nie wliczy się do kalorii.”.

Duplikat nazwy blokuje zapis (bez względu na wielkość liter, z pominięciem własnego
id). Serwer odrzuca duplikat kodem 409: „Produkt o tej nazwie już istnieje.”.
Przy próbie usunięcia jednostki, która jest już używana w którymkolwiek przepisie,
serwer zwraca błąd 409: „Jednostka „{u}” jest używana w przepisach ({count}).
Najpierw zmień je w przepisach.”. W razie błędu 409 modal pozostaje otwarty,
a treść błędu z serwera wyświetla się w formularzu w roli alertu.

Po zapisaniu zmian w produkcie:
- wiersze importu powiązane z tym produktem, które miały błąd jednostki (`unit_ok: false`),
  automatycznie sprawdzają, czy ich jednostka lub warianty pasują do nowych jednostek produktu;
  w razie dopasowania wiersz przechodzi w `unit_ok: true`, ustawia pasującą jednostkę i ilość,
  zachowując status `confirmed` bez przeładowywania strony,
- bieżąca lista `products` odświeża się odpowiedzią serwera,
- nazwa i podpowiedzi makro w formularzu przepisu przeliczają się natychmiast,
- toast potwierdza: „Zapisano produkt: <nazwa>”.

`PUT /api/products/{id}` przyjmuje name, units, unit_conversions, nutrition_basis,
kcal, protein, carbs i fat, z walidacją spójności jednostek i liczb dodatnich.
404 oznacza nieznane id. Nie zmieniają się id, is_custom i created_at.

Makro liczone ze składników jest wyliczane z bieżącego katalogu produktów przy
odczycie na froncie. Nie zapisujemy kopii obliczeń. Jawne wartości na porcję
przepisu (ręczne lub zaakceptowane z importu WWW) mają pierwszeństwo zgodnie
z sekcją 6.1 i nie są nadpisywane przy edycji produktu.
