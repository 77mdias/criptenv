# Experiência Autenticada — Plano de Implementação

**Objetivo:** fazer da área logada um centro de comando (dashboard acionável, visão real do projeto, detalhe de secret e telas de Atividade, Acessos, Segurança e Comparar ambientes) sem quebrar o zero-knowledge.

**Spec:** `docs/superpowers/specs/2026-10-26-authenticated-experience-design.md`

**Stack:** FastAPI + SQLAlchemy async + Alembic · React 19/Vinext + TailwindCSS v4 + Radix · Zustand/React Query · Jest + Cypress · next-intl (`apps/web/messages/{pt-BR,en,es}`).

**Convenções que valem para todas as tarefas:**
- TDD: teste vermelho → implementação → verde. Endpoints `me/*` sempre com **teste negativo** (o usuário B não vê o projeto de A) e de papel (`viewer` não recebe credenciais).
- Mutações só via services; leituras agregadas ficam em `app/services/overview_service.py` (novo).
- Toda string nova nas 3 locales; `npm run check:i18n` precisa passar.
- Gráficos em SVG/CSS puro: nenhuma dependência nova de charts.
- Cada milestone é um PR próprio, com entrada no `docs/development/CHANGELOG.md`.

---

## Ordem e dependências

```
UX.1 Fundação ──┬─▶ UX.2 Dashboard ──▶ UX.5b Segurança
                ├─▶ UX.3 Projeto ────▶ UX.4 Detalhe do secret ──▶ UX.5d Comparar
                └─▶ UX.5a Atividade    UX.5c Acessos
UX.6 Acabamento (Ctrl+K, EmptyState, skeletons) pode correr em paralelo após UX.1
```

| Milestone | Entrega | Backend novo | Tamanho |
|---|---|---|---|
| **UX.1** | Sidebar, feed legível, ator na auditoria, i18n e datas | `actor` + `auth_type` no `AuditLogResponse` | P |
| **UX.2** | Dashboard: atenção, onboarding, grade de projetos, gráfico de 30 dias | `GET /api/v1/me/overview`, `GET /api/v1/me/activity-stats` | G |
| **UX.3** | Visão geral do projeto: matriz chave × ambiente, "Como usar", resumo | `GET /projects/{id}/secrets/matrix` | M |
| **UX.4** | Painel lateral do secret | filtro `resource_id` no audit | M |
| **UX.5a** | Tela Atividade | `GET /api/v1/me/audit` | M |
| **UX.5b** | Tela Segurança | — (reusa os `me/*`) | M |
| **UX.5c** | Tela Acessos | `GET /api/v1/me/credentials` | M |
| **UX.5d** | Comparar ambientes | — (reusa a matriz e `vault/pull`) | M |
| **UX.6** | Ctrl+K, `EmptyState`, skeletons | — | M |

P ≈ 1–2 dias · M ≈ 3–4 dias · G ≈ 5–7 dias (uma pessoa).

---

## UX.1 — Fundação e quick wins

**Backend**
- [ ] `apps/api/app/schemas/audit.py`: adicionar ao `AuditLogResponse`
  - `actor: Optional[AuditActor]` com `name`, `email` e `avatar_url`;
  - `auth_type: Literal["session", "api_key", "ci_session"]`, derivado de `metadata.auth_type` (padrão `session`).
- [ ] `apps/api/app/services/audit_service.py`: resolver os atores com **um** `select` em `users` para os `user_id` da página (evitar N+1).
- [ ] Testes em `apps/api/tests/test_audit*.py`:
  - log de usuário traz `actor`;
  - log de CI traz `actor = null` e `auth_type = "ci_session"`;
  - uma página com 50 logs faz 2 queries no total.

**Frontend**
- [ ] `components/layout/dashboard-nav.ts`: item **Integrações** (`/integrations`) com badge de erros (por enquanto vindo de `integrationsApi.list`; trocar por `me/overview` na UX.2).
- [ ] `lib/audit/describe.ts` (novo): `describeAuditLog(log, t)` → `{ icon, title, subtitle, href }` cobrindo todas as `action` emitidas pela API. Levantar a lista com `grep -rhoE 'action="[a-z_.]+"' apps/api/app`. Ação desconhecida cai num fallback genérico.
- [ ] `lib/format/relative-time.ts` (novo): `Intl.RelativeTimeFormat` na locale ativa, com a data absoluta no `title`.
- [ ] Dashboard: rótulos dos cards via i18n; trocar "Last sync" por **"Última alteração"** (o maior `updated_at` dos ambientes).
- [ ] `projects/[id]/page.tsx`: tirar o texto fixo em PT (a página é reescrita na UX.3).
- [ ] Testes Jest: `describeAuditLog` (incluindo CI e o fallback) e `relative-time` nas 3 locales.

**Aceite:** o feed mostra frases como "Você criou o projeto X · há 2 h"; nenhum rótulo em EN na locale pt-BR; Integrações acessível pela sidebar.

---

## UX.2 — Dashboard como centro de comando

**Backend**
- [ ] `app/services/overview_service.py` + `app/routers/me.py` (prefixo `/api/v1/me`, registrado em `main.py`).
- [ ] `GET /me/overview` → `OverviewResponse`:
  ```
  projects[]: id, name, slug, role, member_count, last_activity_at,
              environments[]: id, name, secret_count, version, updated_at
  attention: expired[], expiring[] (≤7 dias), pending_invites[],
             stale_credentials[] (sem expiração ou sem uso ≥30 dias; só owner/admin),
             failing_integrations[] (status = error, com last_error)
  totals: projects, secrets, members
  ```
  Contagens via `GROUP BY` (vault_blobs por ambiente, members por projeto), sem laço por projeto.
- [ ] `GET /me/activity-stats?days=30` → `[{ date, pushes, rotations, ci_reads }]`, agregado por `date_trunc('day')` em `audit_logs`, filtrado aos projetos do usuário.
- [ ] Migration: índice `audit_logs (project_id, created_at DESC)`, se ainda não existir.
- [ ] Testes:
  - isolamento entre usuários;
  - `viewer` sem `stale_credentials`;
  - totais corretos com 2 projetos × 3 ambientes;
  - `activity-stats` preenche com zero os dias sem eventos.

**Frontend**
- [ ] `lib/api/me.ts` (novo) com hooks React Query `useOverview`/`useActivityStats`; o dashboard deixa de fazer fan-out.
- [ ] `components/dashboard/attention-card.tsx`: itens ordenados por severidade, cada um com CTA (ex.: "Definir nova expiração" → `/projects/{id}/secrets?key=X`).
- [ ] `components/dashboard/onboarding-checklist.tsx`: passos derivados do overview; "Dispensar" grava em `localStorage` (com try/catch); some quando tudo estiver concluído.
- [ ] `components/dashboard/project-grid.tsx`: card com ambientes, secrets, última alteração, avatares e badge de saúde.
- [ ] `components/dashboard/activity-chart.tsx`: barras SVG empilhadas, tooltip acessível e tabela alternativa para leitores de tela.
- [ ] Jest: ordem do card de atenção, regras do checklist, gráfico com zero dados. Cypress: dashboard de uma conta nova (checklist visível) e de uma conta com dados (grade e atenção), em 375 px e 1280 px.

**Aceite:** uma conta nova vê o checklist com o comando da CLI; uma conta com um secret expirado vê o item no topo do card de atenção com link funcional; o dashboard faz no máximo 3 requisições.

---

## UX.3 — Visão geral do projeto

**Backend**
- [ ] `GET /api/v1/projects/{id}/secrets/matrix` → `{ environments[], keys[]: { key_id, cells: { [env_id]: { version, updated_at } | null } } }`. Só metadados, sem ciphertext, IV ou tag; acessível a qualquer membro (mesma regra do `vault/pull`).
- [ ] Testes: o payload não contém `ciphertext`; um não-membro recebe 404.

**Frontend**
- [ ] Reescrever `projects/[id]/page.tsx`:
  - `components/projects/key-matrix.tsx`: tabela com cabeçalho fixo, célula ausente destacada, filtro "só divergentes" e scroll horizontal no mobile;
  - `components/projects/usage-snippets.tsx`: abas CLI / GitHub Action / GitLab / API com o `project_id` interpolado. Os snippets saem de um módulo compartilhado com as páginas de docs, para não divergirem;
  - resumo com membros, tokens ativos, expirações e as 5 últimas atividades (reusando `describeAuditLog`).
- [ ] Os `ProjectSectionCards` passam para a navegação secundária (as abas já existentes no layout).
- [ ] Jest: matriz com chave ausente e filtro de divergentes; snippets com o ID correto.

**Aceite:** um projeto com `STRIPE_KEY` só em production mostra a ausência em dev e staging; o snippet copiado roda sem edição, exceto pelos segredos.

---

## UX.4 — Detalhe do secret

**Backend**
- [ ] `routers/audit.py`: filtro opcional `resource_id`, implementado como uma estratégia nova em `app/strategies/audit_filters.py`, seguindo o padrão existente. Teste da estratégia.

**Frontend**
- [ ] `components/secrets/secret-detail-sheet.tsx` (Radix `Dialog` em modo sheet), aberto pela linha da tabela e com URL `?key=NAME` para deep link (usado pelo card de atenção):
  - linha do tempo com `rotationApi.getRotationHistory` + auditoria por `resource_id`;
  - expiração com `setExpiration`/`deleteExpiration` (já existentes);
  - ações de rotacionar e copiar reaproveitando os fluxos de `use-project-secrets.ts`, sem duplicar a lógica de vault.
- [ ] Jest: abre pelo deep link, mostra o histórico e o foco volta à linha ao fechar. Cypress: definir uma expiração pelo painel.

**Aceite:** o histórico aparece sem destravar o vault; copiar o valor continua exigindo o vault destravado.

---

## UX.5a — Atividade (`/activity`)
- [ ] Backend: `GET /api/v1/me/audit?project_id=&action=&auth_type=&actor_id=&from=&to=&page=`, que reutiliza as estratégias de filtro e é limitado aos projetos do usuário. Testes de isolamento e de cada filtro.
- [ ] Frontend: `app/[locale]/(dashboard)/activity/page.tsx`, com os filtros na URL (compartilháveis), agrupamento por dia, `describeAuditLog` e **Exportar CSV** gerado no cliente a partir da página filtrada (`shortcut: exporta só as páginas carregadas; mover para streaming no servidor se passar de ~10k linhas`).
- [ ] Sidebar: item **Atividade**.

## UX.5b — Segurança (`/security`)
- [ ] `lib/security/posture.ts`: funções puras `evaluatePosture(overview, credentials, account)` → `{ score, findings[] }` com as regras e pesos da spec. **Teste unitário por regra.**
- [ ] Página com anel de nota (SVG), lista de achados ordenada e CTA em cada achado (ativar 2FA → `/account`; credencial → `/access`; secret → painel lateral do secret).
- [ ] Sidebar: item **Segurança**, com badge quando houver achado alto.

## UX.5c — Acessos (`/access`)
- [ ] Backend: `GET /api/v1/me/credentials` → tokens de CI e API keys dos projetos onde o usuário é owner/admin, com escopos, ambiente, `last_used_at`, `expires_at` e status. Testes: `viewer`/`developer` não recebem nada; tokens revogados vêm marcados.
- [ ] Frontend: tabela única com filtro por tipo, status e projeto. Revogar usa `ciTokensApi`/`apiKeysApi` existentes, com o `ConfirmActionDialog` existente. Destacar credencial sem expiração ou parada.
- [ ] Sidebar: item **Acessos**.

## UX.5d — Comparar ambientes (`/projects/[id]/compare`)
- [ ] Seletores A e B; diferenças de chaves e versões a partir da matriz (UX.3).
- [ ] "Comparar valores": exige o vault destravado; usa `vault/pull` dos dois ambientes e decifra **no cliente**. Mostra só igual/diferente e uma prévia mascarada, como o `criptenv diff --show-values`. Nenhum valor sai do navegador.
- [ ] Jest: diff de chaves; diff de valores com o vault mockado; nenhuma chamada de rede com plaintext.

---

## UX.6 — Acabamento (paralelo, após UX.1)
- [ ] `components/command-palette.tsx`: Ctrl/Cmd+K e clique no ícone de busca do topo. Fontes: projetos, ambientes e nomes de secret (do overview e da matriz já carregados) e telas. Ações: navegar e copiar comandos da CLI. Acessível (`role="dialog"`, `aria-activedescendant`).
- [ ] `components/ui/empty-state.tsx`, aplicado nas listas de projetos, secrets, membros, integrações, atividade e acessos.
- [ ] Trocar spinners por `components/ui/skeleton.tsx` nas listas principais.

---

## Documentação e release (a cada milestone)
- [ ] `docs/development/CHANGELOG.md` em `[Unreleased]`.
- [ ] `docs/features/in-progress.md` → `implemented.md` ao concluir.
- [ ] Docs públicas (`/docs/api/*`) para os endpoints `me/*` e `secrets/matrix`.
- [ ] `ROADMAP.md`: atualizar o status do milestone na Phase 3.5.
