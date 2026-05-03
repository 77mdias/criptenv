SHELL := /bin/sh
.DEFAULT_GOAL := help

NPM ?= npm
PYTHON ?= python3
REV ?= -1

WEB_DIR := apps/web
API_DIR := apps/api
CLI_DIR := apps/cli

API_VENV := $(API_DIR)/.venv
CLI_VENV := $(CLI_DIR)/.venv

.PHONY: help install lint test check \
	web-install web-dev web-build web-start web-lint web-check-vinext web-migrate-vinext web-deploy \
	api-install api-dev api-test db-current db-downgrade db-history db-migrate db-revision db-upgrade \
	cli-install cli-test

help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_.-]+:.*## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: web-install api-install cli-install ## Install dependencies for web, api, and cli

lint: web-lint ## Run frontend lint checks

test: api-test cli-test ## Run API and CLI test suites

check: web-check-vinext web-build api-test cli-test ## Run compatibility, build, and test checks

web-install: ## Install frontend dependencies
	cd $(WEB_DIR) && $(NPM) install

web-dev: ## Start the Vinext development server
	cd $(WEB_DIR) && $(NPM) run dev

web-build: ## Build the frontend with Vinext
	cd $(WEB_DIR) && $(NPM) run build

web-start: ## Start the local production server
	cd $(WEB_DIR) && $(NPM) run start

web-lint: ## Run frontend linting
	cd $(WEB_DIR) && $(NPM) run lint

web-check-vinext: ## Run the Vinext compatibility scan
	cd $(WEB_DIR) && $(NPM) run check:vinext

web-migrate-vinext: ## Re-run the Vinext migration helper
	cd $(WEB_DIR) && npx vinext init

web-deploy: ## Deploy the frontend to Cloudflare Workers (requires Wrangler auth)
	cd $(WEB_DIR) && $(NPM) run deploy

$(API_VENV)/bin/python:
	$(PYTHON) -m venv $(API_VENV)

api-install: $(API_VENV)/bin/python ## Create API virtualenv and install dependencies
	$(API_VENV)/bin/pip install --upgrade pip
	$(API_VENV)/bin/pip install -r $(API_DIR)/requirements.txt pytest

api-dev: api-install ## Start the FastAPI development server
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/uvicorn main:app --reload

api-test: api-install ## Run the API test suite
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/python -m pytest tests -q

db-upgrade: api-install ## Apply Alembic migrations to the configured API database
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/alembic -c alembic.ini upgrade head

db-migrate: db-upgrade ## Alias for db-upgrade

db-current: api-install ## Show current Alembic revision for the configured API database
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/alembic -c alembic.ini current

db-history: api-install ## Show Alembic migration history
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/alembic -c alembic.ini history

db-downgrade: api-install ## Downgrade Alembic by REV, default -1
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/alembic -c alembic.ini downgrade $(REV)

db-revision: api-install ## Create an Alembic autogenerate revision; pass MSG="message"
	@test -n "$(MSG)" || (echo 'Usage: make db-revision MSG="describe change"' >&2; exit 1)
	cd $(API_DIR) && $(abspath $(API_VENV))/bin/alembic -c alembic.ini revision --autogenerate -m "$(MSG)"

$(CLI_VENV)/bin/python:
	$(PYTHON) -m venv $(CLI_VENV)

cli-install: $(CLI_VENV)/bin/python ## Create CLI virtualenv and install dependencies
	$(CLI_VENV)/bin/pip install --upgrade pip
	cd $(CLI_DIR) && $(abspath $(CLI_VENV))/bin/pip install -e ".[dev]"

cli-test: cli-install ## Run the CLI test suite
	cd $(CLI_DIR) && $(abspath $(CLI_VENV))/bin/python -m pytest tests -q
