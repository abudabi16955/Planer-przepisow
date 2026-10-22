# PWA i powłoka offline

Manifest i ikony są w `frontend/public`. Service worker powstaje podczas
`make build`: niewielki plugin w `frontend/pwa.ts` zbiera pliki z katalogu
wynikowego i nadaje cache nazwę zależną od ich zawartości oraz kodu workera.
Nie ma dodatkowych zależności ani ręcznego numeru wersji do podbijania.

Rejestracja działa tylko w buildzie produkcyjnym. Wymagany jest HTTPS
(w środowisku deweloperskim przeglądarki dopuszczają również localhost).
Aplikacja działa pod adresem głównym `/`, zgodnie z istniejącym routerem.

Cache obejmuje HTML powłoki, JS, CSS, lokalne fonty, manifest i ikony.
Nawigacja próbuje sieci, a przy braku połączenia korzysta z zapisanej powłoki.
Tylko pliki wymienione w buildzie mogą być odczytane z cache. Żądania `/api`,
`/files`, operacje zapisu, żądania Range i obce domeny omijają workera.
Nie ma trybu offline dla danych: bez sieci akcje zgłaszają
„Brak połączenia z serwerem.”.

Nowy worker instaluje się dopiero po pobraniu kompletnej powłoki. Aktywacja
usuwa poprzednie cache `planer-shell-*`, zachowując inne cache tej domeny.
Przejęcie przez nową wersję przeładowuje otwartą aplikację jeden raz; pierwsze
uruchomienie nie wymusza przeładowania. Rejestracja omija cache HTTP przy
sprawdzaniu workera, a powrót do okna inicjuje sprawdzenie aktualizacji.

Zdjęcia są już zmniejszane przed uploadem do maksymalnie 2000 px na dłuższym
boku (`frontend/src/lib/photo.ts`), z zachowaniem proporcji.

Weryfikacja: `make lint`, `make test`, `make build`; testy polityki cache,
wersjonowania i rejestracji są w `pwa.test.ts`. E2E `offline.spec.ts` w CI
sprawdza powłokę bez sieci, błąd zapisu oraz brak danych API/plików w cache
na obu viewportach. Instalacja przez interfejs konkretnego telefonu lub
przeglądarki wymaga osobnego sprawdzenia ręcznego.
