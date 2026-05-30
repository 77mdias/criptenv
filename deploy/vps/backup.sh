#!/bin/bash
# ===========================================
# CriptEnv — PostgreSQL Backup
# Roda via cron no diretório deploy/vps/
# ===========================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# Carrega variáveis do .env.db
export $(grep -v '^#' .env.db | xargs)

CONTAINER_NAME="criptenv-postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR:-./backups}/criptenv_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR:-./backups}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup..."

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERRO: Container ${CONTAINER_NAME} não está rodando!"
    exit 1
fi

docker exec -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --create \
    | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Limpar backups antigos
find "${BACKUP_DIR:-./backups}" -name "criptenv_backup_*.sql.gz" -mtime +${RETENTION_DAYS:-14} -delete
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Pronto!"
