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

### 2. Configure o Compose na VPS

```bash
ssh usuario@sua-vps
cd /tmp/criptenv-vps
cp .env.example .env
# Edite .env antes de iniciar: senha do Postgres, secrets, R2 e TUNNEL_TOKEN.
docker compose up -d
docker compose ps
```

**Plano dos usuários.** `DEFAULT_PLAN` define o plano de quem não tem um plano próprio. O padrão é `free`: 3 projetos por dono, 3 ambientes, 3 membros e 1 conexão com hospedagem por projeto, 7 dias de auditoria visível, 120 itens e 10 pastas no cofre pessoal. Os outros valores são `pro` (5 ambientes e 10 membros por projeto, 30 dias de auditoria), `max` (7 ambientes, 25 membros, 90 dias, envio automático para a hospedagem) e `unlimited`; a tabela completa está em `apps/api/app/plans.py`. Em uma instalação própria, use `DEFAULT_PLAN=unlimited` para tirar os limites. Quem fica acima de um limite não perde nada: só não cria mais. A troca vale também para usuários antigos. Um valor desconhecido impede a API de subir.

**Deploy depois do envio.** Nos planos `max` e `unlimited`, uma conexão com hospedagem pode pedir um novo deploy depois de cada envio de variáveis. Quem dispara esse deploy é o serviço `scheduler` (job `deploy_due`, a cada 30 segundos). Com o `scheduler` parado, o envio funciona, mas o deploy fica agendado e não sai.

O repositório não contém instalador automático de Docker, gerador de senha ou job de backup. Esses itens devem ser configurados pela operação da VPS.

### 3. Verifique a API

Como API e PostgreSQL rodam no mesmo Compose, use o nome do serviço `postgres` no `deploy/vps/.env`:

```env
DATABASE_URL=postgresql+asyncpg://criptenv:SENHA_GERADA@postgres:5432/criptenv
```

```bash
curl -fsS http://127.0.0.1:8000/health
curl -fsS http://127.0.0.1:8000/health/ready
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

### Opção A: Fazer dump direto na VPS

```bash
ssh usuario@sua-vps
cd ~/projects/criptenv/deploy/vps  # ou onde está o projeto
pg_dump "postgresql://postgres.xxx:SENHA@host.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --clean --if-exists --create \
  > /tmp/criptenv_supabase_dump.sql
```

Restaure o dump no container com `psql` ou `pg_restore`, após validar o destino e manter um backup do banco local.

### Opção B: Fazer dump na máquina local e transferir

```bash
# NA SUA MÁQUINA LOCAL
pg_dump "postgresql://postgres.xxx:SENHA@host.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  --clean --if-exists --create \
  > criptenv_dump.sql

# Transferir para a VPS
scp criptenv_dump.sql usuario@sua-vps:/tmp/criptenv_supabase_dump.sql
```

Na VPS, depois de transferir o arquivo:
```bash
cat /tmp/criptenv_supabase_dump.sql | docker exec -i criptenv-postgres psql -U criptenv -d criptenv
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
docker exec criptenv-postgres pg_dump -U criptenv -d criptenv | gzip > ./backups/criptenv_$(date +%Y%m%d_%H%M%S).sql.gz
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

## Ligar o chat de suporte

O chat das páginas públicas usa a API da Claude (modelo `claude-sonnet-5-5`). Ele vem desligado: sem chave, o botão não aparece.

1. Crie uma chave em https://platform.claude.com (Settings → API keys) e guarde-a também no projeto CriptEnv da aplicação.
2. No `.env` da VPS:

   ```bash
   ANTHROPIC_API_KEY=<chave>
   SUPPORT_DAILY_LIMIT=500   # mensagens por dia, todos os visitantes somados
   ```

3. `docker compose up -d api` e confira: `curl -s https://<sua-api>/api/v1/support/status` responde `{"enabled": true}`.

Cada visitante manda até 20 mensagens por hora. O custo de cada rodada (tokens de entrada, de cache e de saída) aparece no log: `docker compose logs api | grep "support chat round"`. Para desligar, apague a chave e reinicie a API.

Ao mudar a documentação do site (`apps/web/messages/*/docs.json`), rode `python scripts/build_support_docs_index.py` em `apps/api` e faça commit do resultado; um teste falha enquanto o retrato estiver atrasado.

---

## Ativar a cobrança

A assinatura dos planos Pro e Max vem desligada (`BILLING_ENABLED=false`). Instalação própria não precisa de nada disto: deixe desligada e defina o plano de todos com `DEFAULT_PLAN`.

### 1. Webhook no Mercado Pago

No painel de desenvolvedor do Mercado Pago, na aplicação cujas credenciais estão no `.env`, o webhook que já aponta para `https://<sua-api>/webhooks/mercadopago` precisa ter ligados os eventos **Pagamentos** e **Planos e assinaturas**. O segredo é o mesmo `MERCADO_PAGO_WEBHOOK_SECRET`.

### 2. Variáveis no `.env`

```bash
BILLING_NOTIFY_EMAIL=<e-mail que recebe os dados para nota e os avisos de reembolso>
BILLING_ENABLED=true
```

`FRONTEND_URL` precisa ser o endereço público do site, em https: é para lá que o Mercado Pago devolve o cliente depois do pagamento.

### 3. Reiniciar a API e o agendador

```bash
docker compose up -d api scheduler
docker compose logs scheduler | grep billing_cycle
```

O job `billing_cycle` roda de hora em hora no serviço `scheduler`. Sem ele, o plano pago não termina no fim do período, a tolerância de 7 dias não vence e um pagamento cujo webhook se perdeu só é visto quando o cliente abre a tela de assinatura.

### 4. Teste manual antes de vender

Nenhuma chamada real ao Mercado Pago foi feita no desenvolvimento. Faça este roteiro com **contas de teste** do Mercado Pago (uma de vendedor e uma de compradora, do mesmo país; a aplicação fica dentro da conta de vendedor de teste e a API usa as credenciais dela). Pagamento feito com credencial `TEST-` não envia notificação.

1. Assinar o Pro mensal com um cartão de teste. Conferir: o plano muda depois do pagamento (não antes), chegam o e-mail de assinatura confirmada e o e-mail com os dados para nota.
2. Subir para o Max. Conferir: vale na hora, a assinatura do Pro aparece cancelada no Mercado Pago e a devolução proporcional aparece no pagamento do Pro.
3. Cancelar em menos de 7 dias. Conferir: o reembolso integral aparece no Mercado Pago, a conta volta ao Free e a assinatura fica cancelada lá.
4. Assinar um plano anual. Conferir a data da próxima cobrança no Mercado Pago (12 meses).
5. Cancelar uma assinatura pela conta da compradora no Mercado Pago, não pelo CriptEnv. Conferir: o plano continua até o fim do período pago.

Já confirmado no teste de 2026-11-10 (pilha local, token `TEST-` da conta real):

- o cancelamento com `status: "cancelled"` é aceito;
- `localhost` é recusado como endereço de volta (`Invalid value for back_url`): `FRONTEND_URL` precisa ser https público, mesmo em teste (use um túnel como o ngrok);
- com o token `TEST-` de uma conta real, o e-mail do pagador não pode ser de conta de teste (`Both payer and collector must be real or test users`). Com as contas de teste deste roteiro, os dois lados são de teste.

Quando o Mercado Pago recusa uma chamada, o motivo aparece no log da API (`docker compose logs api | grep "Mercado Pago"`, campos `error=` e `message=`).

Anote o que a documentação deles não confirma e o código assume:

- a cobrança a cada 12 meses (`frequency: 12`) é aceita;
- as notificações de assinatura chegam com `type` igual a `subscription_preapproval` ou `subscription_authorized_payment` e o identificador em `data.id`;
- quais meios de pagamento a tela deles oferece (o Pix não renova sozinho).

Se algum desses pontos falhar, desligue com `BILLING_ENABLED=false` e reinicie: nenhum plano muda e nada é apagado. O Mercado Pago continua cobrando as assinaturas que já existem; se for desligar de vez, cancele-as no painel deles.

---

## Segurança

- ✅ PostgreSQL só escuta em `127.0.0.1:5432` (não está exposto à internet)
- ✅ Senha gerada automaticamente com 24 caracteres aleatórios
- ⚠️ O Compose monta `./backups`, mas não agenda backup nem retenção automaticamente; configure e teste isso separadamente.
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
