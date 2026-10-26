# Experiência Autenticada — Design

**Status:** Aprovado (2026-10-26) · **Plano:** `docs/superpowers/plans/2026-10-26-authenticated-experience-plan.md` · **Roadmap:** Phase 3.5

## Problema

Landing, docs e páginas de segurança estão maduras, mas a área logada parece vazia:

- O dashboard mostra três contadores e um feed com códigos crus (`project.created · project / project`), com rótulos misturando EN/PT (`PROJECTS`, `LAST SYNC`).
- A visão geral do projeto (`projects/[id]/page.tsx`) é só um menu com texto fixo em PT, sem nenhum dado do projeto.
- `/integrations` existe, mas não está na sidebar (`components/layout/dashboard-nav.ts`).
- A API já entrega muito mais do que a UI mostra: expirações (`listExpiring`), histórico de rotação (`getRotationHistory`, sem nenhum uso na UI), tokens de CI e API keys com `last_used_at`/`expires_at`, integrações com `status`/`last_sync_at`/`last_error`, auditoria filtrável. Esses dados estão escondidos em painéis de settings ou não aparecem.

## Objetivo

Transformar a área logada num **centro de comando**: em cada tela o usuário vê o estado real dos seus projetos e **o que fazer em seguida**, aproveitando primeiro dados que já existem.

## Princípios

1. **Zero-knowledge intocado.** Toda visão nova usa só metadados que o servidor já conhece: nomes de chave (`vault_blobs.key_id`), versões, datas, auditoria, tokens. Comparar **valores** só no cliente, depois de destravar com a vault password, nunca no servidor.
2. **Ação, não só informação.** Todo alerta tem um botão que resolve; todo estado vazio tem um CTA e o comando de CLI equivalente.
3. **Dados existentes primeiro.** Endpoint novo só quando a alternativa é N+1 requisições no cliente ou dado que não existe.
4. **Permissões do backend são a fonte da verdade.** `viewer` não vê tokens nem API keys; ações de owner/admin seguem os checks existentes.
5. **i18n desde o início.** Nenhum texto fixo; chaves nas 3 locales (`check:i18n` no CI).
6. **Responsivo e acessível:** 320–430 px, foco visível, Radix `Dialog`/`Sheet`, contraste nos dois temas.

## Funcionalidades

### F1 — Fundação e quick wins
- **Integrações na sidebar**, com contador de integrações com erro.
- **Feed de atividade legível:** um mapa `action → frase` (i18n), por exemplo "Você criou o projeto **api-prod**" e "CI (token *Deploy*) enviou 2 secrets para production". Ações de sessão de CI hoje chegam com `user_id = null`; a origem vem de `metadata.auth_type`.
- **Ator na auditoria:** `AuditLogResponse` ganha `actor` (`name`, `email`, `avatar_url`) e `auth_type` (`session` | `api_key` | `ci_session`), resolvidos no servidor para não exigir chamadas extras por linha.
- **Datas relativas** ("há 2 h", com a data absoluta no tooltip) e rótulos do dashboard traduzidos.

### F2 — Dashboard como centro de comando
- **Endpoint agregado `GET /api/v1/me/overview`.** Substitui o fan-out atual (projetos, depois ambientes, depois `vault/version` por ambiente). Retorna:
  - por projeto: papel, ambientes (nome, quantidade de secrets, versão, `updated_at`), número de membros e última atividade;
  - `attention`: secrets expirando ou expirados, convites pendentes, tokens e keys sem expiração ou sem uso há 30 dias ou mais, integrações com `status = error`. Tokens e keys só aparecem para projetos onde o usuário é owner/admin.
- **Card "Precisa de atenção":** lista priorizada (expirado > erro de integração > expira em 7 dias > token parado > convite pendente), cada item com link direto para a correção.
- **Checklist de onboarding:** aparece até ser concluído ou dispensado (preferência guardada em `localStorage`). Passos: criar projeto, configurar a vault password, primeiro secret, instalar a CLI (`pip install criptenv`, com botão de copiar), primeiro token de CI.
- **Grade de projetos:** ambientes, total de secrets, última alteração, avatares de até 4 membros e um badge de saúde que vem da contagem de atenção.
- **Atividade dos últimos 30 dias:** gráfico de barras por dia (pushes, rotações, acessos de CI), agregado no servidor a partir de `audit_logs`.

### F3 — Visão geral do projeto
- **Matriz chave × ambiente:** linhas são os `key_id`, colunas são os ambientes, e cada célula mostra presente ou ausente, com a versão. Destaca chaves que faltam em algum ambiente. Usa um endpoint novo, `GET /projects/{id}/secrets/matrix`, que retorna só nomes, versões e `updated_at`, sem ciphertext.
- **"Como usar este projeto":** abas CLI / GitHub Action / GitLab / API com o `project_id` já preenchido e botão de copiar, usando os snippets já validados na documentação.
- **Resumo:** membros, tokens ativos, expirações próximas e as 5 atividades mais recentes do projeto.

### F4 — Detalhe do secret
Painel lateral (Radix `Dialog` no modo sheet) aberto a partir da tabela de secrets:
- linha do tempo de versões e rotações (`getRotationHistory`);
- quem alterou e quando (auditoria filtrada por `resource_id`);
- expiração: ver, definir e remover (APIs existentes);
- ações de rotacionar e copiar o valor (copiar exige o vault destravado, como hoje);
- integrações que sincronizam o ambiente.

### F5 — Telas novas
| Tela | Rota | Conteúdo | Backend |
|---|---|---|---|
| **Atividade** | `/activity` | Auditoria de todos os projetos do usuário; filtros por projeto, ação, ator, origem (CI/API/usuário) e período; exportação CSV | `GET /api/v1/me/audit` (novo, paginado) |
| **Acessos** | `/access` | Todos os tokens de CI e API keys dos projetos onde o usuário é owner/admin: escopos, ambiente, último uso, expiração, revogar | `GET /api/v1/me/credentials` (novo); revogar usa as rotas existentes |
| **Segurança** | `/security` | Nota de segurança da conta e dos projetos, com checklist acionável (regras abaixo) | agrega `me/overview` e `me/credentials` + dados da conta |
| **Comparar ambientes** | `/projects/[id]/compare` | Duas colunas (A × B): chaves só em A, só em B, versões diferentes. Com o vault destravado, compara também os valores **no cliente** | reutiliza `secrets/matrix` e `vault/pull` |

**Regras da nota de segurança** (cada regra tem peso, explicação e uma ação):
- 2FA desativado (alto);
- token de CI ou API key sem expiração (médio);
- credencial sem uso há 30 dias ou mais (médio);
- secret sem rotação há 90 dias ou mais (médio);
- secret expirado (alto);
- mais de 2 owners/admins em um projeto (baixo);
- integração com erro (baixo).

### F6 — Acabamento
- **Busca rápida (Ctrl/Cmd+K)** a partir do ícone de busca no topo: pular para projeto, ambiente, secret (pelo nome) ou tela, e copiar comandos da CLI.
- **Estados vazios padronizados:** um componente `EmptyState` com ícone, texto, CTA e comando de CLI.
- **Skeletons** no lugar de spinners nas listas principais.

## Fora de escopo
- Mostrar valores de secrets fora do fluxo de destravar que já existe.
- Analytics de uso por secret, que exigiria registrar leituras, uma mudança de produto à parte.
- Os itens enterprise da Phase 4 (SSO, papéis customizados).

## Riscos
- **Performance dos agregados:** `me/overview` e `me/audit` precisam de índices (`audit_logs(project_id, created_at)` e `vault_blobs(project_id, environment_id)`). Medir com `EXPLAIN` antes de liberar.
- **Vazamento entre projetos:** todo endpoint `me/*` filtra por participação; testes negativos são obrigatórios (usuário B não vê dados do projeto de A).
- **Quantidade de chaves i18n:** cada feature adiciona chaves nas 3 locales; o `check:i18n` no CI cobre isso.
