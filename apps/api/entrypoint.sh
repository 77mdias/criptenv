#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Running database migrations..."
python scripts/migrate.py

echo "[entrypoint] Starting application..."
exec "$@"
