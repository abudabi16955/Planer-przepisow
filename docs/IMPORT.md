# Moduł importu

Backend wybiera implementację przez `IMPORT_BACKEND`: `ytdlp`, `disabled` albo
`fake`. Wersja yt-dlp jest przypięta w `backend/pyproject.toml`; instalacja tylko
w `backend/.venv` przez `make install`. Importer nie korzysta z kont, ciasteczek
przeglądarki ani konfiguracji użytkownika. Przy brakującej lub uszkodzonej
zależności `/api/config` zwraca `import_enabled: false`.

## Kontrakt API

- `POST /api/imports`, JSON `{"url":"https://www.instagram.com/reel/.../"}`:
  odpowiedź `202` zawiera rekord zadania, w tym `id` i `status`.
- `GET /api/imports/{id}`: ten sam rekord, status `queued`, `running`, `done`
  albo `failed`. Nieistniejący identyfikator: `404`.
- `done`: `video` i opcjonalne `thumbnail` mają `path`, `mime_type`, `size_bytes`;
  pliki są dostępne pod `/files/{path}`. Pozostałe pola wyniku to `title`,
  `description`, `platform`, `url`, `size_bytes`, `created_at`.
- `failed`: `error_code` ma wartość `private_or_missing`, `too_large`, `timeout`,
  `unsupported_url` albo `unavailable`. Nieobsługiwany URL jest odrzucany od razu
  przez `422`, wyłączony import przez `503`; obie odpowiedzi mają `detail.code`.
- `POST/PUT /api/recipes` przyjmuje `source_type: "link"` i `import_job_id`.
  Gotowe zadanie można wykorzystać raz: wideo i miniatura są przenoszone do
  katalogów docelowych, a opis, platforma i URL pochodzą z zadania. Własne zdjęcie
  użytkownika ma pierwszeństwo przed miniaturą. Opis jest zwykłym tekstem.

Kolejka ma jednego pracownika; pobieranie działa w podprocesie z limitem
`IMPORT_TIMEOUT_S` i `MAX_VIDEO_MB`. Timeout zabija całą grupę procesu, także
ffmpeg. Przy restarcie zadania `running` przechodzą w `failed/unavailable`,
`queued` są wznawiane. Nieużyte wyniki starsze niż 24 godziny są sprzątane
okresowo z blokadą rekordu; pliki przypięte do przepisów pozostają.

Dozwolone są tylko URL-e HTTPS z hostami wymienionymi w `importers/base.py`.
Skróty `fb.watch` są rozwijane w osobnym podprocesie z walidacją każdego
przekierowania. Ogólny ekstraktor dowolnych stron jest wyłączony.

## Weryfikacja bez sieci

`make test` używa `fake` w testach API oraz lokalnego skryptu zamiast yt-dlp
w testach podprocesu. Nie pobiera postów z serwisów społecznościowych.
Działanie na rzeczywistym publicznym poście wymaga osobnego sprawdzenia
ręcznego z `IMPORT_BACKEND=ytdlp`; dostępność postów i ekstraktorów może się
zmieniać niezależnie od aplikacji.
