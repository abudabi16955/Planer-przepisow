# Wdrożenie

## Obraz Dockera (GHCR)

Obraz jest budowany z `Dockerfile` **na żądanie** — nie przy każdym merge do `main`. Publikowany jest do `ghcr.io/abudabi16955/planer-przepisow`.

Jak uruchomić workflow „Obraz”:

- ręcznie: GitHub → Actions → „Obraz” → Run workflow (opcjonalnie pole `tag`, np. `0.1.0`, oraz `latest`);
- wydanie przez tag git: `git tag v0.1.0 && git push origin v0.1.0` (obraz dostaje tagi `0.1.0`, `latest` i `sha-<krótki>`).

Zawsze powstaje tag `sha-<krótki>`. Pełne nazwy opublikowanych tagów są w podsumowaniu przebiegu (Actions → przebieg → Summary). Logowanie do GHCR odbywa się przez `GITHUB_TOKEN`, bez dodatkowych sekretów.

Nowo utworzony pakiet GHCR jest domyślnie prywatny. Aby klaster mógł go pobierać bez `imagePullSecrets`, właściciel ustawia widoczność „public” w ustawieniach pakietu (GitHub → Packages → planer-przepisow → Package settings).

Zwykły job `docker` w `ci.yml` nadal tylko buduje obraz, bez publikacji.
