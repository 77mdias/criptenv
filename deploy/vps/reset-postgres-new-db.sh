#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./reset-postgres-new-db.sh --yes

Danger:
  Deletes the Docker Compose PostgreSQL volume for this VPS stack and
  recreates a blank database from deploy/vps/.env.

Required .env shape:
  DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_ALFANUMERICA@postgres:5432/criptenv
  DB_USER=criptenv
  DB_PASSWORD=SENHA_ALFANUMERICA
  DB_NAME=criptenv
EOF
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  fail "Refusing to reset Postgres without --yes."
fi

[[ -f docker-compose.yml ]] || fail "Run this from deploy/vps."
[[ -f .env ]] || fail "Missing deploy/vps/.env."

read_env_var() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" .env | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

DB_USER="$(read_env_var DB_USER)"
DB_PASSWORD="$(read_env_var DB_PASSWORD)"
DB_NAME="$(read_env_var DB_NAME)"
DATABASE_URL="$(read_env_var DATABASE_URL)"
API_LOCAL_PORT="$(read_env_var API_LOCAL_PORT)"
COMPOSE_PROJECT_NAME="$(read_env_var COMPOSE_PROJECT_NAME)"

: "${DB_USER:?DB_USER is required in .env}"
: "${DB_PASSWORD:?DB_PASSWORD is required in .env}"
: "${DB_NAME:?DB_NAME is required in .env}"
: "${DATABASE_URL:?DATABASE_URL is required in .env}"

[[ "$DB_PASSWORD" =~ ^[A-Za-z0-9]+$ ]] || fail "DB_PASSWORD must be alphanumeric for this reset flow."

expected_url="postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}"
if [[ "$DATABASE_URL" != "$expected_url" ]]; then
  cat >&2 <<EOF
ERROR: DATABASE_URL does not match DB_USER/DB_PASSWORD/DB_NAME.

Expected:
  $expected_url

Current:
  $DATABASE_URL
EOF
  exit 1
fi

project_name="${COMPOSE_PROJECT_NAME:-$(basename "$PWD")}"
volume_name="${project_name}_postgres_data"
container_name="criptenv-postgres"
api_port="${API_LOCAL_PORT:-8000}"

echo "Resetting blank Postgres database for Compose project: $project_name"
echo "Target volume: $volume_name"
echo

docker compose down

if docker volume inspect "$volume_name" >/dev/null 2>&1; then
  docker volume rm "$volume_name"
else
  echo "Volume $volume_name does not exist; continuing."
fi

docker compose up -d postgres

echo "Waiting for $container_name to become healthy..."
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || true)"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  sleep 2
done

status="$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || true)"
[[ "$status" == "healthy" ]] || fail "$container_name did not become healthy. Check: docker compose logs postgres"

docker exec "$container_name" psql -U "$DB_USER" -d "$DB_NAME" -c "select current_user, current_database();"

echo "Bootstrapping blank database schema from API models..."
docker compose run --rm --no-deps --entrypoint python api - <<'PY'
import asyncio

from sqlalchemy import text

from app.database import Base, engine
from app.models import (
    APIKey,
    AuditLog,
    CIToken,
    CISession,
    Environment,
    Project,
    ProjectInvite,
    ProjectMember,
    Session,
    User,
    VaultBlob,
)
from app.models.integration import Integration
from app.models.notification import Notification
from app.models.oauth_account import OAuthAccount
from app.models.secret_expiration import SecretExpiration, SecretRotation


async def main() -> None:
    async with engine.begin() as conn:
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "citext"'))
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()


asyncio.run(main())
print("Blank database schema created.")
PY

echo "Marking Alembic migrations as applied for the bootstrapped blank database..."
docker compose run --rm --no-deps --entrypoint alembic api stamp head

docker compose up -d api scheduler redis cloudflare-tunnel watchtower

echo "Waiting for API health on http://127.0.0.1:${api_port}/health..."
for _ in $(seq 1 60); do
  if curl --max-time 3 -fsS "http://127.0.0.1:${api_port}/health" >/dev/null 2>&1; then
    echo "API health check passed."
    docker compose ps
    docker compose logs --tail=80 api
    exit 0
  fi
  sleep 2
done

docker compose logs --tail=120 api
fail "API health check failed after Postgres reset."
