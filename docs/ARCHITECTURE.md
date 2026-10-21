# Planer przepisów — architektura

Wersja: 0.1 (Etap 0, do akceptacji) · Data: 2026-10-21 · Autor: Szef (Chief of Staff)

Zasada nadrzędna: **proste rozwiązania ponad modne** — mało zależności, jedna usługa, jedna baza w pliku.

## 1. Stack w skrócie

| Warstwa | Wybór | Dlaczego |
|---|---|---|
| Backend | **Python 3.12+ / FastAPI**, Uvicorn | yt-dlp to biblioteka Pythona — import działa w tym samym venv bez drugiego języka; FastAPI daje walidację (Pydantic) i OpenAPI bez dodatkowej pracy. |
| Baza danych | **SQLite** (moduł `sqlite3` ze stdlib), tryb WAL | Jedno gospodarstwo, mały ruch → żadnego serwera bazy. Plik w wolumenie, kopia zapasowa = kopia pliku. Bez ORM: kilka tabel, czytelne SQL. |
| Migracje | numerowane pliki `migrations/NNN_opis.sql` + tabela `schema_version`, uruchamiane przy starcie | Bez Alembica — wystarczy kilkadziesiąt linii kodu. |
| Frontend | **Svelte 5 + Vite**, TypeScript, SPA | Mały bundle (ważne na telefonie), prosty model komponentów, mało zależności. Budowany do plików statycznych serwowanych przez FastAPI → jedna usługa, jeden kontener. |
| Routing | własny mini-router (History API, ~50 linii) | 5 tras; biblioteka zbędna. |
| Style | zwykły CSS (custom properties z palety prototypu), bez frameworka CSS | Prototyp ma gotowe style inline — przenosimy je 1:1 do komponentów. |
| Czcionki | `@fontsource/dm-sans`, `@fontsource/bricolage-grotesque` (self-hosted) | Bez Google Fonts w runtime (prywatność, offline PWA). |
| PWA | ręczny `manifest.webmanifest` + mały service worker (cache powłoki) | Bez `vite-plugin-pwa`/Workbox — kilkadziesiąt linii zamiast zależności. |
| Import wideo | **yt-dlp** (w venv projektu) + **ffmpeg** (w obrazie Dockera) jako podproces | Standard do pobierania wideo z IG/FB; wymienny moduł. |
| Testy | pytest (backend), Vitest + @testing-library/svelte (frontend), Playwright (e2e, tylko CI) | Patrz p. 5. |
| Lint/format | ruff (Python), ESLint + eslint-plugin-svelte + Prettier, `svelte-check` (typy) | Szybkie, standardowe. |
| CI | GitHub Actions | Wymóg. |
| Wdrożenie | Docker (multi-stage) → Kubernetes (Deployment z 1 repliką + PVC) | SQLite = jeden zapisujący proces → 1 replika, strategia `Recreate`. |

Odrzucone: Next.js/React (cięższe, SSR niepotrzebny), PostgreSQL (dodatkowa usługa bez potrzeby), Celery/Redis (kolejka w procesie wystarcza), ORM (zbędna warstwa), Tailwind (prototyp ma gotowe style).

## 2. Struktura katalogów

```
/
├── backend/
│   ├── pyproject.toml            # zależności, ruff, pytest
│   ├── app/
│   │   ├── main.py               # tworzenie FastAPI, montowanie static + SPA fallback
│   │   ├── config.py             # Settings z env (p. 6)
│   │   ├── db.py                 # połączenie SQLite, migracje
│   │   ├── migrations/           # 001_init.sql, 002_seed_products.sql, ...
│   │   ├── models.py             # schematy Pydantic (wejście/wyjście API)
│   │   ├── routers/              # products.py, recipes.py, plan.py, goals.py, shopping.py, files.py, imports.py
│   │   ├── services/             # logika niezwiązana z HTTP (zapis plików, walidacja PDF, sprzątanie)
│   │   ├── storage.py            # operacje na DATA_DIR (bezpieczne ścieżki, zapis atomowy)
│   │   └── importers/            # MODUŁ IMPORTU (p. 4)
│   │       ├── base.py           # interfejs Importer, ImportResult, wyjątki
│   │       ├── ytdlp.py          # implementacja na yt-dlp
│   │       ├── jobs.py           # kolejka zadań w procesie
│   │       └── registry.py       # wybór implementacji / wyłączenie
│   └── tests/                    # pytest: api/, importers/ (z fałszywym importerem), domain/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html                # lang="pl"
│   ├── public/                   # manifest.webmanifest, ikony, sw.js
│   └── src/
│       ├── main.ts, App.svelte   # układ: TabBar (<1024px) / Sidebar (≥1024px)
│       ├── lib/
│       │   ├── router.ts
│       │   ├── api.ts            # fetch + typy odpowiedzi
│       │   ├── stores/           # stan: przepisy, plan, cel, wybrany dzień, toast
│       │   ├── domain/           # CZYSTE FUNKCJE + testy: scale.ts, nutrition.ts, shopping.ts, format.ts (liczby, daty, odmiana), week.ts
│       │   └── components/       # Chip, Sheet, Modal, Toast, RecipeCard, MacroBar, GoalRow, ProductPicker, ...
│       ├── screens/              # Recipes, RecipeDetail, AddRecipe, Planner, Shopping (każdy z wariantem mobile/desktop)
│       └── styles/tokens.css     # paleta i typografia z prototypu
├── e2e/                          # Playwright: scenariusze krytyczne (telefon 390×844, laptop 1440×900)
├── design/                       # prototyp (źródło prawdy, bez zmian)
├── docs/                         # SPEC.md, ARCHITECTURE.md
├── deploy/k8s/                   # przykładowe manifesty: deployment, service, pvc, configmap
├── Dockerfile
├── .github/workflows/ci.yml
├── .env.example                  # bez sekretów; .env w .gitignore
└── Makefile                      # make dev / test / lint / build — jedno wejście dla ludzi i botów
```

## 3. Podział odpowiedzialności

- **Frontend** liczy wszystko, co widać na ekranie i zależy tylko od danych: skalowanie porcji, makro przepisu z produktów, podsumowanie dnia, agregację listy zakupów, formatowanie po polsku. To czyste funkcje w `src/lib/domain/` z pełnymi testami jednostkowymi (najważniejsza logika aplikacji = najlepiej przetestowana).
- **Backend** odpowiada za trwałość danych, walidację, pliki i import. Nie duplikuje obliczeń, z jednym wyjątkiem: przy zapisie przepisu nie liczy makro — zapisuje to, co wpisał użytkownik; wyliczenie z produktów jest dynamiczne na froncie (zmiana wartości produktu aktualizuje przepisy).
- Komunikacja: REST/JSON pod `/api/...`; pliki pod `/files/...`. Dane są małe (dziesiątki–setki przepisów) → frontend pobiera listy w całości i filtruje lokalnie (wyszukiwarka i filtry działają natychmiast).

### 3.1 API (szkic)

| Metoda i ścieżka | Opis |
|---|---|
| `GET /api/health` | liveness/readiness (sprawdza zapis w DATA_DIR i połączenie z bazą) |
| `GET /api/products` · `POST /api/products` | baza produktów; 409 przy duplikacie nazwy |
| `GET /api/recipes` · `GET /api/recipes/{id}` · `POST /api/recipes` | przepisy (POST: JSON z polami + identyfikatory wcześniej wgranych plików / zadania importu) |
| `POST /api/uploads` (multipart) | wgranie PDF lub zdjęcia → `upload_id`; walidacja typu i rozmiaru |
| `POST /api/imports` · `GET /api/imports/{id}` | start zadania importu z linku; odpytywanie statusu (co 1 s) |
| `GET /api/plan?week=YYYY-MM-DD` · `PUT /api/plan/{date}/{slot}` · `DELETE /api/plan/{date}/{slot}` | planer |
| `GET /api/goal` · `PUT /api/goal` | cel dzienny |
| `GET /api/shopping-checks?week=` · `PUT /api/shopping-checks` | odhaczenia listy zakupów |
| `GET /api/config` | flagi dla UI, np. `import_enabled` |
| `GET /files/{path}` | pliki użytkownika z obsługą HTTP Range (przewijanie wideo) |

Zapis przepisu z plikami: plik najpierw trafia do `DATA_DIR/tmp` (upload lub import), a przy `POST /api/recipes` jest przenoszony do docelowego katalogu w tej samej transakcji logicznej; błąd = brak przepisu i sprzątnięcie plików. Pliki tymczasowe starsze niż 24 h usuwa zadanie okresowe w procesie.

## 4. Moduł importu (Instagram/Facebook)

Wymagania z SOUL: osobny, wymienny moduł; jego awaria nie psuje reszty; tylko posty publiczne; yt-dlp w venv projektu.

- **Interfejs** (`importers/base.py`): `Importer.fetch(url, workdir, limits) -> ImportResult(video_path, thumbnail_path, description, title, platform, size_bytes)`; błędy jako `ImportError` z kodem (`private_or_missing`, `too_large`, `timeout`, `unsupported_url`, `unavailable`).
- **Implementacja** (`importers/ytdlp.py`): uruchamia `python -m yt_dlp` jako **podproces** z limitem czasu (`IMPORT_TIMEOUT_S`, domyślnie 120 s) i limitem rozmiaru (`--max-filesize`), bez ciasteczek i logowania (`--no-cookies`, brak `--username`), format mp4 ≤ 1080p, zapis do katalogu tymczasowego. Podproces izoluje awarie (crash, wyciek pamięci) od serwera i pozwala zabić zadanie.
- **Kolejka** (`importers/jobs.py`): `ThreadPoolExecutor(max_workers=1)` w procesie + rekordy w tabeli `import_job`; po restarcie zadania `running` oznaczane jako `failed`. Bez Redis/Celery.
- **Bezpieczeństwo**:
  - lista dozwolonych hostów (`instagram.com`, `www.instagram.com`, `facebook.com`, `www./m.facebook.com`, `fb.watch`) sprawdzana na serwerze, tylko `https` → ochrona przed SSRF;
  - opis posta to **dane**: zapisywany jako tekst, wyświetlany escapowany, nigdy nie interpretowany ani przekazywany do innych narzędzi jako polecenie;
  - nazwy plików generowane przez nas (UUID), nie z metadanych posta.
- **Wymienność i awaria**: `registry.py` wybiera implementację wg `IMPORT_BACKEND` (`ytdlp` | `disabled` | `fake` dla testów). Jeśli import wyłączony lub yt-dlp nie da się zaimportować — `/api/config` zwraca `import_enabled: false`, UI pokazuje komunikat w zakładce Link, wszystko inne działa. Testy CI używają `fake` (bez sieci); jeden opcjonalny test „na żywo” uruchamiany ręcznie.
- **Aktualizacje**: yt-dlp wymaga częstych aktualizacji (platformy zmieniają API) — wersja przypięta w `pyproject.toml`, aktualizacja przez zwykły PR (Dependabot dla pip).

## 5. Testowanie

| Poziom | Narzędzie | Co obejmuje | Gdzie |
|---|---|---|---|
| Jednostkowe — domena | Vitest | skalowanie, makro, lista zakupów, formatowanie, odmiana, tydzień — przypadki z SPEC p. 4, 6, 8 (np. 0,5 szt. → 1 szt., różne jednostki = osobne wiersze) | lokalnie + CI |
| Komponenty | Vitest + @testing-library/svelte (jsdom) | stany przycisków (np. „Zapisz przepis” nieaktywny przed pobraniem), puste stany, teksty | lokalnie + CI |
| API | pytest + `httpx`/TestClient, SQLite w katalogu tymczasowym | CRUD, walidacja, upload (sygnatura PDF, limity), Range dla wideo, migracje od zera | lokalnie + CI |
| Import | pytest z `fake` importerem + test podprocesu z atrapą skryptu | kody błędów, timeout, sprzątanie plików, odporność na awarię | lokalnie + CI |
| E2E | Playwright (Chromium), viewport 390×844 i 1440×900 | 4 ścieżki: dodaj przepis ręcznie → zaplanuj → lista zakupów; dodaj produkt; zmień cel; filtr i wyszukiwanie | **tylko CI** (lokalnie przeglądarki Playwrighta wymagają pakietów systemowych, których na VM nie instalujemy) |
| Lint/typy | ruff check + ruff format --check, ESLint, Prettier --check, svelte-check | cały kod | lokalnie + CI |

Zasada: każdy PR dodaje lub aktualizuje testy dla zmienianego zachowania. Review sprawdza też zgodność tekstów UI z prototypem.

## 6. Konfiguracja (zmienne środowiskowe)

| Zmienna | Domyślnie | Opis |
|---|---|---|
| `DATA_DIR` | `/data` (lokalnie `./data`) | jedyny katalog z danymi: `app.db` + `files/{videos,pdfs,photos,thumbs,tmp}` → montowany jako wolumen |
| `PORT` | `8000` | port HTTP |
| `TZ` / `APP_TIMEZONE` | `Europe/Warsaw` | „dziś” i granice tygodnia |
| `IMPORT_BACKEND` | `ytdlp` | `ytdlp` / `disabled` / `fake` |
| `IMPORT_TIMEOUT_S` | `120` | limit czasu pobierania |
| `MAX_VIDEO_MB` / `MAX_PDF_MB` / `MAX_PHOTO_MB` | `300` / `50` / `15` | limity plików |
| `LOG_LEVEL` | `info` | logi na stdout (K8s) |

Brak sekretów w v1. Gdyby właściciel wybrał hasło aplikacji (SPEC p. 9.1) — `APP_PASSWORD` wyłącznie z env/Secret K8s; `.env` w `.gitignore`, w repo tylko `.env.example`.

## 7. Docker i Kubernetes

- **Dockerfile multi-stage**: (1) `node:24-slim` buduje frontend → `dist/`; (2) `python:3.12-slim` + `apt-get install ffmpeg` (w obrazie, nie na VM), venv z zależnościami (w tym yt-dlp), kopiuje `dist/` jako statyczne pliki; użytkownik nie-root (UID 10001), `HEALTHCHECK` na `/api/health`, `VOLUME /data`.
- **K8s** (`deploy/k8s/`, przykładowe): Deployment 1 replika, `strategy: Recreate` (SQLite), PVC na `/data`, ConfigMap ze zmiennymi, liveness/readiness `/api/health`, `securityContext: runAsNonRoot, readOnlyRootFilesystem` (zapisy tylko do `/data` i `/tmp` jako emptyDir). Ingress poza zakresem repo (zależny od klastra).
- **Lokalnie na VM**: Docker nie jest zainstalowany — rozwój przez `make dev` (uvicorn + vite dev z proxy `/api`). Budowanie obrazu sprawdza CI (`docker build` w GitHub Actions); nie instalujemy Dockera na VM.

## 8. CI (GitHub Actions)

Jeden workflow `.github/workflows/ci.yml`, uruchamiany na każdym PR i push do `main`. Jeden zbiorczy check o stałej nazwie **`ci`** (job agregujący), żeby właściciel mógł dodać go jako wymagany w ochronie `main`:

1. `backend` — setup-python, `pip install -e backend[dev]`, `ruff check`, `ruff format --check`, `pytest`;
2. `frontend` — setup-node, `npm ci`, `npm run lint`, `npm run check` (svelte-check), `npm test`, `npm run build`;
3. `e2e` — po (2): Playwright z `--with-deps` na runnerze GitHuba, uruchamia zbudowaną aplikację z `IMPORT_BACKEND=fake`;
4. `docker` — `docker build` (bez publikacji obrazu; rejestr i publikacja do decyzji później);
5. `ci` — `needs: [backend, frontend, e2e, docker]`, zielony tylko gdy wszystkie są zielone.

## 9. Lokalne środowisko na VM (stan sprawdzony 2026-10-21)

Dostępne: Python 3.14, Node 24, npm 11, ffmpeg 8, git, gh (zalogowany). Brak: Docker, uv (niepotrzebne — używamy `python -m venv` i pip).
Venv projektu: `backend/.venv` (w `.gitignore`); yt-dlp instalowany tylko tam. Zależności frontendu w `frontend/node_modules`. Nic nie instalujemy systemowo i nie używamy sudo.

## 10. Decyzje (ADR w skrócie)

1. **Jedna usługa (FastAPI serwuje SPA)** — zamiast osobnego serwera frontendu: prostsze wdrożenie i brak CORS.
2. **SQLite + 1 replika** — wystarcza dla jednego gospodarstwa; skalowanie poziome nie jest wymaganiem. Zmiana na Postgres możliwa później (SQL bez specyficznych rozszerzeń).
3. **Obliczenia na froncie, czyste funkcje** — natychmiastowa reakcja UI (licznik porcji, filtry), łatwe testy; backend przechowuje dane źródłowe, nie wyniki.
4. **Import przez podproces + kolejka w procesie** — izolacja awarii bez dodatkowych usług.
5. **Ręczny service worker i router** — mniej zależności niż Workbox / svelte-routing, a zakres jest mały.
6. **Zdjęcia zmniejszane w przeglądarce (canvas)** — bez Pillow na serwerze; serwer sprawdza tylko typ i rozmiar.
7. **Wartości odżywcze z własnej bazy** — seed 29 produktów z prototypu z wartościami z publicznych tabel; Open Food Facts ewentualnie później jako opcja (za zgodą właściciela).
8. **Domyślny układ wg szerokości 1024 px** — poniżej: widok telefonu (pasek dolny, ekrany pełne); od 1024 px: widok laptopa (pasek boczny, panele). Tablety pionowe dostają widok telefonu.

## 11. Plan etapów (milestones)

1. **M1 Szkielet + CI** — struktura repo, FastAPI + Svelte, migracje, health, tokeny stylu, nawigacja (pasek dolny/boczny), CI z checkiem `ci`, Dockerfile, Makefile.
2. **M2 Przepisy** — baza produktów (seed), lista z wyszukiwaniem i filtrami, szczegóły (makro, porcje, odhaczanie, kroki), dodawanie ręczne + nowy produkt, PDF, zdjęcie.
3. **M3 Planer** — tydzień, sloty, wybór przepisu, dodaj do planera ze szczegółów, cel dzienny i podsumowanie.
4. **M4 Lista zakupów** — wybór dni, agregacja, odhaczanie per tydzień.
5. **M5 Import** — moduł importu yt-dlp, zakładka Link, źródło wideo w szczegółach.
6. **M6 PWA + wdrożenie** — manifest, service worker, ikony, manifesty K8s, e2e pełne.
