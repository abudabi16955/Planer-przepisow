.PHONY: install dev test lint build db-up db-down

install:
	python3 -m venv backend/.venv
	backend/.venv/bin/pip install -e 'backend[dev]'
	npm --prefix frontend ci

dev: db-up
	bash scripts/dev.sh

test:
	backend/.venv/bin/pytest backend/tests
	npm --prefix frontend test

lint:
	backend/.venv/bin/ruff check backend
	backend/.venv/bin/ruff format --check backend
	npm --prefix frontend run lint
	npm --prefix frontend run check

build:
	npm --prefix frontend run build

db-up:
	bash scripts/db.sh up

db-down:
	bash scripts/db.sh down
