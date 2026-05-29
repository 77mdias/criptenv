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

## Migração do Supabase (OPCIONAL)

> ⚠️ **IMPORTANTE**: Seu banco de **produção** no Supabase está funcionando e deve permanecer lá.  
> Este passo serve apenas se você quiser trazer os dados do ambiente de **desenvolvimento** para a VPS.  
> Se quiser começar do zero (banco vazio), **pule esta etapa**.

### Opção A: Fazer dump DIRETO na VPS (recomendado)

O script de migração já está preparado para isso:

```bash
ssh usuario@sua-vps
cd /opt/criptenv  # ou onde você copiou os arquivos
bash migrate-from-supabase.sh
```

O script vai perguntar:
1. Se quer fazer dump direto na VPS ou na máquina local
2. A connection string do banco que você quer migrar (use a do **dev**, não a de produção!)

### Opção B: Fazer dump na máquina local e transferir

```bash
# NA SUA MÁQUINA LOCAL — use a connection string do ambiente de DEV
pg_dump "postgresql://postgres.xxx:SENHA_DEV@host.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --clean --if-exists --create \
  > criptenv_dump.sql

# Transferir para a VPS
scp criptenv_dump.sql usuario@sua-vps:/tmp/criptenv_supabase_dump.sql
```

Na VPS:
```bash
bash migrate-from-supabase.sh
# O script vai encontrar o dump e fazer o restore automaticamente
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
