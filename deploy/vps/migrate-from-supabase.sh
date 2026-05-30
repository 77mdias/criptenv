#!/bin/bash
# ===========================================
# CriptEnv — Migração do Supabase para VPS
# Execute na VPS após o PostgreSQL estar rodando
# ===========================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER_NAME="criptenv-postgres"
DB_USER="${DB_USER:-criptenv}"
DB_NAME="${DB_NAME:-criptenv}"
DUMP_FILE="/tmp/criptenv_supabase_dump.sql"

echo -e "${GREEN}=== Migração Supabase → VPS PostgreSQL ===${NC}"
echo ""

# Verificar se PostgreSQL local está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${RED}ERRO: Container ${CONTAINER_NAME} não está rodando.${NC}"
    echo "Execute: cd deploy/vps && bash setup-postgres.sh"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL local está rodando${NC}"
echo ""

# ============================================================================
# ETAPA 1: OBTER O DUMP
# ============================================================================

if [ -f "${DUMP_FILE}" ]; then
    echo -e "${GREEN}✓ Dump encontrado em: ${DUMP_FILE}${NC}"
else
    echo -e "${YELLOW}Dump não encontrado na VPS.${NC}"
    echo ""
    echo "Escolha uma opção:"
    echo ""
    echo -e "  ${BLUE}[1]${NC} Fazer dump DIRETO da VPS (recomendado — mais rápido)"
    echo -e "  ${BLUE}[2]${NC} Fazer dump na minha máquina local e transferir depois"
    echo ""
    read -p "Opção (1 ou 2): " opcao

    if [ "$opcao" = "1" ]; then
        echo ""
        echo -e "${YELLOW}Modo: Dump direto na VPS${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  ATENÇÃO: Você está prestes a fazer dump de um banco de dados.${NC}"
        echo -e "${YELLOW}    Se for PRODUÇÃO, recomendamos parar o backend temporariamente${NC}"
        echo -e "${YELLOW}    ou fazer em horário de baixo tráfego para evitar inconsistências.${NC}"
        echo ""
        read -p "Connection string do Supabase (ex: postgresql://postgres.xxx:senha@host:6543/postgres?pgbouncer=true): " SUPABASE_URL

        if [ -z "$SUPABASE_URL" ]; then
            echo -e "${RED}ERRO: Connection string não pode ser vazia${NC}"
            exit 1
        fi

        # Extrair senha da connection string (postgresql://user:PASS@host...)
        SUPABASE_PASS=$(echo "$SUPABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        if [ -z "$SUPABASE_PASS" ]; then
            echo -e "${YELLOW}Não consegui extrair a senha automaticamente.${NC}"
            read -s -p "Digite a senha do banco Supabase: " SUPABASE_PASS
            echo ""
        fi

        echo -e "${YELLOW}Fazendo dump do Supabase diretamente na VPS...${NC}"
        echo "Isso pode levar alguns minutos dependendo do tamanho do banco..."
        echo ""

        # Usar container temporário do Postgres para ter pg_dump disponível
        docker run --rm --network host \
            -e PGPASSWORD="$SUPABASE_PASS" \
            postgres:15-alpine \
            pg_dump "$SUPABASE_URL" --clean --if-exists --create \
            > "${DUMP_FILE}" 2>/tmp/pg_dump_error.log || {
                echo -e "${RED}ERRO: Falha ao fazer dump do Supabase${NC}"
                echo "Verifique a connection string e se a VPS tem acesso à internet."
                echo "Detalhes do erro:"
                cat /tmp/pg_dump_error.log
                exit 1
            }

        echo -e "${GREEN}✓ Dump concluído: ${DUMP_FILE}${NC}"
        ls -lh "${DUMP_FILE}"

    else
        echo ""
        echo -e "${YELLOW}Instruções para fazer dump na máquina local:${NC}"
        echo ""
        echo "1. Na sua máquina LOCAL, execute:"
        echo "   pg_dump \"SUA_CONNECTION_STRING\" --clean --if-exists --create > criptenv_dump.sql"
        echo ""
        echo "2. Transfira para a VPS:"
        echo "   scp criptenv_dump.sql usuario@sua-vps:/tmp/criptenv_supabase_dump.sql"
        echo ""
        echo "3. Depois execute este script novamente na VPS."
        echo ""
        exit 0
    fi
fi

echo ""

# ============================================================================
# ETAPA 2: RESTAURAR NO POSTGRESQL LOCAL
# ============================================================================

echo -e "${YELLOW}Preparando restore...${NC}"

# Copiar dump para dentro do container
docker cp "${DUMP_FILE}" "${CONTAINER_NAME}:/tmp/criptenv_dump.sql"

# Dropar e recriar o banco (CUIDADO: apaga tudo!)
echo -e "${YELLOW}Recriando banco de dados local...${NC}"
docker exec "${CONTAINER_NAME}" dropdb -U "${DB_USER}" --if-exists "${DB_NAME}"
docker exec "${CONTAINER_NAME}" createdb -U "${DB_USER}" "${DB_NAME}"

# Restaurar o dump
echo -e "${YELLOW}Restaurando dados...${NC}"
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -f /tmp/criptenv_dump.sql

# Limpar arquivo temporário do container
docker exec "${CONTAINER_NAME}" rm -f /tmp/criptenv_dump.sql

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Migração concluída com sucesso! ✅${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Próximo passos:${NC}"
echo "1. Atualize o .env do backend na VPS:"
echo -e "   ${BLUE}DATABASE_URL=postgresql+asyncpg://${DB_USER}:SENHA@localhost:5432/${DB_NAME}${NC}"
echo ""
echo "2. Rode as migrations se necessário:"
echo -e "   ${BLUE}alembic upgrade head${NC}"
echo ""
echo "3. Reinicie o backend"
echo ""

# Perguntar se quer manter ou remover o dump original
read -p "Deseja remover o arquivo de dump temporário (${DUMP_FILE})? [Y/n]: " remove_dump
if [ "$remove_dump" != "n" ] && [ "$remove_dump" != "N" ]; then
    rm -f "${DUMP_FILE}"
    echo -e "${GREEN}✓ Dump temporário removido${NC}"
fi
