#!/bin/bash
# ===========================================
# CriptEnv — PostgreSQL Setup na VPS
# Execute em: deploy/vps/
# ===========================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

echo -e "${GREEN}=== CriptEnv PostgreSQL Setup ===${NC}"
echo ""

# 1. Verificar docker
if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    echo -e "${YELLOW}Instalando Docker...${NC}"
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker && systemctl start docker
fi

# 2. Criar .env.db com senha se não existir
ENV_FILE=".env.db"
if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}Gerando senha do PostgreSQL...${NC}"
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    cat > "${ENV_FILE}" <<EOF
DB_USER=criptenv
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=criptenv
BACKUP_DIR=./backups
RETENTION_DAYS=14
EOF
    echo -e "${GREEN}✓ .env.db criado. Senha salva no arquivo (não exibida).${NC}"
else
    echo -e "${GREEN}✓ .env.db já existe${NC}"
fi

# 3. Carregar variáveis
export $(grep -v '^#' "${ENV_FILE}" | xargs)

# 4. Criar diretório de backups
mkdir -p backups

# 5. Subir PostgreSQL (usa o docker-compose.yml principal)
echo -e "${YELLOW}Subindo PostgreSQL...${NC}"
docker compose --env-file "${ENV_FILE}" up -d postgres

# 6. Aguardar saúde
echo -e "${YELLOW}Aguardando PostgreSQL...${NC}"
for i in {1..12}; do
    if docker exec criptenv-postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL rodando!${NC}"
        break
    fi
    sleep 2
    [ "$i" -eq 12 ] && { echo "ERRO: PostgreSQL não iniciou"; docker logs criptenv-postgres --tail 20; exit 1; }
done

# 7. Backup automático
CRON_JOB="0 3 * * * cd ${SCRIPT_DIR} && bash backup.sh >> ${SCRIPT_DIR}/backups/backup.log 2>&1"
(crontab -l 2>/dev/null | grep -v "backup.sh" || true) | crontab -
(crontab -l 2>/dev/null; echo "${CRON_JOB}") | crontab -

echo -e "${GREEN}✓ Backup automático configurado${NC}"
echo ""
echo -e "${GREEN}=== Pronto! ===${NC}"
echo ""
echo "Senha está em: ${SCRIPT_DIR}/.env.db"
echo "Para migrar dados do Supabase: bash migrate-from-supabase.sh"
echo "Para subir o backend: docker compose up -d"
echo ""
