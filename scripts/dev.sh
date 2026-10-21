#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
if [[ -f .env ]]; then source .env; fi
set +a
backend/.venv/bin/uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port "${PORT:-8000}" &
backend_pid=$!
cleanup() { kill "$backend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
npm --prefix frontend run dev
