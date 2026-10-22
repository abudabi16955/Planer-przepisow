# Wdrożenie

## Obraz Dockera (GHCR)

Obraz jest budowany z `Dockerfile` **na żądanie** — nie przy każdym merge do `main`. Publikowany jest do `ghcr.io/abudabi16955/planer-przepisow`.

Jak uruchomić workflow „Obraz”:

- ręcznie: GitHub → Actions → „Obraz” → Run workflow (opcjonalnie pole `tag`, np. `0.1.0`, oraz `latest`);
- wydanie przez tag git: `git tag v0.1.0 && git push origin v0.1.0` (obraz dostaje tagi `0.1.0`, `latest` i `sha-<krótki>`).

Zawsze powstaje tag `sha-<krótki>`. Pełne nazwy opublikowanych tagów są w podsumowaniu przebiegu (Actions → przebieg → Summary). Logowanie do GHCR odbywa się przez `GITHUB_TOKEN`, bez dodatkowych sekretów.

Nowo utworzony pakiet GHCR jest domyślnie prywatny. Aby klaster mógł go pobierać bez `imagePullSecrets`, właściciel ustawia widoczność „public” w ustawieniach pakietu (GitHub → Packages → planer-przepisow → Package settings).

Zwykły job `docker` w `ci.yml` nadal tylko buduje obraz, bez publikacji.

## Kubernetes (Helm)

Chart: `deploy/helm/planer-przepisow`. Aplikacja działa w 1 replice (`strategy: Recreate`), pliki użytkownika są na PVC zamontowanym w `/data`, a `DATABASE_URL` pochodzi wyłącznie z Secret. W repo nie ma żadnych haseł.

### Wariant A: baza zewnętrzna

```bash
kubectl create namespace planer
kubectl -n planer create secret generic planer-przepisow-database \
  --from-literal=DATABASE_URL='postgresql://uzytkownik:haslo@host:5432/planer'
helm install planer deploy/helm/planer-przepisow -n planer \
  --set image.tag=0.1.0
```

Zamiast własnego Secretu można podać `--set database.url=...` (chart utworzy Secret), albo wskazać inny Secret przez `database.existingSecret` i `database.secretKey`.

### Wariant B: wbudowany PostgreSQL

```bash
helm install planer deploy/helm/planer-przepisow -n planer --create-namespace \
  --set image.tag=0.1.0 \
  --set postgresql.enabled=true \
  --set backup.enabled=true
```

Chart tworzy StatefulSet `postgres:18` z własnym PVC. Hasło jest losowe, generowane przy instalacji i zachowywane przy `helm upgrade`. Własne hasło: Secret z kluczem `password` i `--set postgresql.auth.existingSecret=<nazwa>`; hasło używane w URL powinno składać się z liter i cyfr.

### Aktualizacja

```bash
helm upgrade planer deploy/helm/planer-przepisow -n planer --reuse-values --set image.tag=0.2.0
```

`image.tag` domyślnie to `appVersion` z `Chart.yaml` (`latest`). Dla przewidywalnych wdrożeń podawaj konkretny tag z workflow „Obraz”. Jeśli pakiet GHCR jest prywatny, utwórz Secret `docker-registry` i podaj go w `imagePullSecrets`.

### Zmienne środowiskowe

Zmienne z `docs/ARCHITECTURE.md` p. 6 trafiają do ConfigMap z `config.*` w `values.yaml` (`APP_TIMEZONE`, `IMPORT_BACKEND`, `IMPORT_TIMEOUT_S`, `MAX_VIDEO_MB`, `MAX_PDF_MB`, `MAX_PHOTO_MB`, `LOG_LEVEL`, `DB_POOL_SIZE`). `DATA_DIR=/data` i `PORT=8000` są stałe.

### Wolumen `/data`

PVC `<release>-planer-przepisow-data` (`persistence.size`, `persistence.storageClass`). Istniejący wolumen: `persistence.existingClaim`. Kontener ma system plików tylko do odczytu; zapisuje wyłącznie do `/data` i `/tmp` (emptyDir). Pliki w `/data` nie są objęte kopią `pg_dump`. Wykonuj ich kopię narzędziami klastra (snapshot wolumenu).

### Ingress

Domyślnie wyłączony: `--set ingress.enabled=true --set ingress.host=planer.example.com --set ingress.className=nginx`, TLS przez `ingress.tls`.

### Kopie zapasowe i odtwarzanie

`backup.enabled=true` tworzy CronJob (`backup.schedule`, domyślnie codziennie 03:00) z `pg_dump --format=custom` na osobny PVC; zostaje `backup.keep` ostatnich kopii. Ręcznie: `kubectl -n planer create job --from=cronjob/<release>-planer-przepisow-backup kopia-reczna`.

Odtwarzanie (przykład dla wbudowanej bazy; pod z PVC kopii lub `kubectl cp` do `psql`/`pg_restore`):

```bash
kubectl -n planer cp kopia.dump <pod-postgresql>:/tmp/kopia.dump
kubectl -n planer exec <pod-postgresql> -- pg_restore --clean --if-exists -U planer -d planer /tmp/kopia.dump
```

### Aktualizacja yt-dlp

yt-dlp jest w obrazie, więc nowa wersja wymaga nowego obrazu: uruchom workflow „Obraz” (Dockerfile instaluje aktualne zależności) i zrób `helm upgrade` z nowym `image.tag`.

### Sprawdzenie chartu lokalnie

```bash
helm lint deploy/helm/planer-przepisow
helm template r deploy/helm/planer-przepisow | kubeconform -strict
```

CI (job `helm`) robi to samo dla wariantu domyślnego i z włączonymi: wbudowanym PostgreSQL, backupem, Ingress.
