# CriptEnv — PostgreSQL na VPS (Docker)

Stack otimizada para rodar PostgreSQL 15 em uma VPS com Docker.

## Specs recomendadas

- **RAM**: 8GB+ (otimizado para usar até 3GB para o Postgres)
- **CPU**: 2+ vCPUs
- **Storage**: 20GB+ livres (NVMe/SSD recomendado)
- **OS**: Ubuntu 22.04+ / Debian 12+

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `docker-compose.db.yml` | Stack do PostgreSQL + volumes + rede |
| `postgres-config/postgresql.conf` | Configurações otimizadas para 8GB RAM |
| `backup.sh` | Script de backup diário com retenção |
| `setup-postgres.sh` | Script completo de instalação automatizada |

## Instalação Rápida

### 1. Copie os arquivos para a VPS

```bash
# Na sua máquina local, dentro do projeto
rsync -avz deploy/vps/ usuario@sua-vps:/tmp/criptenv-vps/
```

### 2. Execute o setup na VPS

```bash
ssh usuario@sua-vps
cd /tmp/criptenv-vps
bash setup-postgres.sh
```

O script vai:
- Instalar Docker (se não tiver)
- Criar estrutura em `/opt/criptenv/`
- Gerar senha segura automaticamente
- Subir o PostgreSQL
- Configurar backup automático (diário às 03:00)

### 3. Anote a senha gerada

O script exibe a senha no final. Guarde com segurança!

### 4. Atualize o backend

Edite o `.env` do seu backend (`apps/api/.env`):

```env
DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_GERADA@localhost:5432/criptenv
```

Ou se o backend também roda em Docker na mesma VPS, use o nome do serviço:

```env
DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_GERADA@criptenv-postgres:5432/criptenv
```

---

## Migração do Supabase

### 1. Faça o dump do Supabase

```bash
# Na sua máquina local
pg_dump "postgresql://postgres.yrsahoovswjlgrnmhghs:77mdevOpsCMD@aws-1-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --clean --if-exists --create \
  > criptenv_dump.sql
```

### 2. Transfira para a VPS

```bash
scp criptenv_dump.sql usuario@sua-vps:/tmp/
```

### 3. Restaure no PostgreSQL local

```bash
ssh usuario@sua-vps

# Copiar dump para dentro do container
docker cp /tmp/criptenv_dump.sql criptenv-postgres:/tmp/criptenv_dump.sql

# Executar restore
docker exec -i criptenv-postgres psql -U criptenv -d criptenv -f /tmp/criptenv_dump.sql

# Ou se quiser dropar e recriar o banco primeiro:
docker exec criptenv-postgres dropdb -U criptenv --if-exists criptenv
docker exec criptenv-postgres createdb -U criptenv criptenv
docker exec -i criptenv-postgres psql -U criptenv -d criptenv -f /tmp/criptenv_dump.sql
```

### 4. Rode as migrations do Alembic (se necessário)

```bash
cd /caminho/do/backend
source .venv/bin/activate
alembic upgrade head
```

---

## Comandos Úteis

### Ver logs
```bash
docker logs -f criptenv-postgres
```

### Acessar o banco via psql
```bash
docker exec -it criptenv-postgres psql -U criptenv -d criptenv
```

### Status do container
```bash
docker stats criptenv-postgres
```

### Backup manual
```bash
/opt/criptenv/backup.sh
```

### Listar backups
```bash
ls -lah /opt/criptenv/backups/
```

### Restaurar de um backup
```bash
# Descompactar
gunzip -c /opt/criptenv/backups/criptenv_backup_20250115_030000.sql.gz > /tmp/restore.sql

# Aplicar
docker exec -i criptenv-postgres psql -U criptenv -d criptenv < /tmp/restore.sql
```

### Reiniciar o PostgreSQL
```bash
cd /opt/criptenv
docker compose -f docker-compose.db.yml restart
```

### Parar completamente
```bash
cd /opt/criptenv
docker compose -f docker-compose.db.yml down
```

---

## Segurança

- ✅ PostgreSQL só escuta em `127.0.0.1:5432` (não está exposto à internet)
- ✅ Senha gerada automaticamente com 24 caracteres aleatórios
- ✅ Backups automáticos com retenção de 14 dias
- ✅ Restart automático do container
- ✅ Healthcheck configurado

Se precisar acessar o banco remotamente, use um **SSH tunnel** em vez de expor a porta:

```bash
# Na sua máquina local
ssh -L 5433:localhost:5432 usuario@sua-vps
# Agora acesse em localhost:5433
```

---

## Troubleshooting

### Container não inicia
```bash
docker logs criptenv-postgres --tail 50
```

### Espaço em disco cheio
```bash
docker system prune -f          # Limpar cache Docker
docker volume prune -f          # Limpar volumes não usados
```

### Backup falhando
```bash
cat /opt/criptenv/backups/backup.log
```

### Resetar senha do PostgreSQL
```bash
docker exec -it criptenv-postgres psql -U criptenv -c "ALTER USER criptenv WITH PASSWORD 'nova_senha';"
```
