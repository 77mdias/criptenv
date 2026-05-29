#!/bin/bash
# ===========================================
# CriptEnv — Migração do Supabase para VPS
# Execute na VPS após o PostgreSQL estar rodando
# ===========================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SUPABASE_URL="${SUPABASE_URL:-}"
DUMP_FILE="/tmp/criptenv_supabase_dump.sql"
CONTAINER_NAME="criptenv-postgres"
DB_USER="${DB_USER:-criptenv}"
DB_NAME="${DB_NAME:-criptenv}"

echo -e "${GREEN}=== Migração Supabase → VPS PostgreSQL ===${NC}"
echo ""

# Verificar se está rodando na VPS
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}ERRO: Container ${CONTAINER_NAME} não está rodando na VPS.${NC}"
    echo "Execute o setup-postgres.sh primeiro."
    exit 1
fi

# Se não tiver o dump, instruir o usuário
if [ ! -f "${DUMP_FILE}" ]; then
    echo -e "${YELLOW}Dump não encontrado em ${DUMP_FILE}${NC}"
    echo ""
    echo "Execute na sua máquina LOCAL:"
    echo ""
    echo "pg_dump \"postgresql://postgres.yrsahoovswjlgrnmhghs:SENHA@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true\" \"
    echo "  --clean --if-exists --create > criptenv_dump.sql"
    echo ""
    echo "Depois transfira para a VPS:"
    echo "scp criptenv_dump.sql usuario@sua-vps:/tmp/criptenv_supabase_dump.sql"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ Dump encontrado: ${DUMP_FILE}${NC}"

# Copiar dump para dentro do container
echo -e "${YELLOW}Copiando dump para o container...${NC}"
docker cp "${DUMP_FILE}" "${CONTAINER_NAME}:/tmp/criptenv_dump.sql"

# Dropar e recriar o banco (cuidado: apaga tudo!)
echo -e "${YELLOW}Recriando banco de dados...${NC}"
docker exec "${CONTAINER_NAME}" dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
docker exec "${CONTAINER_NAME}" createdb -U "${DB_USER}" "${DB_NAME}"

# Restaurar o dump
echo -e "${YELLOW}Restaurando dados...${NC}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -f /tmp/criptenv_dump.sql

# Limpar
docker exec "${CONTAINER_NAME}" rm -f /tmp/criptenv_dump.sql

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Migração concluída com sucesso! ✅${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Próximo passo:${NC} Atualize o .env do backend para:"
echo -e "  DATABASE_URL=postgresql+asyncpg://${DB_USER}:SENHA@localhost:5432/${DB_NAME}"
echo ""
