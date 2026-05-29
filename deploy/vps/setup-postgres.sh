#!/bin/bash
# ===========================================
# CriptEnv — PostgreSQL Setup na VPS
# Execute na VPS com: bash setup-postgres.sh
# ===========================================

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/criptenv"

echo -e "${GREEN}=== CriptEnv PostgreSQL Setup ===${NC}"
echo ""

# 1. Verificar se Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker não encontrado. Instalando...${NC}"
    curl -fsSL https://get.docker.com | bash
    systemctl enable docker
    systemctl start docker
    usermod -aG docker "${USER}" || true
    echo -e "${GREEN}Docker instalado com sucesso!${NC}"
else
    echo -e "${GREEN}✓ Docker já está instalado${NC}"
fi

# 2. Verificar se Docker Compose está disponível
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose não encontrado!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose disponível${NC}"

# 3. Criar diretório de instalação
mkdir -p "${INSTALL_DIR}/backups"
cd "${INSTALL_DIR}"

# 4. Copiar arquivos (assumindo que você enviou os arquivos da pasta deploy/vps/)
if [ -f "${SCRIPT_DIR}/docker-compose.db.yml" ]; then
    cp "${SCRIPT_DIR}/docker-compose.db.yml" "${INSTALL_DIR}/docker-compose.db.yml"
    cp -r "${SCRIPT_DIR}/postgres-config" "${INSTALL_DIR}/"
    cp "${SCRIPT_DIR}/backup.sh" "${INSTALL_DIR}/backup.sh"
    chmod +x "${INSTALL_DIR}/backup.sh"
    echo -e "${GREEN}✓ Arquivos copiados para ${INSTALL_DIR}${NC}"
else
    echo -e "${RED}ERRO: docker-compose.db.yml não encontrado!${NC}"
    echo "Certifique-se de copiar a pasta deploy/vps/ para a VPS antes de rodar este script."
    exit 1
fi

# 5. Configurar variáveis de ambiente
ENV_FILE="${INSTALL_DIR}/.env.db"
if [ ! -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}Criando arquivo de ambiente...${NC}"
    DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
    
    cat > "${ENV_FILE}" <<EOF
# PostgreSQL Configuration
DB_USER=criptenv
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=criptenv

# Backup Configuration
BACKUP_DIR=/opt/criptenv/backups
RETENTION_DAYS=14
EOF
    
    echo -e "${GREEN}✓ Arquivo .env.db criado em ${ENV_FILE}${NC}"
    echo -e "${YELLOW}⚠️  SENHA GERADA: ${DB_PASSWORD}${NC}"
    echo -e "${YELLOW}   GUARDE ESSA SENHA! Você precisará dela para conectar.${NC}"
else
    echo -e "${GREEN}✓ Arquivo .env.db já existe${NC}"
fi

# Carregar variáveis
export $(grep -v '^#' "${ENV_FILE}" | xargs)

# 6. Subir PostgreSQL
echo ""
echo -e "${YELLOW}Subindo PostgreSQL...${NC}"

if docker compose version &> /dev/null; then
    docker compose -f docker-compose.db.yml --env-file "${ENV_FILE}" up -d
else
    docker-compose -f docker-compose.db.yml --env-file "${ENV_FILE}" up -d
fi

# 7. Aguardar inicialização
echo -e "${YELLOW}Aguardando PostgreSQL iniciar...${NC}"
sleep 5

# Verificar saúde
for i in {1..12}; do
    if docker exec criptenv-postgres pg_isready -U "${DB_USER}" -d "${DB_NAME}" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL está rodando e saudável!${NC}"
        break
    fi
    echo -n "."
    sleep 2
    
    if [ "$i" -eq 12 ]; then
        echo -e "${RED}ERRO: PostgreSQL não iniciou corretamente${NC}"
        docker logs criptenv-postgres --tail 20
        exit 1
    fi
done

# 8. Configurar backup automático (cron)
echo ""
echo -e "${YELLOW}Configurando backup automático...${NC}"
CRON_JOB="0 3 * * * ${INSTALL_DIR}/backup.sh >> ${INSTALL_DIR}/backups/backup.log 2>&1"

# Remover job anterior se existir
(crontab -l 2>/dev/null | grep -v "backup.sh" || true) | crontab -
# Adicionar novo job
(crontab -l 2>/dev/null; echo "${CRON_JOB}") | crontab -

echo -e "${GREEN}✓ Backup automático configurado (diário às 03:00)${NC}"

# 9. Informações finais
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PostgreSQL instalado com sucesso! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Informações de conexão:${NC}"
echo -e "  Host:     localhost (127.0.0.1:5432)"
echo -e "  Database: ${DB_NAME}"
echo -e "  User:     ${DB_USER}"
echo -e "  Password: ${DB_PASSWORD}"
echo ""
echo -e "${YELLOW}Para conectar pela VPS:${NC}"
echo -e "  psql -h localhost -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo -e "${YELLOW}Para ver logs:${NC}"
echo -e "  docker logs -f criptenv-postgres"
echo ""
echo -e "${YELLOW}Para fazer backup manual:${NC}"
echo -e "  ${INSTALL_DIR}/backup.sh"
echo ""
echo -e "${YELLOW}Para parar:${NC}"
echo -e "  docker compose -f ${INSTALL_DIR}/docker-compose.db.yml down"
echo ""
echo -e "${YELLOW}Banco de dados criado (vazio) e pronto para uso!${NC}"
echo ""
echo -e "${YELLOW}Próximo passo:${NC} Atualize o DATABASE_URL do seu backend:"
echo -e "  ${GREEN}postgresql+asyncpg://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}${NC}"
echo ""
echo -e "${YELLOW}Se quiser trazer dados de outro banco (ex: Supabase DEV):${NC}"
echo -e "  ${GREEN}bash migrate-from-supabase.sh${NC}"
echo ""
