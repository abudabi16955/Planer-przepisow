# Planer przepisów

Szkielet aplikacji: FastAPI + PostgreSQL 18 (psycopg 3), Svelte 5 + Vite + TypeScript.

Wymagania lokalne: Python 3.12+, Node 24 / npm 11, `make` oraz PostgreSQL 18
z binariami w `/usr/lib/postgresql/18/bin`. Nie wymaga Dockera ani uprawnień roota.

```sh
make install
cp .env.example .env
make dev
```

Frontend: http://127.0.0.1:5173, API: http://127.0.0.1:8000/api/health.
Vite przekazuje `/api` do backendu na porcie 8000 (przy zmianie `PORT` zmień też proxy).
`make dev` uruchamia własny klaster w `.pgdata/`, port 5433, tylko 127.0.0.1,
rola i baza `planer`. Lokalny klaster używa trust i służy wyłącznie do developmentu.
`Ctrl+C` kończy serwery; `make db-down` zatrzymuje bazę. `make db-up` wznawia ją bez utraty danych.

```sh
make db-up
make lint
make test
make build
backend/.venv/bin/uvicorn app.main:app --app-dir backend
```

Po buildzie backend serwuje frontend i trasy SPA na http://127.0.0.1:8000.
Konfiguracja pochodzi ze zmiennych środowiskowych lub `.env` w bieżącym katalogu;
lista ustawień znajduje się w `.env.example`. Nie zapisuj haseł w repo.
Testy backendu wymagają działającego PostgreSQL: tworzą osobną losową bazę i usuwają
ją po sesji (rola w `DATABASE_URL` musi mieć CREATEDB). Nie używają bazy aplikacji do testów.
Migracje SQL są wykonywane przy starcie w jednej transakcji pod blokadą PostgreSQL.
Health sprawdza połączenie i zapis do `DATA_DIR`; błąd daje HTTP 503.
`/api/config` ujawnia wyłącznie flagę dostępności importu; sam import należy do kolejnego etapu.

CI sprawdza lint, typy, pytest, Vitest, build, Playwright (telefon i laptop) oraz
`docker build`. Zbiorczy check `ci` wymaga sukcesu wszystkich czterech jobów.
Playwright i budowanie Dockera uruchamiamy tylko w CI; lokalnie nie instalujemy
przeglądarek ani pakietów systemowych. Obraz uruchamia aplikację jako UID 10001;
wymaga `DATABASE_URL` do osobnego PostgreSQL oraz zapisywalnego wolumenu `/data`.
