# O que o Max promete (entrega 2 de 3) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em projeto de dono Max, salvar ou apagar uma variável com o cofre aberto (web ou CLI) envia o ambiente para as conexões com envio automático ligado, a API dispara um novo deploy na hospedagem, e a sincronização por sessão de CI passa a exigir o Max. Nada é vendido ainda: `users.plan` segue alterado à mão.

**Architecture:** Os recursos `auto_sync`, `sync_redeploy` e `ci_sync` já estão em `app/plans.py`; esta entrega os aplica. A conexão (`integrations`) passa a guardar o vínculo ambiente → destino e a opção de deploy. O envio automático é do **cliente** (o servidor nunca tem a senha do cofre): depois de gravar o cofre, web e CLI chamam o mesmo `POST .../sync` de hoje para cada conexão vinculada ao ambiente. O que o servidor bloqueia de verdade por plano: apagar variável na hospedagem, disparar deploy e sync por CI. O deploy é agendado na conexão (`deploy_due_at`, 60 s depois do último envio) e disparado pelo agendador que já existe, o que agrupa vários salvamentos seguidos em um deploy só.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, APScheduler, httpx, pytest; Next.js 16, React 19, next-intl, Jest, Cypress; CLI em Python (click).

**Spec:** `docs/superpowers/specs/2026-11-09-subscription-plans-design.md` (seções "Conta acima do limite", "Sincronização com a hospedagem" inteira, "Telas" → Integrações, e item 2 de "Ordem de entrega").

## Global Constraints

- Recurso ausente no plano do **dono do projeto** responde **402** com `{"detail": "Plan feature required: <feature>"}`. Mensagens da API em inglês.
- O plano que vale é sempre o do dono do projeto (`PlanLimits.owner_plan`), nunca o de quem age. `unlimited` (self-host) tem os três recursos.
- O servidor **não** guarda nem lê segredo para automatizar: os valores continuam passando só em memória pelo `POST .../sync`. Nenhuma sincronização em segundo plano.
- **Falha no envio ou no deploy nunca desfaz nem bloqueia o que foi salvo no cofre.** O usuário vê o erro e pode reenviar à mão.
- Apagar na hospedagem remove **só** as chaves que o usuário apagou no CriptEnv. Nunca espelho completo. O envio manual continua só criando e atualizando.
- Conexões existentes ficam sem vínculo e com deploy desligado (sem migração de dados). Voltar ao Free não apaga vínculo nem opção: só deixam de valer.
- Desligar envio automático ou deploy funciona em qualquer plano (editar e apagar nunca checam plano).
- Web em pt-BR, en e es; toda chave nova entra nos três `apps/web/messages/*/`. Os avisos dizem "Disponível no plano Max", sem preço nem atalho para assinar (entrega 3).
- Provedores de hospedagem: só testes de contrato com `httpx.MockTransport` (fixture `http` de `tests/test_integration_provider_contracts.py`), sem chamada real.
- Commits em português, no formato dos últimos (`feat(api): ...`, `feat(web): ...`, `feat(cli): ...`). Um PR só para a entrega, branch `feat/max-sync`.
- Antes de cada commit do web: `git checkout -- apps/web/package-lock.json` se o stack Docker estiver rodando. Ler `apps/web/AGENTS.md` antes de tocar no web.

## Decisões deste plano (o que a spec deixou com quem constrói)

1. **Vínculo:** coluna `integrations.auto_sync_targets` (JSONB), mapa `{environment_id: destino}`. Envio automático ligado = mapa não vazio. Destino é um valor de `provider.get_environments(config)` (Vercel: `production`, `preview`, `development`; Render e Cloudflare: `production`).
2. **Deploy na Vercel:** pela API, com o token que a conexão já tem (sem Deploy Hook para o usuário colar): pega o último deploy `READY` de produção e o refaz (`POST /v13/deployments` com `deploymentId`). **Só para o destino `production`**: preview não tem "o" deploy a refazer e pega as variáveis no próximo push; development não tem deploy.
3. **Deploy no Render:** `POST /services/{id}/deploys` (salvar variável pela API não publica sozinho).
4. **Cloudflare Workers:** não precisa de deploy explícito, cada envio de segredos já publica uma nova versão do Worker. A opção não aparece para Cloudflare.
5. **Agrupar deploys:** depois de um envio bem-sucedido, a API grava `deploy_due_at = agora + 60 s` na conexão (sobrescreve o anterior). Um job a cada 30 s dispara os vencidos. Dez salvamentos num minuto = um deploy.
6. **Padrão da opção de deploy:** ligada em conexão **nova** de projeto cujo dono tem `sync_redeploy`; desligada nas existentes. Vale para qualquer envio bem-sucedido (o servidor não distingue manual de automático).
7. **Configurar o envio automático:** só pelo web nesta entrega. A CLI **faz** o envio automático, mas não ganha comando para configurá-lo.

## Review Focus

1. **Apagar a última variável do ambiente:** o envio vai com zero segredos e uma chave a apagar; tem que funcionar, não responder "No secrets provided for push". → Task 4.
2. **Registro da Vercel que cobre vários destinos** (`production` + `preview`): apagar no vínculo de `production` tira só `production` do registro; o `preview` continua com a variável. → Task 2.
3. **Hospedagem fora do ar, ou conta rebaixada entre abrir a tela e salvar:** o cofre fica salvo, a tela e a CLI mostram o erro do envio e o caminho para reenviar; a CLI sai com código 0. → Tasks 7 e 9.
4. **Rajada de salvamentos e dois agendadores no ar:** N envios em 60 s geram exatamente um deploy; dois ticks concorrentes não disparam o mesmo deploy duas vezes. → Task 5.
5. **Ambiente arquivado ou apagado depois de vinculado, e chave que aparece ao mesmo tempo em `secrets` e `delete_keys`:** o vínculo órfão é ignorado sem quebrar o resto; a chave enviada **não** é apagada. → Tasks 3 e 4.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/migrations/versions/20261110_0019_add_auto_sync_to_integrations.py` (novo) | 3 colunas em `integrations` |
| `apps/api/app/models/integration.py` | colunas novas |
| `apps/api/app/strategies/exceptions.py`, `apps/api/main.py` | `PlanFeatureRequired` (402) |
| `apps/api/app/services/plan_limits.py` | `has_feature`, `require_feature` |
| `apps/api/app/strategies/integrations/{base,vercel,render,cloudflare}.py` | `delete_secrets`, `deploys_on`, `trigger_deploy` |
| `apps/api/app/services/integration_service.py` | `update_settings`, `delete_keys` no sync, `schedule_deploy`, `run_due_deploys` |
| `apps/api/app/routers/integrations.py` | `PATCH`, campos novos, bloqueios por plano |
| `apps/api/app/jobs/deploy_due.py` (novo), `apps/api/main.py` | job de deploys vencidos |
| `apps/web/src/lib/api/{client,integrations}.ts` | tipos e `update` |
| `apps/web/src/lib/auto-sync.ts` (novo) | decidir e executar o envio automático no web |
| `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/{use-project-secrets.ts,secrets-client.tsx}` | chamar o envio depois de salvar e mostrar o resultado |
| `apps/web/src/app/[locale]/(dashboard)/integrations/_components/auto-sync-settings.tsx` (novo), `integrations/page.tsx` | opções por conexão |
| `apps/cli/src/criptenv/auto_sync.py` (novo), `api/client.py`, `commands/{secrets,import_export}.py` | envio automático na CLI |

---

### Task 1: Colunas na conexão e bloqueio por recurso

**Files:**
- Create: `apps/api/migrations/versions/20261110_0019_add_auto_sync_to_integrations.py`
- Modify: `apps/api/app/models/integration.py`, `apps/api/app/strategies/exceptions.py`, `apps/api/main.py:208`, `apps/api/app/services/plan_limits.py`
- Test: `apps/api/tests/test_plan_limits.py`

**Interfaces:**
- Produces:
  - `Integration.auto_sync_targets: dict[str, str]` (JSONB, `nullable=False`, `server_default='{}'`, `default=dict`), `Integration.redeploy: bool` (`nullable=False`, `server_default=false`, `default=False`), `Integration.deploy_due_at: datetime | None` (timezone-aware).
  - `class PlanFeatureRequired(DomainError)` com `__init__(self, feature: str)`, `self.feature`, status 402, detail `f"Plan feature required: {feature}"`.
  - `PlanLimits.has_feature(project_id: UUID, feature: str) -> bool` e `PlanLimits.require_feature(project_id: UUID, feature: str) -> None` (levanta `PlanFeatureRequired`).

- [ ] **Step 1: Escrever os testes que falham** em `test_plan_limits.py`, com os ajudantes `_user`/`_project` que já existem:

```python
async def test_feature_follows_the_owner_plan_not_the_actor(db_session):
    owner, member = _user(plan="max"), _user(plan=None)  # o membro é Free
    project, membership = _project(owner)
    db_session.add_all([owner, member, project, membership, _member(project, member)])
    await db_session.flush()
    assert await PlanLimits(db_session).has_feature(project.id, AUTO_SYNC) is True
    await PlanLimits(db_session).require_feature(project.id, CI_SYNC)  # não levanta

@pytest.mark.parametrize("plan", [None, "free", "pro"])
async def test_feature_missing_is_402(db_session, plan): ...
    # dono com esse plano → has_feature False; require_feature levanta PlanFeatureRequired
    # com exc.status_code == 402 e exc.detail == "Plan feature required: sync_redeploy"

async def test_unlimited_has_every_sync_feature(db_session): ...
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/api && python -m pytest tests/test_plan_limits.py -v` → FAIL (ImportError).
- [ ] **Step 3: Implementar.** Migração com `down_revision = "20261107_0018"`, no formato de `20261107_0017`. Em `main.py`, o handler de `PlanLimitReached` passa a atender também `PlanFeatureRequired` (segundo decorator na mesma função).
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_plan_limits.py tests/test_plans.py -q` → PASS. `alembic upgrade head && alembic downgrade -1 && alembic upgrade head` no banco local → sem erro.
- [ ] **Step 5: Commit** — `feat(api): vínculo de envio automático na conexão e bloqueio por recurso do plano`

---

### Task 2: Provedores — apagar variáveis e disparar deploy

**Files:**
- Modify: `apps/api/app/strategies/integrations/base.py`, `vercel.py`, `render.py`, `cloudflare.py`
- Test: `apps/api/tests/test_integration_provider_contracts.py`

**Interfaces:**
- Produces, em `IntegrationProvider`:
  - `async def delete_secrets(self, keys: list[str], config: dict, environment: str) -> None` (abstrato). Chave que não existe na hospedagem não é erro.
  - `def deploys_on(self, environment: str) -> bool` (padrão `False`).
  - `async def trigger_deploy(self, config: dict) -> None` (padrão: levanta `ProviderError`).

Contratos:

| Provedor | `delete_secrets` | `deploys_on` | `trigger_deploy` |
|---|---|---|---|
| Vercel | lista com `_list_envs`; para cada registro com a chave, com `environment` nos destinos e **sem** `gitBranch`: `PATCH /v9/projects/{project_id}/env/{id}` com `{"target": <outros destinos>}` se sobrar destino, senão `DELETE` na mesma rota | `environment == "production"` | `GET /v7/deployments?projectId=…&target=production&state=READY&limit=1` → `deployments[0]`; depois `POST /v13/deployments` com `{"name": <name>, "deploymentId": <uid>, "target": "production"}`. Sem deploy na lista: `ProviderError("Vercel has no production deployment to redeploy")` |
| Render | `DELETE /services/{service_id}/env-vars/{chave com quote}` por chave; 404 é ignorado | sempre `True` | `POST /services/{service_id}/deploys` com `{}` |
| Cloudflare | `DELETE /accounts/{account_id}/workers/scripts/{script_name}/secrets/{chave com quote}` por chave; 404 é ignorado | `False` | não implementa |

O `teamId` da Vercel já vai em todo pedido pelo `_client`. As rotas da Vercel foram conferidas em `openapi.vercel.sh` em 2026-11-10. **As de apagar do Render e da Cloudflare e a de deploy do Render vêm de memória:** antes de escrever o teste de cada uma, conferir no OpenAPI citado no docstring do módulo; se a rota for outra, usar a publicada e anotar no commit.

- [ ] **Step 1: Escrever os testes que falham**, um por célula da tabela, afirmando método, caminho, query e corpo, no estilo dos testes de `push_secrets` do mesmo arquivo. Além deles:

```python
async def test_vercel_delete_keeps_the_other_targets_of_a_shared_record(http): ...
    # registro {"id": "e1", "key": "A", "target": ["production", "preview"]}
    # delete_secrets(["A"], cfg, "production") → um PATCH /v9/projects/prj/env/e1
    # com corpo {"target": ["preview"]}; nenhum DELETE

async def test_vercel_delete_leaves_branch_records_and_other_keys_alone(http): ...
    # registros: A com gitBranch, B em production → delete_secrets(["A"]) não faz PATCH nem DELETE

async def test_delete_of_a_key_the_provider_does_not_have_is_not_an_error(http): ...
    # Render e Cloudflare respondendo 404; Vercel com lista vazia → não levanta

async def test_vercel_deploy_without_a_production_deployment_says_so(http): ...
    # GET devolve {"deployments": []} → ProviderError; nenhum POST

def test_only_vercel_production_and_render_deploy(): ...
    # Vercel: production True, preview False, development False; Render: True; Cloudflare: False
```

- [ ] **Step 2: Rodar e ver falhar** — `python -m pytest tests/test_integration_provider_contracts.py -v` → os novos FAIL.
- [ ] **Step 3: Implementar.** Na Vercel, reaproveitar `_targets` e a mesma regra de "tirar deste destino" que `push_secrets` já usa nos conflitos de tipo (extrair para um método comum em vez de duplicar).
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_integration_provider_contracts.py tests/test_integration_providers.py -q` → PASS.
- [ ] **Step 5: Commit** — `feat(api): provedores apagam variáveis e disparam deploy`

---

### Task 3: Configurar o vínculo e o deploy na conexão

**Files:**
- Modify: `apps/api/app/services/integration_service.py`, `apps/api/app/routers/integrations.py`
- Test: `apps/api/tests/test_integration_auto_sync.py` (novo; fixtures `db_session` e `client` do `conftest.py`, ajudantes copiados do topo de `test_plan_limits.py`)

**Interfaces:**
- Consumes: `PlanLimits.has_feature` / `require_feature`, colunas da Task 1, `deploys_on` da Task 2.
- Produces:
  - `IntegrationService.update_settings(integration_id: UUID, *, project_id: UUID, auto_sync_targets: dict[str, str] | None = None, redeploy: bool | None = None) -> Integration | None`. `None` = não mexe no campo. Levanta `IntegrationConfigError` (→ 422) se alguma chave não for ambiente **não arquivado** do projeto ou algum destino não estiver em `provider.get_environments(config)`.
  - `IntegrationService.create_integration(..., redeploy: bool = False)`.
  - `PATCH /api/v1/projects/{project_id}/integrations/{integration_id}`, corpo `IntegrationUpdate { auto_sync_targets: dict[UUID, str] | None (máx. 50), redeploy: bool | None }`, só `admin`, responde `IntegrationResponse`. Auditoria `integration.updated` com `{"auto_sync_environments": <quantos>, "redeploy": <bool>}`.
  - `IntegrationResponse` ganha `auto_sync_targets: dict[str, str]` e `redeploy: bool`; `IntegrationListResponse` ganha `features: list[str]` (os recursos do plano do dono, em ordem alfabética).

Regras de plano no `PATCH`: `auto_sync_targets` **não vazio** exige `auto_sync`; `redeploy=True` exige `sync_redeploy`; mapa vazio e `redeploy=False` passam em qualquer plano. No `POST` de criação, `redeploy` nasce `True` quando o dono tem `sync_redeploy`.

- [ ] **Step 1: Escrever os testes que falham:**

```python
async def test_patch_binds_environment_to_target_on_a_max_project(client, ...):
    # dono max, conexão vercel, ambiente "production" → PATCH {"auto_sync_targets": {env_id: "preview"}}
    # → 200, corpo traz auto_sync_targets == {env_id: "preview"}; GET lista traz o mesmo e
    # features == ["auto_sync", "ci_sync", "sync_redeploy"]

async def test_patch_turning_auto_sync_on_needs_max(...):   # dono free e dono pro → 402 "Plan feature required: auto_sync"
async def test_patch_redeploy_on_needs_max(...):            # → 402 "Plan feature required: sync_redeploy"
async def test_patch_turning_things_off_never_checks_plan(...):
    # conexão com vínculo e redeploy=True, dono rebaixado para free →
    # PATCH {"auto_sync_targets": {}, "redeploy": false} → 200
async def test_downgrade_keeps_the_binding_stored(...):     # dono vira free → GET ainda devolve o vínculo; features == []
async def test_patch_rejects_environment_of_another_project(...):  # → 422
async def test_patch_rejects_archived_environment_and_unknown_target(...):  # → 422 nos dois
async def test_patch_needs_admin(...):                      # developer → 404, como as outras rotas de escrita
async def test_new_connection_redeploys_by_default_only_with_the_feature(...):
    # dono max → redeploy True; dono free → False
```

- [ ] **Step 2: Rodar e ver falhar** — `python -m pytest tests/test_integration_auto_sync.py -v` → FAIL.
- [ ] **Step 3: Implementar.** `_force_load_integration` passa a tocar nos campos novos. O serviço só valida e grava; a checagem de plano fica no router, como `check_integrations` hoje.
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_integration_auto_sync.py tests/test_openapi_docs.py -q` → PASS.
- [ ] **Step 5: Commit** — `feat(api): configurar envio automático e deploy por conexão`

---

### Task 4: Sync — apagar chaves, agendar deploy e exigir Max na CI

**Files:**
- Modify: `apps/api/app/services/integration_service.py`, `apps/api/app/routers/integrations.py`
- Test: `apps/api/tests/test_integration_auto_sync.py`

**Interfaces:**
- Consumes: `delete_secrets`, `deploys_on` (Task 2); `require_feature`, `has_feature` (Task 1).
- Produces:
  - `SyncRequest.delete_keys: list[str] | None` (máx. 1000, cada uma de 1 a 256 caracteres). Só com `direction="push"` (com `pull` → 422).
  - `SyncResponse.deploy_scheduled: bool = False`.
  - `IntegrationService.sync_integration(..., delete_keys: list[str] | None = None)`: mesma tupla de retorno de hoje.
  - `IntegrationService.schedule_deploy(integration_id: UUID, *, project_id: UUID, environment: str) -> bool`: grava `deploy_due_at = agora + DEPLOY_DEBOUNCE` e devolve `True` quando `integration.redeploy` e `provider.deploys_on(environment)`; senão `False` sem gravar. `DEPLOY_DEBOUNCE = timedelta(seconds=60)` no módulo do serviço.

Regras:
- No push, o serviço envia `secrets` (se houver) e depois apaga `delete_keys` (se houver). Push sem segredos **e** sem chaves a apagar continua respondendo "No secrets provided for push". Chave presente em `secrets` é retirada de `delete_keys` antes de chamar o provedor.
- `delete_keys` não vazio exige `auto_sync` → 402.
- Sessão de CI no `POST .../sync` (push ou pull) exige `ci_sync` → 402. A checagem entra em `_authenticate_integration_sync_or_ci`, logo depois do escopo. Listar conexões por CI **não** muda.
- Depois de um push bem-sucedido, se o dono tem `sync_redeploy`, o router chama `schedule_deploy` e devolve o resultado em `deploy_scheduled`. Sem o recurso, nada é agendado e nada dá erro (o envio manual continua valendo em todo plano).
- A auditoria `integration.synced.push` ganha `deleted_count` e `deploy_scheduled` no metadata.

- [ ] **Step 1: Escrever os testes que falham** (provedor trocado por um dublê registrado no teste, ou `monkeypatch` em `IntegrationService._get_provider`; nenhuma chamada HTTP):

```python
async def test_deleting_the_last_variable_syncs_with_no_secrets(...):
    # dono max; POST sync {"direction": "push", "environment": "production", "secrets": [], "delete_keys": ["A"]}
    # → 200 success True; o provedor recebeu delete_secrets(["A"], cfg, "production") e nenhum push_secrets

async def test_a_key_being_pushed_is_never_deleted(...):
    # secrets [A], delete_keys ["A", "B"] → delete_secrets recebe só ["B"]

async def test_delete_keys_needs_max(...):          # dono free e pro → 402 "Plan feature required: auto_sync"; provedor não é chamado
async def test_manual_push_still_works_on_free(...) # sem delete_keys → 200, deploy_scheduled False
async def test_push_schedules_a_deploy_about_a_minute_out(...):
    # dono max, conexão com redeploy=True, provedor com deploys_on True →
    # deploy_scheduled True e deploy_due_at entre agora+55s e agora+65s
async def test_second_push_moves_the_deploy_instead_of_adding_one(...):
    # dois pushes seguidos → um só deploy_due_at, o do segundo
async def test_no_deploy_when_option_off_target_does_not_deploy_or_push_failed(...):
    # redeploy=False; deploys_on False (Vercel preview); provedor levantando ProviderError → deploy_due_at None nos três
async def test_no_deploy_scheduled_without_the_feature(...):   # dono pro com redeploy=True gravado → False, None
async def test_ci_session_sync_needs_max(...):
    # validate_ci_session com patch devolvendo escopo write:integrations;
    # dono free → 402 "Plan feature required: ci_sync" (push e pull); dono max → 200; unlimited → 200
async def test_ci_session_can_still_list_integrations_on_free(...):   # GET → 200
async def test_delete_keys_with_pull_is_422(...)
```

- [ ] **Step 2: Rodar e ver falhar** — `python -m pytest tests/test_integration_auto_sync.py -v` → os novos FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar a suíte inteira** — `python -m pytest tests/ -q` → PASS. Teste antigo de sync por CI que passe a dar 402 é corrigido dando `plan="unlimited"` ao dono, nunca afrouxando a regra.
- [ ] **Step 5: Commit** — `feat(api): sync apaga variáveis removidas, agenda deploy e exige Max na CI`

---

### Task 5: Job que dispara os deploys vencidos

**Files:**
- Create: `apps/api/app/jobs/deploy_due.py`
- Modify: `apps/api/app/services/integration_service.py`, `apps/api/main.py` (bloco do agendador, linhas 69–112)
- Test: `apps/api/tests/test_deploy_due_job.py` (novo)

**Interfaces:**
- Consumes: `trigger_deploy` (Task 2), `deploy_due_at` (Tasks 1 e 4).
- Produces:
  - `IntegrationService.run_due_deploys(now: datetime | None = None) -> int`: quantos deploys disparou.
  - `app.jobs.deploy_due.create_session_scoped_scheduler_job(session_factory)`, no formato de `session_cleanup.py`, com commit ao fim de cada execução. Registrado em `main.py` com `IntervalTrigger(seconds=30)`, `id="deploy_due"`.

A reserva é atômica, para dois agendadores não dispararem o mesmo deploy:

```python
claimed = (await self.db.execute(
    update(Integration)
    .where(Integration.deploy_due_at <= now)
    .values(deploy_due_at=None)
    .returning(Integration.id)
)).scalars().all()
```

Para cada reservada: decifra o config e chama `provider.trigger_deploy(config)`. Falha grava o erro na conexão com `_record_failure` (mensagem começando por `Deploy failed: `) e segue para a próxima; não reagenda. Sucesso grava auditoria `integration.deploy_triggered` (sem usuário).

- [ ] **Step 1: Escrever os testes que falham:**

```python
async def test_due_deploy_fires_once_and_clears(db_session, ...):
    # deploy_due_at = agora - 1s → run_due_deploys() == 1; trigger_deploy chamado 1 vez; deploy_due_at None
    # segunda chamada → 0, trigger_deploy continua em 1 chamada
async def test_deploy_not_due_yet_waits(...):                 # agora + 30s → 0 chamadas, data mantida
async def test_ten_pushes_in_a_minute_make_one_deploy(...):
    # 10× schedule_deploy; run_due_deploys(now=agora+61s) → trigger_deploy 1 vez
async def test_failed_deploy_is_recorded_and_does_not_stop_the_others(...):
    # duas conexões vencidas, a primeira levanta ProviderError("boom") → devolve 1;
    # a primeira fica com status "error" e last_error começando por "Deploy failed: "; a segunda disparou
async def test_deploy_error_never_leaks_the_token(...):       # ProviderError contendo o api_token → last_error com "[redacted]"
```

- [ ] **Step 2: Rodar e ver falhar** — `python -m pytest tests/test_deploy_due_job.py -v` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `python -m pytest tests/test_deploy_due_job.py tests/test_integration_auto_sync.py -q` → PASS. Subir a API local com `SCHEDULER_ENABLED=true` e conferir no log `Added deploy_due job`.
- [ ] **Step 5: Commit** — `feat(api): job dispara o deploy agendado depois do envio`

---

### Task 6: Web — cliente da API e módulo de envio automático

**Files:**
- Modify: `apps/web/src/lib/api/client.ts` (bloco "Integrations", linha 450), `apps/web/src/lib/api/integrations.ts`
- Create: `apps/web/src/lib/auto-sync.ts`
- Test: `apps/web/src/lib/__tests__/auto-sync.test.ts` (novo)

**Interfaces:**
- Produces:
  - Tipos: `Integration` ganha `auto_sync_targets: Record<string, string>` e `redeploy: boolean`; `IntegrationListResponse` ganha `features: string[]`; `IntegrationSyncRequest` ganha `delete_keys?: string[]`; `IntegrationSyncResponse` ganha `deploy_scheduled?: boolean`; novo `UpdateIntegrationRequest { auto_sync_targets?: Record<string, string>; redeploy?: boolean }`.
  - `integrationsApi.update(projectId: string, integrationId: string, body: UpdateIntegrationRequest): Promise<Integration>` (`PATCH`).
  - Em `auto-sync.ts`:

```ts
export interface AutoSyncResult {
  integration: Integration
  target: string
  ok: boolean
  message: string | null       // erro da hospedagem ou da API, quando !ok
  deployScheduled: boolean
}
/** Conexões que recebem este ambiente. Vazio quando o plano do dono não tem "auto_sync". */
export function autoSyncTargets(list: IntegrationListResponse, environmentId: string): { integration: Integration; target: string }[]
/** Nunca rejeita: toda falha (inclusive a de listar as conexões) vira um resultado com ok=false ou lista vazia. */
export async function runAutoSync(projectId: string, environmentId: string, secrets: DecryptedSecret[], removedKeys: string[]): Promise<AutoSyncResult[]>
```

`runAutoSync` lista as conexões a cada chamada (sem cache: a configuração pode ter mudado em outra aba) e envia para todas em paralelo, com `direction: "push"`, `environment: target`, os segredos no mesmo formato do `sync-modal.tsx` (com `kind` quando houver) e `delete_keys` só quando `removedKeys` não for vazio.

- [ ] **Step 1: Escrever os testes que falham** (`integrationsApi` com `jest.mock`, como em `integrations/__tests__/page.test.tsx`):

```ts
it("sends the environment to every connection bound to it") // 2 conexões vinculadas, 1 não → 2 chamadas de sync com o destino de cada uma
it("sends nothing when the owner's plan lacks auto_sync")   // features: [] com vínculo gravado → nenhuma chamada, []
it("sends nothing for an environment without a binding")
it("passes removed keys as delete_keys and omits the field when none")
it("reports a provider failure without throwing")           // sync resolve { success: false, message: "boom" } → ok false, message "boom"
it("reports a 402 or network error without throwing")       // sync rejeita ApiError 402 → ok false
it("resolves to [] when listing the connections fails")
it("flags deployScheduled from the response")
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/web && npx jest src/lib/__tests__/auto-sync.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `npx jest src/lib && npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat(web): cliente e módulo do envio automático`

---

### Task 7: Web — enviar ao salvar e mostrar o resultado

**Files:**
- Modify: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/use-project-secrets.ts` (`pushSecrets`, linha 311; `importSecrets`, linha 382), `secrets-client.tsx`, `apps/web/messages/{pt-BR,en,es}/secrets.json`
- Test: `apps/web/src/app/[locale]/(dashboard)/projects/[id]/secrets/__tests__/auto-sync-notice.test.tsx` (novo)

**Interfaces:**
- Consumes: `runAutoSync`, `AutoSyncResult` (Task 6).
- Produces: `state.autoSyncResults: AutoSyncResult[] | null` e `actions.dismissAutoSync()` no hook; `importSecrets(secrets, options?: { autoSync?: boolean })`; componente `AutoSyncNotice({ results, onResend, onDismiss })` em `secrets/_components/auto-sync-notice.tsx`.

Comportamento:
- `pushSecrets` é o único ponto que grava o cofre (salvar, apagar, apagar em lote, rotacionar, importar). Depois que a gravação dá certo, ele calcula `removedKeys` (chaves que estavam em `secrets` e não estão em `nextSecrets`) e chama `runAutoSync` **sem esperar**: o formulário fecha e `saving` volta a `false` no tempo de hoje. O resultado chega depois em `autoSyncResults`.
- Gravação do cofre que falha não envia nada.
- Importar a partir do **pull** do `SyncModal` passa `{ autoSync: false }`: o que acabou de vir da hospedagem não é mandado de volta. Importar de arquivo envia.
- `AutoSyncNotice` não renderiza nada com lista vazia. Com resultados: uma linha `role="status"` por sucesso e `role="alert"` por falha, com o botão "Reenviar" que abre o `SyncModal` já na conexão (`initialIntegrationId`).

Textos (pt-BR; en e es equivalentes), em `secrets.autoSync`:
- `sent`: `Enviado para {name} ({target}).`
- `deploy`: `Novo deploy em cerca de 1 minuto.`
- `failed`: `Não foi possível enviar para {name}: {message} Suas variáveis foram salvas no CriptEnv.`
- `resend`: `Reenviar`
- `dismiss`: `Fechar aviso`

- [ ] **Step 1: Escrever os testes que falham** para `AutoSyncNotice`:

```tsx
it("renders nothing without results")
it("says where it was sent and that a deploy is coming")   // ok + deployScheduled → status com as duas frases
it("omits the deploy sentence when none was scheduled")
it("shows the provider error, says the vault was saved and offers to resend") // alert; clique em "Reenviar" chama onResend(integration.id)
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest "src/app/\[locale\]/\(dashboard\)/projects"` → FAIL.
- [ ] **Step 3: Implementar** o componente, depois ligar no hook e na página.
- [ ] **Step 4: Rodar** — `npx jest && npx tsc --noEmit && npm run check:i18n && npx eslint src/` → PASS.
- [ ] **Step 5: Commit** — `feat(web): envio automático para a hospedagem ao salvar`

---

### Task 8: Web — opções de envio automático e deploy por conexão

**Files:**
- Create: `apps/web/src/app/[locale]/(dashboard)/integrations/_components/auto-sync-settings.tsx`
- Modify: `apps/web/src/app/[locale]/(dashboard)/integrations/page.tsx`, `apps/web/messages/{pt-BR,en,es}/integrations.json`
- Test: `apps/web/src/app/[locale]/(dashboard)/integrations/__tests__/auto-sync-settings.test.tsx` (novo)

**Interfaces:**
- Consumes: `integrationsApi.update`, `features` da lista (Task 6); `environmentsApi.list(projectId)`.
- Produces: `AutoSyncSettings({ projectId, integration, environments, features, onSaved })`, renderizado dentro de cada conexão na página.

Comportamento:
- Um bloco "Envio automático" por conexão, **visível para todos**. Para cada ambiente não arquivado do projeto, um `<select>` rotulado com o nome do ambiente: primeira opção "Não enviar", depois os destinos do provedor (Vercel: `production`, `preview`, `development`; Render e Cloudflare: `production`). Mudar um select salva na hora com `integrationsApi.update` e mostra erro em `role="alert"` se falhar.
- Uma caixa "Disparar novo deploy depois do envio" (não aparece para Cloudflare; no lugar, a frase `cloudflareDeploys`). Para Vercel, a dica `vercelProductionOnly` embaixo.
- Sem `auto_sync` em `features`: selects desabilitados e a frase `maxOnly`. Sem `sync_redeploy`: caixa desabilitada, mesma frase. Exceção: o que **já está ligado** numa conta rebaixada continua podendo ser desligado (o select com vínculo gravado e a caixa marcada ficam habilitados).
- Vínculo para ambiente que não existe mais na lista não é mostrado e é removido no próximo salvamento.

Textos (pt-BR), em `integrations.autoSync`:
- `title`: `Envio automático`
- `description`: `Ao salvar ou apagar uma variável com o cofre aberto, o CriptEnv envia o ambiente para esta hospedagem.`
- `none`: `Não enviar`
- `redeploy`: `Disparar novo deploy depois do envio`
- `redeployHint`: `Vários salvamentos seguidos viram um deploy só, cerca de 1 minuto depois do último.`
- `vercelProductionOnly`: `Na Vercel, o deploy é refeito só em production. Preview recebe as variáveis no próximo push.`
- `cloudflareDeploys`: `A Cloudflare já publica uma nova versão do Worker a cada envio.`
- `maxOnly`: `Disponível no plano Max.`
- `saveFailed`: `Não foi possível salvar esta opção.`

- [ ] **Step 1: Escrever os testes que falham:**

```tsx
it("binds an environment to a target and saves at once")     // escolher "preview" em "staging" → update({ auto_sync_targets: { [stagingId]: "preview" } })
it("unbinds with 'Não enviar'")                              // → update com o mapa sem aquele ambiente
it("locks the controls and names the Max plan without the features") // features [] → selects e caixa disabled; texto "Disponível no plano Max."
it("still lets a downgraded account turn off what is on")    // features [], vínculo gravado e redeploy true → esse select e a caixa habilitados
it("hides the deploy option for Cloudflare and explains why")
it("offers only production for Render")
it("shows an alert when saving fails and keeps the previous value")
it("drops a binding whose environment is gone on the next save")
```

- [ ] **Step 2: Rodar e ver falhar** — `npx jest "src/app/\[locale\]/\(dashboard\)/integrations"` → os novos FAIL.
- [ ] **Step 3: Implementar**, dentro do sistema visual da página (mesmas classes de `select` do `sync-modal.tsx`, `Checkbox` de `components/ui`).
- [ ] **Step 4: Rodar** — `npx jest && npx tsc --noEmit && npm run check:i18n && npx eslint src/` → PASS.
- [ ] **Step 5: Commit** — `feat(web): opções de envio automático e deploy nas integrações`

---

### Task 9: CLI — envio automático ao salvar

**Files:**
- Create: `apps/cli/src/criptenv/auto_sync.py`
- Modify: `apps/cli/src/criptenv/api/client.py` (bloco "Integrations", linha 412), `apps/cli/src/criptenv/commands/secrets.py` (`set_command`, `delete_command`, `rotate_command`), `apps/cli/src/criptenv/commands/import_export.py` (`import_command`)
- Test: `apps/cli/tests/test_auto_sync.py` (novo; dublês no estilo de `tests/test_integrations_commands.py`)

**Interfaces:**
- Produces:
  - `CriptEnvClient.integrations_envelope(project_id: str) -> dict` (a resposta inteira do `GET`, com `integrations` e `features`); `list_integrations` passa a usá-la.
  - `CriptEnvClient.sync_integration(..., delete_keys: list[str] | None = None)`: o campo só entra no corpo quando não é vazio.
  - `criptenv.auto_sync.auto_sync(client, vault: RemoteVault, project_id: str, env_name: str | None, removed_keys: Sequence[str] = ()) -> None`.

`auto_sync` (assíncrona, chamada com `run_async` depois do `push_state`):
1. Pega o envelope. Sem `"auto_sync"` em `features`, ou sem nenhuma conexão com `auto_sync_targets`, retorna sem mais nenhum pedido.
2. Recarrega o estado (`vault.load_state(env_name)`), acha as conexões vinculadas a `state.environment.id`, decifra o ambiente (`vault.decrypt_all`) e envia para cada uma, com `kind` como em `integrations_sync`.
3. Sucesso: `✓ Sent to <name> (<target>)`, mais ` — deploy in about a minute` quando `deploy_scheduled`. Falha: em stderr, `⚠ Could not send to <name>: <motivo>. Your secrets are saved. Retry with: criptenv integrations sync --provider <provider> --integration <id> --env <ambiente> --target <target>`.
4. **Nunca levanta nem muda o código de saída**: qualquer exceção (rede, 402, erro ao listar) vira o aviso do item 3.

Onde chamar: `set`, `delete` (`removed_keys=[key]`), `rotate` e `import` (só quando importou alguma coisa). **Não** chamar em `integrations sync --direction pull` (que usa `import_entries_into_vault` direto) nem em `ci deploy`.

- [ ] **Step 1: Escrever os testes que falham:**

```python
def test_set_sends_the_environment_to_the_bound_connection(monkeypatch): ...
    # envelope: features ["auto_sync"], conexão vercel com auto_sync_targets {env_id: "preview"}
    # `criptenv set A=1` → sync_integration(direction="push", environment="preview",
    #   secrets contém {"key": "A", "value": "1"}), sem delete_keys; saída tem "✓ Sent to"
def test_delete_sends_only_that_key_as_delete_keys(monkeypatch): ...   # delete_keys == ["A"]
def test_nothing_is_sent_without_the_feature_or_without_a_binding(monkeypatch): ...
    # features [] com vínculo; features ["auto_sync"] sem vínculo → sync_integration não é chamado e load_state não é chamado de novo
def test_provider_failure_warns_and_exits_zero(monkeypatch): ...
    # sync devolve {"success": False, "message": "boom"} → exit_code 0, "✓ Set A" na saída, aviso com "boom" e o comando de reenvio em stderr
def test_api_402_or_network_error_warns_and_exits_zero(monkeypatch): ...
def test_pull_from_provider_does_not_send_back(monkeypatch): ...       # integrations sync --direction pull → nenhum push
def test_rotate_and_import_also_send(monkeypatch): ...
async def test_client_omits_delete_keys_when_empty(): ...
```

- [ ] **Step 2: Rodar e ver falhar** — `cd apps/cli && python -m pytest tests/test_auto_sync.py -v` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar** — `python -m pytest tests/ -q && ruff check src/` → PASS.
- [ ] **Step 5: Commit** — `feat(cli): envio automático para a hospedagem ao salvar`

---

### Task 10: E2E, documentação e verificação final

**Files:**
- Create: `apps/web/cypress/e2e/auto-sync.cy.ts` (convenções de `plan-limits.cy.ts`)
- Modify: `docs/development/CHANGELOG.md`, a página de docs da API de integrações (`apps/web/src/app/[locale]/(docs)/docs/api/integrations/page.tsx` e as chaves dela em `apps/web/messages/*/docs.json`), a página de docs do GitHub Action (uma frase: sync por CI exige o Max), `deploy/vps/README.md` (o deploy depende do contêiner `scheduler`), `ROADMAP.md` (uma linha na fase atual)

- [ ] **Step 1: Escrever o E2E.** Dois casos, sem chamada real a provedor (`cy.intercept`):
  1. Usuário Free abre Integrações num projeto com uma conexão (lista interceptada): o bloco "Envio automático" aparece, os controles estão desabilitados e o texto "Disponível no plano Max." está na tela.
  2. Lista interceptada com `features: ["auto_sync", "sync_redeploy", "ci_sync"]` e uma conexão vinculada ao ambiente aberto; `POST .../sync` interceptado respondendo `{ success: true, synced_count: 1, deploy_scheduled: true }`. O usuário cria uma variável: o pedido de sync sai com a variável nova e o destino do vínculo, e a tela mostra "Enviado para" e "Novo deploy em cerca de 1 minuto.". Depois apaga a variável: o segundo pedido leva `delete_keys` com a chave.
- [ ] **Step 2: Rodar o E2E** com o stack local (`make dev`, depois o alvo de E2E do `Makefile`; a porta 3000 precisa estar livre) → PASS.
- [ ] **Step 3: Documentar.** CHANGELOG em "Unreleased": envio automático, apagar na hospedagem, deploy agrupado, sync por CI exige Max (**mudança que quebra** pipelines de contas Free e Pro que usam `ci deploy --provider`; self-host com `DEFAULT_PLAN=unlimited` não muda), `PATCH` novo, campos novos, deploy depende do agendador. Docs da API: `PATCH`, `delete_keys`, `deploy_scheduled`, `features`, os 402.
- [ ] **Step 4: Verificação final** — `cd apps/api && python -m pytest tests/ -q`; `cd apps/cli && python -m pytest tests/ -q`; `cd apps/web && npx jest && npx tsc --noEmit && npm run lint && npm run check:i18n && npm run build` → tudo PASS. À mão, no stack local com `update users set plan = 'max'`: vincular um ambiente, salvar uma variável e ver o aviso; voltar para `null` e ver os controles travados, o vínculo ainda gravado e o envio manual funcionando.
- [ ] **Step 5: Commit** — `test(e2e): envio automático; docs: recursos do Max`

## Fora deste plano

- **Cobrança, página de preços, tela de assinatura, atalho "assinar":** entrega 3.
- **Comando da CLI para configurar o vínculo** e **deploy de preview na Vercel:** ficam para quando alguém pedir.
- **Teste com provedor real:** decisão anterior do Jean; a primeira conferência de verdade é manual, numa conta Vercel de teste, antes de vender o Max.
- **GitHub Action (`packages/github-action`):** não chama o sync; só a documentação muda.
