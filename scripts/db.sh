#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/usr/lib/postgresql/18/bin:$PATH"
cluster="$PWD/.pgdata"
case "${1:-}" in
  up)
    if [[ ! -f "$cluster/PG_VERSION" ]]; then
      initdb -D "$cluster" -U planer --auth-local=trust --auth-host=trust --encoding=UTF8
    fi
    if ! pg_ctl -D "$cluster" status >/dev/null 2>&1; then
      pg_ctl -D "$cluster" -l "$cluster/server.log" -o "-p 5433 -h 127.0.0.1 -k $cluster" -w start
    fi
    if [[ "$(psql -h 127.0.0.1 -p 5433 -U planer -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='planer'")" != 1 ]]; then
      createdb -h 127.0.0.1 -p 5433 -U planer planer
    fi
    ;;
  down)
    if [[ -f "$cluster/PG_VERSION" ]] && pg_ctl -D "$cluster" status >/dev/null 2>&1; then
      pg_ctl -D "$cluster" -m fast -w stop
    fi
    ;;
  *) echo 'Użycie: scripts/db.sh up|down' >&2; exit 1 ;;
esac
