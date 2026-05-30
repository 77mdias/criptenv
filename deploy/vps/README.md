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
| `docker-compose.yml` | Stack completa da API, scheduler, Redis, PostgreSQL, Cloudflare Tunnel e Watchtower |
| `postgres-config/postgresql.conf` | Configurações otimizadas para 8GB RAM |
| `reset-postgres-new-db.sh` | Reset operacional para recriar um banco PostgreSQL vazio quando não houver dados a preservar |

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
- Criar estrutura em `~/projects/criptenv/deploy/vps/`
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

Ou se o backend também roda em Docker na mesma VPS, use o nome do serviço `postgres`:

```env
DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_GERADA@postgres:5432/criptenv
```

---

## Resetar banco novo

Use este fluxo apenas quando o banco local da VPS pode ser apagado. O script valida que `DATABASE_URL`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` estão consistentes antes de remover o volume do PostgreSQL.

No `deploy/vps/.env`, use uma senha alfanumérica sem caracteres especiais:

```env
DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_NOVA_AQUI@postgres:5432/criptenv
DB_USER=criptenv
DB_PASSWORD=SENHA_NOVA_AQUI
DB_NAME=criptenv
```

Depois rode na VPS:

```bash
cd ~/projects/criptenv/deploy/vps
./reset-postgres-new-db.sh --yes
```

O script para a stack, remove somente o volume PostgreSQL do projeto Compose atual (por exemplo, `vps_postgres_data`), recria o Postgres, testa login real com `psql`, cria o schema inicial a partir dos modelos atuais, marca Alembic como aplicado para esse banco vazio, sobe API/scheduler/serviços auxiliares e valida `/health`.

Não é necessário instalar Python ou Alembic diretamente na VPS. O bootstrap e o `alembic stamp head` rodam dentro da imagem Docker da API via `docker compose run`.

---

## Migrar avatares para Cloudflare R2

Use R2 para remover a dependência do Supabase Storage. O backend faz upload server-side usando a API S3-compatible do R2; o frontend continua chamando `/api/auth/me/avatar`.

### 1. Criar bucket

No Cloudflare Dashboard:

1. Acesse **Storage & databases > R2 > Overview**.
2. Clique em **Create bucket**.
3. Nome sugerido: `criptenv-avatars`.
4. Use **Standard storage** para permanecer no free tier.

### 2. Criar credenciais

No Cloudflare Dashboard:

1. Acesse **Storage & databases > R2 > Overview**.
2. Em **API Tokens**, clique em **Manage**.
3. Crie um token com permissão **Object Read & Write**.
4. Restrinja para o bucket `criptenv-avatars`.
5. Copie o **Access Key ID**, **Secret Access Key** e o endpoint/account id. A secret key não aparece de novo.

### 3. Expor URL pública dos avatares

Preferencialmente conecte um domínio do próprio Cloudflare ao bucket:

1. Abra o bucket `criptenv-avatars`.
2. Vá em **Settings > Public access**.
3. Conecte um custom domain, por exemplo `avatars.77mdevseven.tech`.
4. Use esse domínio como `R2_PUBLIC_URL`.

### 4. Atualizar `.env` da VPS

```env
AVATAR_STORAGE_BACKEND=r2
R2_ACCOUNT_ID=seu-account-id
R2_ACCESS_KEY_ID=sua-access-key-id
R2_SECRET_ACCESS_KEY=sua-secret-access-key
R2_BUCKET=criptenv-avatars
R2_PUBLIC_URL=https://avatars.77mdevseven.tech
```

Remova ou ignore as variáveis `SUPABASE_*` quando `AVATAR_STORAGE_BACKEND=r2`.

### 5. Reiniciar e testar

```bash
cd ~/projects/criptenv/deploy/vps
docker compose up -d api scheduler
docker compose logs --tail=80 api
curl -fsS http://127.0.0.1:8000/health
```

Depois, teste em `/account` fazendo upload de um avatar PNG/JPG. A URL salva no usuário deve começar com `R2_PUBLIC_URL`.

---

## Migração do Supabase

Este passo migra **todos os dados** do seu banco no Supabase para o PostgreSQL local na VPS.

> ⚠️ **ATENÇÃO**: Se você está migrando o banco de **PRODUÇÃO**:
> 1. Faça em horário de baixo tráfego
> 2. Considere parar o backend temporariamente para evitar writes durante o dump
> 3. O processo pode levar minutos dependendo do tamanho do banco

### Opção A: Fazer dump DIRETO na VPS (recomendado — mais rápido)

```bash
ssh usuario@sua-vps
cd ~/projects/criptenv/deploy/vps  # ou onde está o projeto
bash deploy/vps/migrate-from-supabase.sh
```

O script vai perguntar:
1. Se quer fazer dump direto na VPS ou transferir da máquina local
2. A connection string do banco (produção ou desenvolvimento)

### Opção B: Fazer dump na máquina local e transferir

```bash
# NA SUA MÁQUINA LOCAL
pg_dump "postgresql://postgres.xxx:SENHA@host.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --clean --if-exists --create \
  > criptenv_dump.sql

# Transferir para a VPS
scp criptenv_dump.sql usuario@sua-vps:/tmp/criptenv_supabase_dump.sql
```

Na VPS:
```bash
bash deploy/vps/migrate-from-supabase.sh
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
~/projects/criptenv/deploy/vps/backup.sh
```

### Listar backups
```bash
ls -lah ~/projects/criptenv/deploy/vps/backups/
```

### Restaurar de um backup
```bash
# Descompactar
gunzip -c ~/projects/criptenv/deploy/vps/backups/criptenv_backup_20250115_030000.sql.gz > /tmp/restore.sql

# Aplicar
docker exec -i criptenv-postgres psql -U criptenv -d criptenv < /tmp/restore.sql
```

### Reiniciar o PostgreSQL
```bash
cd ~/projects/criptenv/deploy/vps
docker compose restart postgres
```

### Parar completamente
```bash
cd ~/projects/criptenv/deploy/vps
docker compose down
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
cat ~/projects/criptenv/deploy/vps/backups/backup.log
```

### Resetar senha do PostgreSQL
```bash
docker exec -it criptenv-postgres psql -U criptenv -c "ALTER USER criptenv WITH PASSWORD 'nova_senha';"
```
