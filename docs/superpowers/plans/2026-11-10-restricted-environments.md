# Ambientes extras e ambientes restritos: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar ambientes extras pelo web, com limite de 3, 5 e 7 por plano, e permitir marcar um ambiente extra como restrito a criador e administradores em toda rota por onde dados de ambiente saem.

**Architecture:** uma coluna `environments.restricted` e um módulo só, `app/services/environment_access.py`, que responde quem alcança qual ambiente. Cada rota que entrega dado de ambiente consulta esse módulo; nenhuma decide sozinha. Para quem não alcança, o ambiente restrito não existe (404 ou ausência na lista).

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic; Next.js, next-intl, Jest, Cypress; CLI em click.

**Spec:** `docs/superpowers/specs/2026-11-10-restricted-environments-design.md`

## Global Constraints

- Limites de ambientes por projeto: Free 3, Pro 5, Max 7, `unlimited` sem limite.
- Alcançam um ambiente restrito: papéis `owner` e `admin`. `developer` e `viewer` não.
- Não podem ser restritos: ambientes chamados `production`, `staging` ou `development`, e o ambiente `is_default`. Resposta 422.
- Um ambiente restrito não pode virar `is_default` (422).
- Token de CI ou chave de API com escopo vazio alcança todos os ambientes **não restritos**; um restrito só é alcançado com o escopo igual ao nome dele.
- Para quem não alcança, a resposta é 404 ou a ausência do item, nunca 403.
- Migração `20261110_0021`, `down_revision = "20261110_0020"`. Ambientes existentes ficam com `restricted = false`.
- Textos em pt-BR, en e es. O Claude nunca lê `.env`.

## Review Focus

1. **Uma rota esquecida:** qualquer resposta da API com id, nome, contagem ou chave de um ambiente restrito para um `developer`.
2. **Credencial sem escopo:** sessão de CI ou chave de API com `environment_scope` vazio lendo ou gravando num ambiente restrito.
3. **Rebaixamento:** administrador rebaixado a desenvolvedor continua lendo por uma chave de API que criou antes.
4. **Tranca errada:** restringir `production`, o ambiente padrão, ou tornar padrão um ambiente restrito.
5. **Plano menor:** conta com 5 ambientes volta ao Free: nada é apagado nem liberado, e o sexto é recusado com 402.

---

### Task 1: Coluna, limites e a regra de acesso

**Files:**
- Create: `apps/api/migrations/versions/20261110_0021_add_restricted_to_environments.py`, `apps/api/app/services/environment_access.py`, `apps/api/tests/test_restricted_environments.py`
- Modify: `apps/api/app/models/environment.py`, `apps/api/app/plans.py`, `apps/api/app/schemas/environment.py`, `apps/api/app/routers/environments.py`, `apps/api/tests/test_plans.py`, `apps/api/tests/test_plan_limits.py`

**Interfaces — Produces:**
- `Environment.restricted: bool` (falso por padrão).
- `environment_access.SEEDED_NAMES = ("production", "staging", "development")`.
- `environment_access.sees_restricted(role: str | None) -> bool` — verdadeiro para `owner` e `admin`.
- `environment_access.can_be_restricted(environment) -> bool`.
- `async environment_access.restricted_ids(db, project_id) -> set[UUID]` — ids dos ambientes restritos do projeto (arquivados incluídos).
- `async environment_access.hidden_ids(db, project_id, role) -> set[UUID]` — vazio para quem alcança; senão `restricted_ids`.
- `environment_access.credential_reaches(environment, scope: str | None) -> bool` — ambiente aberto: escopo vazio ou igual ao nome; restrito: só escopo igual ao nome.
- `EnvironmentCreate.restricted: bool = False`, `EnvironmentUpdate.restricted: bool | None = None`, `EnvironmentResponse.restricted: bool`.
- Rotas de ambiente: criar e alterar validam a marca (422); listar e detalhar escondem o restrito de quem não alcança (404 no detalhe); chave de API passa por `credential_reaches`.

- [ ] **Step 1: testes que falham**

```python
def test_plans_limit_environments_to_3_5_7()            # test_plans.py: LIMITS com 3, 5, 7, None
def test_sees_restricted_only_owner_and_admin()         # owner, admin True; developer, viewer, None False
def test_credential_reaches()                           # aberto+None True; restrito+None False; restrito+nome True; aberto+outro False
async def test_create_restricted_environment_and_admin_sees_it(client)
async def test_developer_does_not_see_a_restricted_environment(client)   # ausente na lista; GET do id -> 404
@pytest.mark.parametrize("name", ["production", "staging", "development"])
async def test_seeded_environments_cannot_be_restricted(client, name)     # PATCH restricted=true -> 422
async def test_default_environment_cannot_be_restricted(client)           # 422
async def test_restricted_environment_cannot_become_default(client)       # 422
async def test_admin_can_open_a_restricted_environment_again(client)      # PATCH restricted=false; developer passa a ver
async def test_pro_stops_at_5_and_max_at_7_environments(db_session)       # check_environments: 402 no sexto e no oitavo
async def test_back_on_free_with_5_keeps_them_and_refuses_the_sixth(db_session)   # Review Focus 5
```

- [ ] **Step 2:** `pytest tests/test_restricted_environments.py tests/test_plans.py -q` → FAIL.
- [ ] **Step 3:** implementar. Migração no formato de `20261110_0019`.
- [ ] **Step 4:** os mesmos testes → PASS; `pytest tests -q` → PASS.
- [ ] **Step 5:** migração nas duas direções num banco descartável no Postgres do E2E (`scripts/migrate.py`, `alembic downgrade -1`, `alembic upgrade head`).
- [ ] **Step 6:** commit `feat(api): ambientes restritos e limite de 3, 5 e 7 ambientes por plano`.

### Task 2: Nenhuma rota entrega o ambiente restrito a quem não alcança

**Files:**
- Modify: `apps/api/app/routers/vault.py`, `rotation.py`, `projects.py` (matriz), `audit.py`, `integrations.py`, `tokens.py`, `apps/api/app/services/overview_service.py`, `apps/api/app/services/rotation_service.py` (se o filtro couber lá)
- Test: `apps/api/tests/test_restricted_environments.py`

**Interfaces — Consumes:** `hidden_ids`, `sees_restricted` (Task 1).

**Regras:** cada rota obtém o papel do membro (já carregado por `check_user_access`) e:
- cofre `pull` e `version`, rotação `status` e `history`: ambiente em `hidden_ids` → 404;
- `secrets/expiring`, matriz, `/me/overview`: itens e colunas de ambientes em `hidden_ids` saem;
- auditoria: linhas com `resource_id` em `hidden_ids` saem (filtro na consulta, para a paginação continuar certa);
- integrações (listar e detalhar): chaves de `auto_sync_targets` em `hidden_ids` saem;
- lista de tokens de CI: tokens com `environment_scope` igual ao nome de um ambiente restrito saem.

- [ ] **Step 1: testes que falham** — um por linha, cada um com um `developer` (não recebe) e um `admin` (recebe):

```python
async def test_vault_pull_and_version_are_404_for_a_developer(client)
async def test_rotation_status_and_history_are_404_for_a_developer(client)
async def test_expiring_list_hides_restricted_items(client)
async def test_matrix_hides_the_restricted_column(client)
async def test_me_overview_hides_the_restricted_environment_and_its_alerts(client)
async def test_audit_hides_events_of_the_restricted_environment(client)
async def test_integrations_hide_bindings_of_the_restricted_environment(client)
async def test_ci_token_list_hides_tokens_scoped_to_it(client)
async def test_demoted_admin_loses_access_at_once(client)        # Review Focus 3 (sessão web)
```

- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** `pytest tests -q` → PASS.
- [ ] **Step 5:** commit `feat(api): rotas de leitura escondem o ambiente restrito`.

### Task 3: Tokens de CI e chaves de API

**Files:**
- Modify: `apps/api/app/middleware/ci_auth.py`, `apps/api/app/middleware/api_key_auth.py`, `apps/api/app/routers/ci.py`, `apps/api/app/routers/vault.py`
- Test: `apps/api/tests/test_restricted_environments.py`

**Interfaces — Consumes:** `credential_reaches` (Task 1).

**Regras:** `require_ci_session_environment` e `require_api_key_environment` passam a decidir por `credential_reaches(environment, scope)`; as duas rotas `/ci/secrets*` também. A chave de API continua agindo como quem a criou: além do escopo, o papel atual do criador precisa alcançar o ambiente.

- [ ] **Step 1: testes que falham**

```python
async def test_unscoped_ci_session_cannot_read_or_write_a_restricted_environment(client)   # Review Focus 2
async def test_ci_session_scoped_to_it_can(client)
async def test_unscoped_api_key_cannot_pull_it_and_does_not_list_it(client)
async def test_api_key_scoped_to_it_can_while_its_creator_is_admin(client)
async def test_api_key_of_a_demoted_admin_stops_reaching_it(client)                        # Review Focus 3
```

- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** `pytest tests -q` → PASS; `ruff check app tests` → limpo.
- [ ] **Step 5:** commit `feat(api): credencial sem escopo não alcança ambiente restrito`.

### Task 4: Web — seção Ambientes, uso do plano e preços

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/settings/_components/environments-panel.tsx` e teste ao lado
- Modify: `apps/web/src/lib/api/client.ts` (`Environment.restricted`, pedido de criação e alteração), `apps/web/src/app/[locale]/(dashboard)/projects/[id]/settings/page.tsx`, `apps/web/src/components/shared/plan-usage.tsx` (chave `environments_per_project`), `apps/web/src/components/shared/env-selector.tsx` (cadeado), `apps/web/messages/{pt-BR,en,es}/{settings,common,marketing}.json`, testes da seção de preços

**Comportamento:** como na spec, seção "Telas". O painel recebe `projectId` e carrega `environmentsApi.list` e `projectsApi.plan`. Nome do ambiente: minúsculas, números e hífen (o mesmo padrão da API). Arquivar pede confirmação e não aparece no ambiente padrão. A opção de restringir não aparece nos três ambientes padrão nem no ambiente padrão do projeto. Ao restringir um ambiente que estava aberto, mostra o aviso de que o que já foi baixado não volta.

- [ ] **Step 1: testes que falham**

```tsx
it("lists the environments with the plan usage")                  // "3 de 5 ambientes"
it("creates a restricted environment")                            // create chamado com {name, display_name, restricted: true}
it("rejects a name the API would refuse")                         // "Banco Admin" -> mensagem, sem chamada
it("blocks creating at the limit and shows the way to the plans") // can_upgrade true
it("offers the restriction only on extra environments")
it("warns when restricting an environment that was open")
it("archives after confirmation and never offers it for the default one")
it("shows a server error without breaking")                       // 402 e 422
// env-selector: it("marks a restricted environment with a lock")
// pricing-section: linha "Ambientes por projeto355" -> "Ambientes por projeto357"
```

- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** `npx jest`, `npm run check:i18n`, `npm run lint`, `npm run build` → sem erros.
- [ ] **Step 5:** commit `feat(web): criar ambientes e restringi-los nas configurações do projeto`.

### Task 5: CLI

**Files:**
- Modify: `apps/cli/src/criptenv/commands/environments.py`, `apps/cli/src/criptenv/api/client.py`
- Test: `apps/cli/tests/test_commands.py` (ou arquivo novo ao lado)

- [ ] **Step 1: testes que falham**

```python
def test_env_create_restricted_sends_the_flag()        # corpo com "restricted": True
def test_env_update_restricted_and_open()              # --restricted -> True; --open -> False; os dois juntos -> erro de uso
def test_env_list_marks_restricted_environments()
```

- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** `pytest -q` e `ruff check` → PASS.
- [ ] **Step 5:** commit `feat(cli): ambientes restritos em env create, update e list`.

### Task 6: E2E e documentação

**Files:**
- Create: `apps/web/cypress/e2e/restricted-environments.cy.ts`
- Modify: `docs/development/CHANGELOG.md`, `docs/superpowers/specs/2026-11-09-subscription-plans-design.md` (linha de ambientes da tabela), documentação da API de ambientes no web se listar os campos

- [ ] **Step 1: E2E** (pilha local, sem interceptar a API de ambientes; o plano da conta é posto como `pro` por interceptação de `/plan` só para o uso na tela, e o limite real é conferido com conta Free)

```ts
it("a free account sees 3 de 3 ambientes and cannot create a fourth")       // 402 também por cy.request
it("an admin creates a restricted environment and a developer never sees it")
// o segundo usuário entra por convite aceito como developer; confere a lista de ambientes pela API e pela tela de segredos
```

Se criar o segundo usuário e o convite pelo Cypress custar mais do que o teste vale, o segundo `it` confere pela API com a sessão do desenvolvedor e isso fica registrado.

- [ ] **Step 2:** suíte Cypress inteira → tudo passa.
- [ ] **Step 3:** documentação.
- [ ] **Step 4:** verificação final: API, CLI, jest, lint, i18n, build.
- [ ] **Step 5:** commit `test(e2e): ambientes restritos; docs`.
