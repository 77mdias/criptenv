# Runbook — Ações de Deploy e Resposta a Incidente (Segurança)

> Escopo: tudo que **não** é resolvido por código e depende de você. As correções
> de código já estão em `main` (PR #43 mergeado + commits subsequentes).
> Ordem sugerida: **A → B → C → D → E**. A seção A é a mais urgente e é sobre
> credenciais que ficaram expostas.

---

## A. Rotação de credenciais expostas (fazer primeiro)

Durante a auditoria, alguns valores apareceram em claro nos logs das ferramentas.
Trate todos como comprometidos e rotacione.

| # | O que | Onde estava | Ação |
|---|-------|-------------|------|
| A1 | `session_token` de sessão web | arquivo `cookies.txt`, **versionado** desde o commit `530a9c5` | Revogar a sessão e forçar re-login (ver A4). O token era de `localhost` e expirava em ~2026-06-07, então provavelmente já expirou — rotacione mesmo assim. |
| A2 | `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | `apps/api/.env` (não versionado) — apareceram no output do agente de auditoria | ✅ **Feito (2026-09-22): revogadas.** Eram chaves de **desenvolvimento** — o `.env` do VPS usa chaves de produção separadas, então **não há ação lá**. Só vale colar as chaves novas em `apps/api/.env` se o dev local usar o backend `r2` para avatares (`AVATAR_STORAGE_BACKEND`), senão o upload local falha. |
| A3 | Demais segredos do `.env` local | `apps/api/.env` (GitHub/Google/Discord OAuth, Resend, Mercado Pago webhook, `SECRET_KEY`, `INTEGRATION_CONFIG_SECRET`) e `apps/web/.env` (URL do Supabase com senha), `duckdns/.duck.sh.swp` (token DuckDNS) | Rotacione o que foi colado em workspace compartilhado: OAuth client secrets, `RESEND_API_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`, senha do banco e o token DuckDNS. Apague o `.swp`. |
| A4 | Sessões ativas de usuários | tabela `sessions` | **Atenção:** agora só guardamos o digest do token, então **todas as sessões existentes param de validar** no deploy. Avise os usuários de um re-login único. Se quiser derrubar tudo proativamente antes: `DELETE FROM sessions;` |

> `SECRET_KEY` e `INTEGRATION_CONFIG_SECRET`: se você rotacionar o
> `INTEGRATION_CONFIG_SECRET`, as configs de integração já cifradas tornam-se
> **irrecuperáveis** (por design). Só rotacione se aceitar recadastrar as
> integrações — veja `docs/project/decisions.md`.

---

## B. Limpar o histórico do Git (os arquivos já saíram do índice)

`cookies.txt` e `.claude/test-user-credentials.md` foram removidos do controle de
versão e adicionados ao `.gitignore`, mas os valores **continuam nos commits
antigos**. Para purgar:

```bash
# Instale a ferramenta (uma vez)
pip install git-filter-repo

# Backup antes de reescrever o histórico
git clone --mirror git@github.com:77mdias/criptenv.git criptenv-backup.git

# Remova os arquivos de TODO o histórico
git filter-repo --invert-paths \
  --path cookies.txt \
  --path .claude/test-user-credentials.md

# Republicar (reescreve o histórico — coordene com quem tem clones/worktrees)
git push --force --all
git push --force --tags
```

> ⚠️ Este repositório tem **muitos worktrees e branches ativas**. Reescrever o
> histórico invalida todos os clones. Faça quando conseguir coordenar
> (ou aceite manter o histórico e apenas rotacionar as credenciais — a rotação da
> seção A já neutraliza o risco prático).

---

## C. Configuração de ambiente ANTES do deploy (checagens que quebram o boot/funcionalidade)

Estas variáveis agora **falham fechado** ou mudam comportamento. Verifique no
`.env` de produção / VPS:

| Variável | Valor exigido | Consequência se estiver errada |
|----------|---------------|--------------------------------|
| `DEBUG` | `false` (ou ausente) | Com `APP_ENV=production` e `DEBUG=true` a **API não inicia** (proposital). Também é o que mantém o cookie `Secure` e `/docs` fechado. |
| `APP_ENV` | `production` | Define o modo produção; documenta a intenção. |
| `CORS_ORIGINS` | lista explícita, ex. `https://criptenv.77mdevseven.tech` | Se contiver `*` a **API não inicia** (proposital, pois `allow_credentials=True`). |
| `MERCADO_PAGO_WEBHOOK_SECRET` | **obrigatório se `PAYMENTS_ENABLED=true`** | O webhook agora **falha fechado**: sem o secret, toda notificação do Mercado Pago recebe **401** e as contribuições param de ser confirmadas. Configure no painel do MP e no ambiente. |
| `RESEND_API_KEY` | obrigatório em produção | Sem ela, e-mails de verificação/reset **não são enviados** (o `dev_token` não aparece mais fora de dev). Usuários não conseguem verificar conta nem redefinir senha. |
| `TRUSTED_PROXIES` | `127.0.0.1,::1` (default) ou o IP do seu proxy/túnel | Define quem pode afirmar `X-Forwarded-For`. Se o proxy chega de outro endereço, inclua-o; senão o rate limit usa o IP do proxy (bucket compartilhado). |
| `FORWARDED_ALLOW_IPS` (gunicorn/uvicorn) | endereço do túnel/proxy | Se `TRUSTED_PROXIES` já cobre o caso, é complementar. Garanta que a API **não** seja alcançável direto por clientes não confiáveis. |
| `POSTGRES_PASSWORD` | obrigatório | O `docker-compose.dev.yml` não tem mais senha default; sem a variável o compose não sobe. |

Verificação rápida local antes de subir (deve **falhar** de propósito):

```bash
cd apps/api
APP_ENV=production DEBUG=true .venv/bin/python -c "from app.config import settings"   # deve dar erro
CORS_ORIGINS='*' .venv/bin/python -c "from app.config import settings"                # deve dar erro
```

---

## D. Impactos de comportamento (avise o time / ajuste produtos)

| Mudança | Efeito | O que fazer |
|---------|--------|-------------|
| Tokens de sessão hasheados | Todos os logins ativos caem | Avisar usuários; re-login único. |
| Gestão de API keys exige `admin` | Antes qualquer usuário autenticado podia criar/listar/revogar | Ajustar automações/scripts que usavam acesso `developer`. |
| Criar convites exige `admin` | Antes `developer` podia convidar | Se o fluxo do time dependia disso, promover quem convida para `admin` (ou reabrir como feature com escopo `viewer`). |
| Listagem de convites não devolve mais `token` | Só a resposta de **criação** traz o token | Se algum cliente externo dependia do token na listagem, ajustar. |
| Login da CLI exige PKCE | Cliente CLI antigo quebra no `/cli/initiate` | **Distribuir a CLI nova** antes/junto; quem tiver versão antiga não consegue logar pelo browser. |
| Device flow usa `user_code` no `/device/authorize` | Contrato mudou | **Deploy API + web juntos**. API nova com web velha (ou vice-versa) quebra o login por device. |
| Rate limit de auth em 5/min por IP | Pode incomodar usuários atrás do mesmo NAT/proxy | Se houver reclamação, ajuste `AUTH_RATE_LIMIT` em `app/middleware/rate_limit.py`. |
| `/openapi.json` não é mais público | Só com `DEBUG=true` | Se você consumia o schema em produção, gere-o no build/CI. |

---

## E. Resposta a incidente — o que as falhas permitiam (revisar dados)

As vulnerabilidades ficaram abertas por um período. Duas delas permitiam **escrita
por terceiros**, então vale uma revisão de dados, não só de código.

1. **API keys (P0-2)** — qualquer usuário autenticado podia criar/revogar chaves de
   **qualquer projeto**. Revise a tabela `api_keys` procurando chaves que ninguém
   do time reconhece (`created_by` diferente dos membros do projeto) e revogue.
   ```sql
   SELECT k.id, k.name, k.prefix, k.created_by, k.project_id, k.created_at
   FROM api_keys k
   LEFT JOIN project_members m
     ON m.project_id = k.project_id AND m.user_id = k.created_by
   WHERE m.id IS NULL AND k.revoked_at IS NULL;
   ```
   Chaves `cek_` só autenticam como o **próprio criador** (não escalam para o
   projeto), mas ainda assim revise.

2. **Integrações (P1-3)** — um admin de outro projeto podia disparar
   `sync`/`validate` usando as credenciais do **seu** provider, empurrando segredos
   escolhidos por ele para o seu Vercel/Railway/Render. Verifique no painel do
   provider se houve variáveis inesperadas e revise o audit log:
   ```sql
   SELECT created_at, user_id, action, resource_id, metadata
   FROM audit_logs
   WHERE action LIKE 'integration.%'
   ORDER BY created_at DESC;
   ```
   Qualquer `user_id` que não seja membro do projeto é sinal de alerta.

3. **Convites (P2-10/P2-11)** — tokens de convite eram legíveis por qualquer
   membro (inclusive `viewer`). Revise convites pendentes desconhecidos e revogue:
   `SELECT * FROM project_invites WHERE accepted_at IS NULL AND revoked_at IS NULL;`

4. **Rotação de segredos (P1-8)** — a rotação estava silenciosamente quebrada.
   Qualquer segredo rotacionado pelo dashboard web nesse período **não foi de fato
   rotacionado** (e pode estar indecifrável). Refaça a rotação dos segredos que
   passaram por esse fluxo depois do deploy da correção.

5. **Reset de senha (P1-4)** — se `RESEND_API_KEY` esteve ausente em produção, o
   token de reset era devolvido na resposta. Considere forçar reset de senha para
   contas sensíveis e revisar `password_reset_tokens`:
   ```sql
   SELECT user_id, created_at, used_at FROM password_reset_tokens
   ORDER BY created_at DESC LIMIT 100;
   ```

---

## F. Higiene operacional contínua

- **Scanner de segredos**: o `.gitleaks.toml` agora estende as regras default. O
  próximo run do workflow `security` vai passar a **detectar** coisas que antes
  ignorava — esteja pronto para triar os achados (inclusive falsos positivos).
- **Logs de acesso**: tokens de convite e de reset trafegam em query string e
  aparecem no access log do gunicorn. Reduza no formato do log ou na borda
  (ex.: remover `?query` do log, ou mascarar via Cloudflare).
- **Testes desatualizados**: `testsprite_tests/TC002..TC010` ainda esperam
  `session_token` no corpo do login (comportamento pré-CR-01). Devem ser ajustados
  para ler o cookie, senão essa suíte falha e polui o relatório.
- **Dependências**: o `apps/web` ainda tem 2 erros de tipo pré-existentes
  (`variant="outline"` não existe no componente `Button`) — vale corrigir.

---

## G. Smoke test pós-deploy (checklist rápido)

1. `GET /health/ready` → `{"status":"ready"}`.
2. Login na dashboard → cookie `session_token` presente com `Secure` + `HttpOnly`
   (verifique em produção HTTPS).
3. `/docs` e `/openapi.json` → **404** (DEBUG desligado).
4. Criar um convite como `admin` → resposta traz `token`; **listar** convites →
   resposta **sem** `token`.
5. Login pela CLI nova (`criptenv login`) → abre browser, autoriza e volta.
6. Login por device (`criptenv login --device`) → a URL abre com `?user_code=`.
7. Webhook do Mercado Pago (sandbox) → **200**; sem `X-Signature` → **401**.
8. `POST /api/auth/signin` 6 vezes seguidas do mesmo IP → a 6ª deve dar **429**.
