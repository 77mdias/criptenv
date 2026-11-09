# Planos e limites (entrega 1 de 3) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os planos `pro` e `max` existem no servidor e os limites de projetos, ambientes, membros, conexões e histórico de auditoria são aplicados e mostrados no web. Nada é vendido ainda: `users.plan` é alterado à mão no banco.

**Architecture:** `app/plans.py` continua sendo o único lugar que diz o que cada plano permite. Um serviço novo, `PlanLimits`, conta o uso e levanta `PlanLimitReached` (402); os routers que criam coisas chamam o serviço antes de inserir. Tudo que é por projeto usa o plano do **dono do projeto**. O web lê limites e uso de dois endpoints e mostra uso e aviso com um componente só.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest; Next.js 16, React 19, next-intl, Jest, Cypress.

**Spec:** `docs/superpowers/specs/2026-11-09-subscription-plans-design.md` (seções "Os planos", "De quem é o plano que vale", "Conta acima do limite", "Mão única" e item 1 de "Ordem de entrega").

## Global Constraints

- Limites, copiados da spec:

  | Chave | free | pro | max | unlimited |
  |---|---|---|---|---|
  | `projects` | 3 | None | None | None |
  | `environments_per_project` | 3 | None | None | None |
  | `members_per_project` | 3 | 10 | 25 | None |
  | `integrations_per_project` | 1 | None | None | None |
  | `audit_retention_days` | 7 | 30 | 90 | None |
  | `personal_vault_items` | 120 | None | None | None |
  | `personal_vault_folders` | 10 | None | None | None |

- Limite atingido responde **402** com `{"detail": "..."}`. Mensagens da API em inglês, como as demais.
- Acima do limite, **ler, editar, exportar e apagar continuam funcionando**. Nada é apagado, arquivado nem escondido. Só criar é bloqueado.
- Auditoria fora da janela não aparece na listagem, mas **não é apagada** do banco.
- Segurança não muda por plano. Nenhuma rota de leitura ou de cofre ganha checagem de plano.
- `DEFAULT_PLAN=unlimited` (self-host) não tem limite nenhum.
- Fora desta entrega: cobrança, página de preços, tela de assinatura, atalho "assinar", envio automático, deploy, bloqueio de sync por CI. Os avisos de limite **não** mencionam upgrade nem preço.
- Web em pt-BR, en e es. Toda chave nova entra nos três `apps/web/messages/*/`.
- Sem chamada real a provedores de hospedagem em teste.
- Commits em português, no formato dos últimos (`feat(api): ...`, `feat(web): ...`, `test(e2e): ...`, `docs: ...`).
- Antes de cada commit do web: `git checkout -- apps/web/package-lock.json` se o stack Docker estiver rodando.

## Review Focus

1. **Repetição de um "criar" no limite** (resposta perdida, usuário clica de novo): quem já criou o ambiente ou o convite deve receber o 409 de duplicado, não 402. → teste na Task 3.
2. **Convite aceito depois que o dono desceu de plano:** aceitar não pode estourar o limite, e o convite recusado por limite continua pendente, não é consumido. → teste na Task 3.
3. **Convites vencidos ou revogados e ambientes arquivados** não ocupam vaga. → testes na Task 2.
4. **Paginação da auditoria com janela:** `total` conta só o que está dentro da janela, senão a última página vem vazia. → teste na Task 4.
5. **Plano sem uma das chaves de limite** (`plan.limits[key]` vira KeyError e 500 em toda criação): todo plano em `PLANS` tem todas as chaves. → teste na Task 1.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/app/plans.py` (modificar) | Chaves de limite e de recurso, planos `pro` e `max` |
| `apps/api/app/strategies/exceptions.py` (modificar) | `PlanLimitReached` |
| `apps/api/app/services/plan_limits.py` (criar) | Contar uso, comparar com o plano do dono, janela de auditoria |
| `apps/api/main.py` (modificar) | Handler que transforma `PlanLimitReached` em 402 |
| `apps/api/app/routers/{projects,environments,members,invites,integrations,audit,me}.py` (modificar) | Chamar `PlanLimits` |
| `apps/api/app/services/audit_service.py` (modificar) | Parâmetro `since` |
| `apps/api/app/schemas/plan.py` (modificar) | Campo `usage` |
| `apps/api/tests/conftest.py` (modificar) | Fixtures de banco em memória compartilhadas |
| `apps/api/tests/test_plan_limits.py` (criar) | Testes do serviço e das rotas |
| `apps/web/src/lib/api/{client,me,projects,personal-vault}.ts` (modificar) | Tipos do plano, `projectsApi.plan`, `isPlanLimitError` |
| `apps/web/src/components/shared/plan-usage.tsx` (criar) | Linha de uso e aviso de limite |
| `apps/web/src/components/shared/one-way-sync-notice.tsx` (criar) | Aviso de mão única |
| `apps/web/messages/{pt-BR,en,es}/{common,integrations,audit}.json` (modificar) | Textos |

---

### Task 1: Tabela de planos

**Files:**
- Modify: `apps/api/app/plans.py`, `apps/api/.env.example:120-121`, `deploy/vps/.env.example` (mesmo comentário)
- Test: `apps/api/tests/test_plans.py`

**Interfaces:**
- Produces: constantes `PROJECTS = "projects"`, `ENVIRONMENTS_PER_PROJECT = "environments_per_project"`, `MEMBERS_PER_PROJECT = "members_per_project"`, `INTEGRATIONS_PER_PROJECT = "integrations_per_project"`, `AUDIT_RETENTION_DAYS = "audit_retention_days"`; recursos `AUTO_SYNC = "auto_sync"`, `SYNC_REDEPLOY = "sync_redeploy"`, `CI_SYNC = "ci_sync"`; `PLANS` com `free`, `pro`, `max`, `unlimited`.

- [ ] **Step 1: Escrever os testes que falham** em `tests/test_plans.py`

```python
from app.plans import PLANS, AUTO_SYNC, CI_SYNC, SYNC_REDEPLOY

LIMITS = {
    "free":      {"projects": 3, "environments_per_project": 3, "members_per_project": 3, "integrations_per_project": 1, "audit_retention_days": 7, "personal_vault_items": 120, "personal_vault_folders": 10},
    "pro":       {"projects": None, "environments_per_project": None, "members_per_project": 10, "integrations_per_project": None, "audit_retention_days": 30, "personal_vault_items": None, "personal_vault_folders": None},
    "max":       {"projects": None, "environments_per_project": None, "members_per_project": 25, "integrations_per_project": None, "audit_retention_days": 90, "personal_vault_items": None, "personal_vault_folders": None},
    "unlimited": dict.fromkeys(["projects", "environments_per_project", "members_per_project", "integrations_per_project", "audit_retention_days", "personal_vault_items", "personal_vault_folders"]),
}

def test_plans_match_the_spec_table():
    assert {plan_id: dict(plan.limits) for plan_id, plan in PLANS.items()} == LIMITS

def test_every_plan_has_every_limit_key():
    keys = set(LIMITS["free"])
    assert all(set(plan.limits) == keys for plan in PLANS.values())

def test_only_max_and_unlimited_have_sync_features():
    everything = {AUTO_SYNC, SYNC_REDEPLOY, CI_SYNC}
    assert PLANS["free"].features == PLANS["pro"].features == frozenset()
    assert PLANS["max"].features == PLANS["unlimited"].features == everything
```

Atualizar também o `parametrize` existente de `/me/plan` neste arquivo para os novos `limits` (o campo `usage` entra na Task 5).

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/api && python -m pytest tests/test_plans.py -v` → FAIL (ImportError de `AUTO_SYNC`).
- [ ] **Step 3: Implementar** as constantes e as quatro entradas de `PLANS` em `app/plans.py`. Atualizar a docstring do módulo (planos pagos já existem; quem escreve `users.plan` será o serviço de assinatura). Nos dois `.env.example`, o comentário de `DEFAULT_PLAN` passa a listar `free, pro, max, unlimited`.
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_plans.py tests/test_personal_vault.py -v` → PASS.
- [ ] **Step 5: Commit** — `feat(api): planos pro e max e novas chaves de limite`

---

### Task 2: Serviço `PlanLimits`

**Files:**
- Create: `apps/api/app/services/plan_limits.py`
- Modify: `apps/api/app/strategies/exceptions.py`, `apps/api/main.py`, `apps/api/tests/conftest.py`, `apps/api/tests/test_personal_vault.py`
- Test: `apps/api/tests/test_plan_limits.py`

**Interfaces:**
- Consumes: Task 1 (`PLANS`, chaves), `plan_for(user_plan)`.
- Produces:

```python
# app/strategies/exceptions.py
class PlanLimitReached(DomainError):
    def __init__(self, key: str, limit: int): ...
    # status_code=402, detail=f"Plan limit reached: {key} ({limit})", atributos .key e .limit

# app/services/plan_limits.py
class PlanLimits:
    def __init__(self, db: AsyncSession): ...
    async def owner_plan(self, project_id: UUID) -> Plan            # plano do dono do projeto
    async def check_projects(self, owner: User) -> None
    async def check_environments(self, project_id: UUID) -> None
    async def check_members(self, project_id: UUID, adding: int = 1) -> None
    async def check_integrations(self, project_id: UUID) -> None
    async def audit_since(self, project_id: UUID) -> datetime | None  # None = sem janela
    async def user_usage(self, user_id: UUID) -> dict[str, int]       # {"projects": n}
    async def project_usage(self, project_id: UUID) -> dict[str, int] # environments_per_project, members_per_project, integrations_per_project
```

Regras de contagem (são a decisão; o corpo fica com quem implementa):

| Chave | Conta |
|---|---|
| `projects` | `Project.owner_id == owner.id`, arquivados incluídos |
| `environments_per_project` | `Environment` do projeto com `archived` falso |
| `members_per_project` | linhas de `ProjectMember` do projeto (o dono é uma) **mais** `ProjectInvite` com `accepted_at` nulo, `revoked_at` nulo e `expires_at` no futuro |
| `integrations_per_project` | linhas de `Integration` do projeto |

Cada `check_*` levanta `PlanLimitReached(key, limit)` quando `uso + (o que está entrando) > limite`; limite `None` nunca levanta. `check_members(adding=0)` serve para aceitar convite (o convite já está contado). `audit_since` devolve `agora (UTC) − audit_retention_days`.

- [ ] **Step 1: Compartilhar as fixtures.** Mover de `tests/test_personal_vault.py` para `tests/conftest.py`, sem mudar o corpo: os dois `@compiles` (citext e JSONB em SQLite), `factory`, `db_session` e `client`. O `client` do conftest remove do `dependency_overrides` tanto `get_current_web_user` quanto `get_current_user`. Rodar `python -m pytest tests/test_personal_vault.py -q` → PASS, mesma contagem de antes.

- [ ] **Step 2: Escrever os testes que falham** em `tests/test_plan_limits.py`. Helpers locais `_user(plan=None)`, `_project(owner)`, `_env(project, archived=False)`, `_member(project, user)`, `_invite(project, email, *, expires_in=timedelta(days=7), revoked=False, accepted=False)`, `_integration(project)` que só montam as linhas do ORM.

```python
async def test_projects_limit_counts_owned_projects_including_archived(db_session):
    ana = _user(); db_session.add_all([ana, _project(ana), _project(ana), _project(ana, archived=True)]); await db_session.flush()
    with pytest.raises(PlanLimitReached) as exc:
        await PlanLimits(db_session).check_projects(ana)
    assert (exc.value.status_code, exc.value.key, exc.value.limit) == (402, "projects", 3)

async def test_projects_of_other_owners_do_not_count(db_session):   # ana é membro de 3 projetos da bia, dona de 0 → não levanta

async def test_archived_environments_do_not_count(db_session):      # 2 ativos + 1 arquivado no free → check_environments não levanta; com 3 ativos levanta ("environments_per_project", 3)

async def test_members_count_owner_and_pending_invites_only(db_session):
    # dono + 1 membro + 1 convite pendente = 3 → check_members() levanta ("members_per_project", 3)
    # dono + 1 membro + convite vencido + convite revogado + convite aceito (sem linha de membro) = 2 → não levanta
    # dono + 1 membro + 1 convite pendente → check_members(adding=0) não levanta

async def test_per_project_limits_follow_the_owner_plan(db_session):
    # dono com plan="pro", projeto com 3 ambientes e 1 conexão → check_environments e check_integrations não levantam
    # mesmo projeto com 10 membros → check_members levanta ("members_per_project", 10)

async def test_unlimited_plan_never_raises(db_session):             # dono com plan="unlimited", 5 projetos → nada levanta

async def test_audit_since(db_session):
    # dono free → agora − 7 dias (tolerância de 5 s); dono max → agora − 90 dias; dono unlimited → None

async def test_usage(db_session):
    # user_usage == {"projects": 2}; project_usage == {"environments_per_project": 3, "members_per_project": 2, "integrations_per_project": 1}
```

- [ ] **Step 3: Rodar e ver falhar** — `python -m pytest tests/test_plan_limits.py -v` → FAIL (módulo não existe).
- [ ] **Step 4: Implementar** `PlanLimitReached` e `PlanLimits`. Acima de cada contagem seguida de inserção, o mesmo comentário que o cofre pessoal usa: `# shortcut: count+insert can exceed the limit by one under concurrent creates; add a DB constraint if it matters`.
- [ ] **Step 5: Handler** em `main.py`, antes do handler genérico de `Exception`: `@app.exception_handler(PlanLimitReached)` devolve `JSONResponse(status_code=402, content={"detail": exc.detail})`.
- [ ] **Step 6: Rodar** — `python -m pytest tests/test_plan_limits.py -v` → PASS.
- [ ] **Step 7: Commit** — `feat(api): serviço de limites por plano e erro 402`

---

### Task 3: Aplicar os limites nas rotas de criação

**Files:**
- Modify: `apps/api/app/routers/projects.py:25` (`create_project`), `environments.py:38` (`create_environment`), `members.py:35` (`add_member`), `invites.py:60` (`create_invite`) e `invites.py:244` (`accept_invite`), `integrations.py:164` (`create_integration`)
- Test: `apps/api/tests/test_plan_limits.py`

**Interfaces:**
- Consumes: `PlanLimits` (Task 2). O handler da Task 2 já converte a exceção; os routers não capturam.

Onde entra cada chamada:

| Rota | Chamada | Posição |
|---|---|---|
| `POST /api/v1/projects` | `check_projects(current_user)` | antes de `project_service.create_project` |
| `POST .../environments` | `check_environments(project_uuid)` | **depois** da checagem de nome duplicado (409), antes do `Environment(...)` |
| `POST .../members` | `check_members(project_uuid)` | depois de "already a member" (409) |
| `POST .../invites` | `check_members(project_uuid)` | depois da checagem de convite pendente duplicado |
| `POST .../invites/{id}/accept` | `check_members(project_uuid, adding=0)` | antes de `AcceptInviteStrategy().execute` |
| `POST .../integrations` | `check_integrations(project_uuid)` | depois da autenticação, antes de `create_integration` |

Um projeto novo já nasce com 3 ambientes (`production`, `staging`, `development`), então no Free não cabe ambiente extra. É o comportamento esperado pela spec.

- [ ] **Step 1: Escrever os testes que falham** (HTTP, com `client` e `app.dependency_overrides[get_current_user] = lambda: ana`).

```python
async def test_fourth_project_is_402_on_free(client, ...):
    # 3 POST /api/v1/projects → 201; o 4º → 402 e detail == "Plan limit reached: projects (3)"

async def test_over_limit_account_keeps_read_edit_delete(client, ...):
    # ana (free) com 4 projetos gravados direto no banco: GET lista os 4, editar um e apagar um respondem com sucesso (2xx),
    # POST continua 402 com 3 restantes, apagar mais um → 2xx e o POST seguinte → 201

async def test_fourth_environment_is_402_and_retry_of_existing_name_is_409(client, ...):
    # projeto novo (3 ambientes): POST {"name": "qa"} → 402; POST {"name": "staging"} → 409

async def test_archiving_an_environment_frees_a_slot(client, ...):
    # arquiva "development" pela rota existente; POST {"name": "qa"} → 201

async def test_invite_and_add_member_share_the_members_limit(client, ...):
    # dono + 1 membro + 1 convite pendente: POST invites → 402; POST members → 402; reenviar o mesmo e-mail pendente → o status que a rota já devolve hoje para duplicado, não 402

async def test_accept_invite_over_limit_is_402_and_invite_stays_pending(client, ...):
    # dono free com 3 membros + 1 convite pendente (gravados direto no banco): accept → 402; o convite continua com accepted_at nulo e nenhuma linha de membro nova

async def test_second_integration_is_402_on_free_and_allowed_on_pro(client, ...):
    # dono free: 2º POST integrations → 402. Dono com plan="pro": → 201

async def test_member_of_max_owner_is_not_limited_by_own_free_plan(client, ...):
    # bia (free) é admin num projeto da ana (plan="max") com 5 ambientes: bia faz POST environments → 201
```

- [ ] **Step 2: Rodar e ver falhar** — `python -m pytest tests/test_plan_limits.py -v` → os novos FAIL (201 onde se espera 402).
- [ ] **Step 3: Implementar** as seis chamadas da tabela.
- [ ] **Step 4: Rodar a suíte inteira** — `python -m pytest tests/ -q` → PASS. Testes antigos que criam mais de 3 projetos, mais de 3 membros ou mais de 1 conexão com usuário Free passam a falhar: corrigir **o teste** dando `plan="unlimited"` ao dono, nunca afrouxando a regra.
- [ ] **Step 5: Commit** — `feat(api): limites de projetos, ambientes, membros e conexões por plano`

---

### Task 4: Janela do histórico de auditoria

**Files:**
- Modify: `apps/api/app/services/audit_service.py:43` (`get_project_logs`), `apps/api/app/routers/audit.py:45` (`list_audit_logs`)
- Test: `apps/api/tests/test_plan_limits.py`

**Interfaces:**
- Consumes: `PlanLimits.audit_since` (Task 2).
- Produces: `AuditService.get_project_logs(..., since: datetime | None = None)`; quando informado, filtra `AuditLog.created_at >= since` na consulta **e** na contagem.

- [ ] **Step 1: Escrever o teste que falha**

```python
async def test_audit_list_hides_rows_outside_the_plan_window_without_deleting(client, db_session, ...):
    # projeto de dono free com logs de 1, 6 e 8 dias atrás e de 40 dias atrás
    # GET /api/v1/projects/{id}/audit → total == 2 e só os de 1 e 6 dias
    # GET ...?page=2&per_page=1 → 1 log (o de 6 dias), total == 2
    # dono passa a plan="pro" → total == 3; plan="max" → total == 4
    # select count(AuditLog) no banco continua 4 em todos os casos
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL (`total == 4`).
- [ ] **Step 3: Implementar** o parâmetro `since` e passar `await PlanLimits(db).audit_since(project_uuid)` no router. As outras leituras de auditoria (`/me/overview`, `/me/activity-stats`) não mudam.
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_plan_limits.py tests/test_strategy_audit_filters.py tests/test_audit_actor.py -q` → PASS.
- [ ] **Step 5: Commit** — `feat(api): histórico de auditoria visível conforme o plano`

---

### Task 5: Expor limites e uso

**Files:**
- Modify: `apps/api/app/schemas/plan.py`, `apps/api/app/routers/me.py:35` (`get_plan`), `apps/api/app/routers/projects.py`
- Test: `apps/api/tests/test_plans.py`, `apps/api/tests/test_plan_limits.py`

**Interfaces:**
- Produces:
  - `PlanResponse.usage: dict[str, int] = {}`
  - `GET /api/v1/me/plan` → plano do usuário + `usage = {"projects": n}` (passa a depender de `get_db`)
  - `GET /api/v1/projects/{project_id}/plan` → plano **do dono** + `usage` de `project_usage`. Qualquer membro pode ler; quem não é membro recebe 404 "Project not found".

- [ ] **Step 1: Escrever os testes que falham**

```python
async def test_me_plan_reports_owned_projects(client, ...):
    # ana free com 2 projetos → {"id": "free", "limits": {...LIMITS["free"]}, "features": [], "usage": {"projects": 2}}

async def test_project_plan_is_the_owner_plan_with_project_usage(client, ...):
    # projeto da ana (plan="max"), bia (free) é membro e chama GET /api/v1/projects/{id}/plan
    # → id == "max", limits["members_per_project"] == 25,
    #   usage == {"environments_per_project": 3, "members_per_project": 2, "integrations_per_project": 0}

async def test_project_plan_is_404_for_non_members(client, ...)
```

Ajustar o `parametrize` existente de `/me/plan` em `test_plans.py` para incluir `"usage": {"projects": 0}`.

- [ ] **Step 2: Rodar e ver falhar** → FAIL (404 na rota nova, `usage` ausente).
- [ ] **Step 3: Implementar.** Declarar a rota `/{project_id}/plan` de modo que não colida com rotas existentes de `projects.py`.
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_plans.py tests/test_plan_limits.py tests/test_openapi_docs.py -q` → PASS.
- [ ] **Step 5: Commit** — `feat(api): uso e limites do plano em /me/plan e /projects/{id}/plan`

---

### Task 6: Web — cliente da API e componente de uso

**Files:**
- Modify: `apps/web/src/lib/api/client.ts`, `apps/web/src/lib/api/personal-vault.ts:71-74`, `apps/web/src/lib/api/me.ts:74-80`, `apps/web/src/lib/api/projects.ts`, `apps/web/messages/{pt-BR,en,es}/common.json`
- Create: `apps/web/src/components/shared/plan-usage.tsx`, `apps/web/src/components/shared/__tests__/plan-usage.test.tsx`

**Interfaces:**
- Produces:

```ts
// lib/api/client.ts — movida de personal-vault.ts, que passa a reexportar (os imports do cofre não mudam)
export function isPlanLimitError(error: unknown): boolean

// lib/api/me.ts
export type PlanLimitKey =
  | "projects" | "environments_per_project" | "members_per_project" | "integrations_per_project"
  | "audit_retention_days" | "personal_vault_items" | "personal_vault_folders"
export interface Plan {
  id: string
  limits: Record<PlanLimitKey, number | null>   // null = sem limite
  features: string[]
  usage: Partial<Record<PlanLimitKey, number>>
}

// lib/api/projects.ts
plan(projectId: string): Promise<Plan>   // GET /api/v1/projects/{id}/plan

// components/shared/plan-usage.tsx
export const PLAN_USAGE_KEYS = ["projects", "environments_per_project", "members_per_project", "integrations_per_project"] as const
export function isPlanFull(plan: Plan | null, limitKey: (typeof PLAN_USAGE_KEYS)[number]): boolean
export function PlanUsage(props: { plan: Plan | null; limitKey: (typeof PLAN_USAGE_KEYS)[number]; limitHit?: boolean }): JSX.Element | null
```

Comportamento de `PlanUsage`, igual ao padrão do cofre (`vault-items.tsx:150-225`):
- `plan === null` (não carregou ou falhou) e `limitHit` falso → não renderiza nada. Nada é desabilitado por plano desconhecido; a API continua aplicando.
- Limite `null` → não renderiza nada.
- Caso normal → linha de uso `t(\`planLimits.${limitKey}.usage\`, { used, max })`.
- `used >= max` ou `limitHit` → além da linha, `<p role="status">` com `t(\`planLimits.${limitKey}.reached\`, { max })`. Com `limitHit` e plano desconhecido, usa `planLimits.reachedUnknown`.

`PLAN_USAGE_KEYS` fica **no mesmo arquivo** das chamadas `t()` dinâmicas e é exportado: o auditor de i18n (`npm run check:i18n`) só resolve chaves dinâmicas assim.

Textos em `common.json`, namespace `planLimits` (pt-BR abaixo; en e es com o mesmo sentido):

| Chave | pt-BR |
|---|---|
| `projects.usage` | `{used} de {max} projetos` |
| `projects.reached` | `Você chegou ao limite de {max} projetos do seu plano. Apague um projeto para criar outro.` |
| `environments_per_project.usage` | `{used} de {max} ambientes` |
| `environments_per_project.reached` | `Este projeto chegou ao limite de {max} ambientes do plano do dono.` |
| `members_per_project.usage` | `{used} de {max} membros` |
| `members_per_project.reached` | `Este projeto chegou ao limite de {max} membros do plano do dono. Convites pendentes também contam.` |
| `integrations_per_project.usage` | `{used} de {max} conexões` |
| `integrations_per_project.reached` | `Este projeto chegou ao limite de {max} conexões com hospedagem do plano do dono.` |
| `reachedUnknown` | `O limite do plano foi atingido.` |

- [ ] **Step 1: Escrever os testes que falham** em `plan-usage.test.tsx`

```tsx
const free = (usage: Plan["usage"]): Plan => ({ id: "free", features: [], usage,
  limits: { projects: 3, environments_per_project: 3, members_per_project: 3, integrations_per_project: 1, audit_retention_days: 7, personal_vault_items: 120, personal_vault_folders: 10 } })

it("shows usage below the limit and no notice")            // usage.projects = 2 → "2 de 3 projetos"; sem role="status"
it("shows the notice at the limit")                        // usage.projects = 3 → role="status" com "limite de 3 projetos"
it("renders nothing for an unlimited plan")                // limits.projects = null → container vazio
it("renders nothing while the plan is unknown")            // plan = null → container vazio
it("shows the generic notice on a 402 with unknown plan")  // plan = null, limitHit → "O limite do plano foi atingido."
it("isPlanFull is false for unknown and unlimited plans, true at the limit")
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/web && npx jest src/components/shared/__tests__/plan-usage.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** o cliente, o componente e as chaves nos três idiomas.
- [ ] **Step 4: Rodar** — `npx jest && npx tsc --noEmit && npm run check:i18n && npx eslint src/` → PASS (os testes do cofre continuam verdes com o `isPlanLimitError` reexportado).
- [ ] **Step 5: Commit** — `feat(web): cliente do plano e componente de uso e limite`

---

### Task 7: Web — uso e aviso nos quatro pontos de criação e na auditoria

**Files:**
- Modify:
  - `apps/web/src/components/shared/create-project-dialog.tsx` — `projects`, plano de `meApi.plan()`
  - `apps/web/src/app/[locale]/(dashboard)/projects/[id]/settings/page.tsx` — `environments_per_project`
  - `apps/web/src/app/[locale]/(dashboard)/projects/[id]/members/page.tsx:244-262` — `members_per_project`
  - `apps/web/src/app/[locale]/(dashboard)/integrations/page.tsx:141-148` — `integrations_per_project`, plano do projeto selecionado
  - `apps/web/src/app/[locale]/(dashboard)/projects/[id]/audit/page.tsx` e `apps/web/messages/*/audit.json` — nota da janela
- Test: os `__tests__` existentes de cada um (criar o arquivo onde não houver)

**Interfaces:**
- Consumes: `PlanUsage`, `isPlanFull`, `isPlanLimitError`, `meApi.plan()`, `projectsApi.plan(projectId)` (Task 6).

O mesmo comportamento nos quatro pontos:
1. Ao abrir, busca o plano (`meApi.plan()` no diálogo de projeto; `projectsApi.plan(projectId)` nos outros). Falha na busca deixa `plan = null`, sem erro na tela.
2. Mostra `<PlanUsage plan={plan} limitKey=... limitHit={limitHit} />` junto do formulário ou botão de criar.
3. Botão de criar desabilitado quando `isPlanFull(plan, key)`.
4. No `catch` do criar: se `isPlanLimitError(err)`, `setLimitHit(true)` e **não** mostra a mensagem crua da API; senão, comportamento atual.
5. Depois de criar ou apagar com sucesso, busca o plano de novo e zera `limitHit`.

Auditoria: quando `limits.audit_retention_days` não é `null`, mostrar acima da lista `t("retention", { days })`, pt-BR: `Mostrando os últimos {days} dias, conforme o plano do dono do projeto.` O mesmo texto vale para a exportação, que usa a mesma listagem.

- [ ] **Step 1: Escrever os testes que falham**, um bloco por arquivo, com a API simulada como os testes vizinhos fazem:

```tsx
it("shows project usage and disables create at the limit")                  // meApi.plan → usage.projects = 3 → "3 de 3 projetos", botão disabled
it("shows the limit notice instead of the raw error on a 402")              // plan desconhecido, create rejeita ApiError 402 → role="status", sem "Plan limit reached" na tela
it("keeps the current error message for other failures")                    // create rejeita ApiError 409 → mensagem atual
it("refetches the plan after a successful create")                          // plan chamado 2 vezes
// members: "counts pending invites in the usage line" (usage.members_per_project vem da API; só confere que o número exibido é o da API)
// audit:   "shows the retention note for a limited plan and hides it for unlimited"
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/shared src/app` → os novos FAIL.
- [ ] **Step 3: Implementar** nos cinco arquivos.
- [ ] **Step 4: Rodar** — `npx jest && npx tsc --noEmit && npm run check:i18n && npx eslint src/` → PASS.
- [ ] **Step 5: Commit** — `feat(web): uso do plano e aviso de limite ao criar projeto, ambiente, membro e conexão`

---

### Task 8: Web — aviso de mão única nas integrações

**Files:**
- Create: `apps/web/src/components/shared/one-way-sync-notice.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/integrations/page.tsx`, `apps/web/src/components/shared/sync-modal.tsx`, `apps/web/src/app/[locale]/(docs)/docs/integrations/page.tsx`, `apps/web/messages/{pt-BR,en,es}/integrations.json`, `apps/web/messages/{pt-BR,en,es}/docs.json`
- Test: `apps/web/src/components/shared/__tests__/sync-modal.test.tsx`

**Interfaces:**
- Produces: `export function OneWaySyncNotice(): JSX.Element` — sem props, `role="note"`, visível para todos os planos.

Texto (namespace `integrations.oneWay`, pt-BR; en e es com o mesmo sentido):

- `title`: `Sincronização de mão única`
- `body`: `O CriptEnv envia as variáveis para a hospedagem, mas não fica sabendo do que for criado ou alterado direto lá: a Vercel não devolve variáveis sensíveis e a Cloudflare não devolve segredos. Edite sempre no CriptEnv. O próximo envio pode sobrescrever o que foi mudado na hospedagem.`

Aparece: no topo da página de integrações (sempre, com ou sem conexões), dentro do modal de sincronização e na página de docs de integrações (mesmo texto, pelo `docs.json`).

- [ ] **Step 1: Escrever o teste que falha** em `sync-modal.test.tsx`: `it("warns that sync is one-way")` → `getByRole("note")` contém "mão única".
- [ ] **Step 2: Rodar e ver falhar** — `npx jest src/components/shared/__tests__/sync-modal.test.tsx` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npx jest && npm run check:i18n && npx eslint src/` → PASS (inclui `docs-pages-render.test.tsx`, que falha com `console.error`).
- [ ] **Step 5: Commit** — `feat(web): aviso de sincronização de mão única nas integrações`

---

### Task 9: E2E, documentação e verificação final

**Files:**
- Create: spec Cypress ao lado dos existentes do dashboard (mesma pasta e convenções do spec de criação de projeto)
- Modify: `docs/development/CHANGELOG.md`, `docs/security/personal-vault.md` (seção de limites por plano), `deploy/vps/README.md` (onde descreve `DEFAULT_PLAN`), `ROADMAP.md` (uma linha na fase atual)

- [ ] **Step 1: Escrever o E2E.** Usuário novo (mesmo fluxo de cadastro dos specs existentes, com `cy.visitHydrated()`), cria 3 projetos pela interface, abre o diálogo de novo projeto: vê "3 de 3 projetos", o aviso de limite e o botão desabilitado. Apaga um projeto e o botão volta.
- [ ] **Step 2: Rodar o E2E** com o stack local (`make dev`, depois o alvo de E2E do `Makefile`) → PASS.
- [ ] **Step 3: Documentar.** CHANGELOG em "Unreleased": planos `pro` e `max`, limites novos, 402, janela de auditoria, aviso de mão única. Nos outros arquivos, trocar "free = 120 itens e 10 pastas" pela tabela de limites desta entrega e dizer que contas acima do limite não perdem nada.
- [ ] **Step 4: Verificação final** — `cd apps/api && python -m pytest tests/ -q`; `cd apps/web && npx jest && npx tsc --noEmit && npm run lint && npm run check:i18n && npm run build` → tudo PASS. Conferir à mão, no stack local: com `update users set plan = 'pro'` o 4º projeto passa a ser criado; voltando para `null` com 4 projetos, os 4 abrem, editam e apagam normalmente.
- [ ] **Step 5: Commit** — `test(e2e): limite de projetos do plano gratuito; docs: limites por plano`

## Fora deste plano

- **CLI:** não muda. Um 402 aparece como `API error 402: Plan limit reached: projects (3)`, pelo tratamento que já existe em `apps/cli/src/criptenv/api/client.py`.
- **Atalho para assinar e nome do plano que libera** nos avisos: entram na entrega 3, quando houver o que assinar.
- **Recursos `auto_sync`, `sync_redeploy`, `ci_sync`:** só declarados em `plans.py`. Quem os aplica é a entrega 2.
