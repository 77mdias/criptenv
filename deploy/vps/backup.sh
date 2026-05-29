#!/bin/bash
# ===========================================
# CriptEnv — PostgreSQL Backup Script
# Roda via cron: 0 3 * * * /opt/criptenv/backup.sh
# ===========================================

set -euo pipefail

# Configurações
CONTAINER_NAME="criptenv-postgres"
DB_NAME="${DB_NAME:-criptenv}"
DB_USER="${DB_USER:-criptenv}"
BACKUP_DIR="${BACKUP_DIR:-/opt/criptenv/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/criptenv_backup_${TIMESTAMP}.sql.gz"

# Criar diretório se não existir
mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup do PostgreSQL..."

# Verificar se container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERRO: Container ${CONTAINER_NAME} não está rodando!"
    exit 1
fi

# Executar pg_dump dentro do container
docker exec -e PGPASSWORD="${DB_PASSWORD}" "${CONTAINER_NAME}" \
    pg_dump -U "${DB_USER}" -d "${DB_NAME}" --clean --if-exists --create \
    | gzip > "${BACKUP_FILE}"

# Verificar se o backup foi gerado corretamente
if [ ! -f "${BACKUP_FILE}" ] || [ ! -s "${BACKUP_FILE}" ]; then
    echo "ERRO: Falha ao gerar backup!"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup concluído: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Remover backups antigos
DELETED=$(find "${BACKUP_DIR}" -name "criptenv_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "${DELETED}" -gt 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${DELETED} backup(s) antigo(s) removido(s) (>${RETENTION_DAYS} dias)"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup finalizado com sucesso!"
