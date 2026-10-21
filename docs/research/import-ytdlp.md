# Rozpoznanie techniczne: Moduł importu wideo (yt-dlp)

- **Issue:** [#30](https://github.com/abudabi16955/Planer-przepisow/issues/30) (Moduł importu z Instagrama/Facebooka, M5)
- **Status:** Gotowe do implementacji (Developer)
- **Data:** 2026-10-21
- **Autor:** Researcher — Planer przepisów
- **Kontekst:** `docs/SPEC.md` (p. 3.3, 5.7, 8), `docs/ARCHITECTURE.md` (p. 4)

---

## 1. Wersja yt-dlp i instalacja w środowisku

- **Stabilna wersja do przypięcia w `backend/pyproject.toml`:**
  ```toml
  dependencies = [
      "yt-dlp==2026.8.19",
      # ...
  ]
  ```
  *(Wersja `2026.8.19` jest aktualnym oficjalnym wydaniem stabilnym na PyPI i znajduje się już w `backend/pyproject.toml`).*
- **Czysta instalacja przez `pip` w `venv`:**
  - `yt-dlp` jest dystrybuowany jako pure Python wheel (oraz standardowe pakiety PyPI).
  - Instaluje się całkowicie czysto w wirtualnym środowisku (`venv`), bez potrzeby kompilatorów C (`gcc`) czy nagłówków deweloperskich (`lib*-dev`).
- **Zależności systemowe:**
  - **Jedyną wymaganą binarką systemową jest `ffmpeg`** (do pobierania i łączenia oddzielnych strumieni wideo/audio, remuxingu do MP4 oraz konwersji miniatur do JPEG).
  - W środowisku deweloperskim Ubuntu: `ffmpeg` 8.0.1+ jest już dostępny w `/usr/bin/ffmpeg`.
  - W kontenerze produkcyjnym (`Dockerfile`): wystarczy standardowy pakiet `ffmpeg` z repozytorium Debiana/Ubuntu (`apt-get install -y --no-install-recommends ffmpeg`).

---

## 2. Dokładne opcje CLI dla podprocesu `python -m yt_dlp`

Moduł importu uruchamia proces w trybie izolowanym przez `asyncio.create_subprocess_exec` lub `subprocess.run` (bez `shell=True`).

### Rekomendowane wywołanie CLI:
```bash
python -m yt_dlp \
  --ignore-config \
  --no-cookies \
  --no-cookies-from-browser \
  --no-playlist \
  --socket-timeout 15 \
  --max-filesize 300M \
  -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best" \
  --merge-output-format mp4 \
  --write-thumbnail \
  --convert-thumbnails jpg \
  --write-info-json \
  --no-progress \
  -o "/tmp/planer-import/<job_id>/video.%(ext)s" \
  -- "<URL>"
```

### Szczegółowe uzasadnienie flag:
1. **Format i kodek (`-f ... --merge-output-format mp4`):**
   - Wybiera najlepsze wideo o wysokości $\le 1080\text{p}$ oraz najlepsze audio, preferując natywne formaty MP4/M4A. W przypadku osobnych strumieni `ffmpeg` łączy je w pojedynczy kontener `.mp4`.
2. **Limit rozmiaru (`--max-filesize 300M`):**
   - Zabezpieczenie przed pobieraniem plików przekraczających limit konfiguracji (`MAX_VIDEO_MB=300`). Przerywa pobieranie natychmiast po odczytaniu nagłówka `Content-Length` lub w trakcie pobierania.
3. **Miniatura (`--write-thumbnail --convert-thumbnails jpg`):**
   - Zapisuje okładkę wideo na dysku i za pomocą `ffmpeg` automatycznie konwertuje ją do formatu `.jpg` (nazwa: `video.jpg`).
4. **Metadane (opis i tytuł) — `--write-info-json`:**
   - Zapisuje plik `video.info.json` obok pliku wideo. Jest to znacznie bezpieczniejsze i odporniejsze niż parsowanie `stdout` flagą `--print` (brak problemów ze znakami nowej linii, emotikonami czy uciekaniem znaków).
   - **Instagram:**
     - `description`: pełny opis posta z pola `caption.text`.
     - `title`: tytuł wideo (jeśli nadany przez twórcę) lub domyślny fallback `Video by {uploader}`. W logice biznesowej, jeśli tytuł zaczyna się od `Video by `, pole nazwy przepisu powinno pozostać puste, aby użytkownik sam nadał nazwę (zgodnie ze SPEC 3.3).
   - **Facebook:**
     - `description`: tekst posta (`message.text` / `creation_story` / `savable_description`).
     - `title`: tytuł wideo lub nagłówek (często fallback `Facebook video #{id}`).
5. **Brak ciasteczek i logowania:**
   - `--no-cookies` oraz `--no-cookies-from-browser` gwarantują, że polecenie nie odczyta żadnych lokalnych sesji użytkownika. Nie przekazujemy parametrów `--username` ani `--password`.
6. **Ograniczenie do pojedynczego wideo (`--no-playlist`):**
   - Zapobiega pobieraniu całych kanałów, profili czy serii materiałów.
7. **Szablon nazwy pliku (`-o`):**
   - Pliki lądują w dedykowanym katalogu tymczasowym zadania, np. `/data/files/tmp/<job_id>/video.%(ext)s`, co daje przewidywalne ścieżki: `video.mp4`, `video.jpg`, `video.info.json`.
8. **Timeouts i kontrola wyjścia:**
   - `--socket-timeout 15`: limit 15 sekund na pojedyncze połączenie TCP/HTTP.
   - `--no-progress`: wyłącza animację paska postępu generującą znaki powrotu karetki `\r` na stdout/stderr.
   - `--ignore-config`: ignoruje pliki konfiguracyjne z systemu (`/etc/yt-dlp.conf`, `~/.config/yt-dlp/config`).
   - `--`: separator zapobiegający interpretacji URL zaczynającego się od myślnika jako opcji CLI.

---

## 3. Rozpoznawanie błędów i mapowanie na kody wewnętrzne

Wykonanie podprocesu zwraca kod wyjścia (`returncode`) oraz strumień błędów (`stderr`). Standardowy kod wyjścia przy błędzie yt-dlp to `1` lub `2`.

| Kod błędu aplikacji | Przyczyna / Komunikat yt-dlp (stderr) | Wykrywanie w Pythonie |
|---|---|---|
| **`too_large`** | `File is larger than max-filesize` | Wyszukanie w `stderr`: `larger than max-filesize` lub `File is larger than` |
| **`private_or_missing`** | - `This content is only available for registered users...`<br>- `The webpage request was redirected to the login page`<br>- `Restricted Video`<br>- `login required`<br>- `There is no video in this post`<br>- `Instagram sent an empty media response`<br>- `Video unavailable` / `404 Not Found`<br>- `This content isn't available right now` | Wyszukanie w `stderr` fraz: `login required`, `redirected to the login page`, `only available for registered users`, `Restricted Video`, `empty media response`, `There is no video in this post`, `Video unavailable`, `404`, `isn't available right now` |
| **`timeout`** | Przekroczenie całkowitego limitu czasu zadania (`IMPORT_TIMEOUT_S=120`) lub `socket-timeout` | Przechwycenie wyjątku `asyncio.TimeoutError` / `subprocess.TimeoutExpired` na poziomie procesu Pythona |
| **`unsupported_url`** | Host spoza allowlisty lub nieobsługiwany format linku:<br>- `Unsupported URL`<br>- Walidacja regex / parser URL przed wywołaniem CLI | Sprawdzenie hosta w Pythonie przed uruchomieniem yt-dlp + fraza `Unsupported URL` w `stderr` |
| **`unavailable`** | Błędy sieciowe, blokada IP (HTTP 429 Too Many Requests), awaria serwerów Meta (HTTP 5xx), błąd wewnętrzny ekstraktora | Domyślny fallback przy `returncode != 0`, gdy żaden z powyższych wzorców nie pasuje |

---

## 4. Ograniczenia Instagrama i Facebooka bez logowania

### Znane zachowania:
1. **Blokady IP i rate-limiting:**
   - Meta agresywnie ogranicza zapytania z adresów IP publicznych centrów danych (AWS, Hetzner, GCP). W przypadku przekroczenia limitu anonimowych zapytań serwery zwracają przekierowanie do strony logowania (`The webpage request was redirected to the login page`).
2. **Reels vs standardowe posty:**
   - Instagram Reels (`/reel/<code>`) oraz publiczne posty wideo (`/p/<code>`) działają stabilnie, dopóki konto jest publiczne i nie ma ograniczenia wiekowego (18+).
   - Facebook Reels (`/reel/<id>`) oraz `fb.watch/<id>` to skrócone linki, które yt-dlp rozwiązuje przez HTTP redirect. Czasami Meta wyświetla stronę pośrednią z wymogiem zgody na cookies, co yt-dlp może zinterpretować jako brak wideo.
   - Wersje mobilne `m.facebook.com` są przez yt-dlp automatycznie normalizowane do standardowych identyfikatorów wideo.
3. **Posty karuzelowe (sidecars):**
   - Karuzela na Instagramie jest w yt-dlp traktowana jako playlista (`_type == 'playlist'`).
   - Może zawierać mix zdjęć i filmów lub wyłącznie zdjęcia.

### Co robić z karuzelą bez wideo?
- Zgodnie ze specyfikacją aplikacji (import służy do pozyskania wideo z instrukcją gotowania):
  - Jeśli post karuzelowy zawiera **wyłącznie zdjęcia**, yt-dlp zgłasza brak strumieni (`There is no video in this post`).
  - Importer powinien natychmiast zwrócić błąd z kodem **`unavailable`** lub **`private_or_missing`** z czytelnym komunikatem w UI: *„Ten post zawiera wyłącznie zdjęcia. Dodaj przepis ręcznie.”*.
  - Jeśli karuzela zawiera wideo na dalszym slajdzie (np. slajd 1: zdjęcie potrawy, slajd 2: wideo z przygotowania), dodanie flagi `--playlist-items 1` mogłoby pobrać tylko zdjęcie. Bezpieczniejszym podejściem jest użycie domyślnego mechanizmu yt-dlp, który pobiera pierwsze napotkane wideo z listy.

---

## 5. Ryzyka bezpieczeństwa i zalecenia

1. **Ochrona przed SSRF (Server-Side Request Forgery):**
   - **Ścisła allowlista hostów przed wywołaniem yt-dlp:**
     Backend **musi** zwalidować schemat (`https://`) oraz domenę (wyłącznie `instagram.com`, `www.instagram.com`, `facebook.com`, `www.facebook.com`, `m.facebook.com`, `web.facebook.com`, `fb.watch`).
     Zapobiega to przekierowaniu yt-dlp do sieci wewnętrznej (np. `http://169.254.169.254/` dla AWS metadata czy `http://localhost:8000`).
2. **Zakaz używania niebezpiecznych flag yt-dlp:**
   - **Bezwzględny zakaz:** `--exec`, `--exec-before-dl` (umożliwiają uruchamianie dowolnych poleceń powłoki systemowej).
   - Flaga `--ignore-config`: konieczna, by zapobiec wczytaniu ukrytych plików konfiguracyjnych yt-dlp z katalogu użytkownika lub roboczego.
   - Flaga `--no-check-certificates`: nigdy nie może być włączana.
3. **Bezpieczne wywołanie procesu (brak shell injection):**
   - Uruchamianie **wyłącznie** jako tablica argumentów (`argv` w `subprocess.run` lub `asyncio.create_subprocess_exec`), nigdy przez powłokę (`shell=True` ani `sh -c`).
   - Użycie separatora `--` bezpośrednio przed przekazanym adresem URL, aby adres zaczynający się od znaku `-` nie został zinterpretowany jako przełącznik wiersza poleceń.
4. **Metadane jako czyste dane (Prompt Injection / XSS):**
   - Pobrany opis posta (`description`) i tytuł (`title`) to **dane niezweryfikowane**.
   - Mogą zawierać znaki specjalne, formatowanie, skrypty lub próby prompt injection.
   - Muszą być zapisywane w bazie danych jako zwykły tekst i renderowane w interfejsie użytkownika wyłącznie w formie ucieczkowej (escaped text), bez interpretacji HTML/Markdown ani automatycznego wykonywania.
