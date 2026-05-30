# Current Task — CriptEnv

## Status atual

**Ajuste de RBAC de projetos em andamento em 2026-05-29. Owners/admins ficam responsáveis por settings e escrita de secrets; developers mantêm leitura/uso e convites limitados; revogação de convite passa a remover links pendentes do banco/UI.**

---

## Tarefa em foco

Aplicar permissões consistentes no dashboard/API para settings, secrets e convites, substituindo confirmações nativas por modais do app.

## O que foi implementado nesta sessão

### Backend — RBAC de Projeto ✅
- `ProjectResponse` agora inclui `current_user_role`.
- Escritas de vault via sessão humana exigem `admin`/`owner`; CI com `write:secrets` permanece permitido.
- Rotação e configuração/remoção de expiração de secrets exigem `admin`/`owner`.
- Developers podem convidar apenas `developer` ou `viewer`.
- Revogação de convite apaga o convite e notificações associadas.

### Frontend — Permissões e UX ✅
- Settings fica oculta para não-admins e acesso direto mostra modal de permissão.
- Ações administrativas de secrets são bloqueadas/ocultas para não-admins.
- Exclusão, rotação e remoção de expiração usam modais do app.
- Seleção de role usa controle segmentado preto, sem highlight azul nativo.

### Testes ✅
- Testes alvo API e Web adicionados/atualizados para permissões, convites, modais e role picker.

---

## Histórico anterior — Invite Notifications

### Backend — Sistema de Notificações ✅
- **`app/models/notification.py`**: Modelo `Notification` com `user_id`, `type`, `title`, `message`, `read_at`, `action_url`, `meta` (JSONB), timestamps.
- **`app/schemas/notification.py`**: Schemas Pydantic para response, list, mark-read, unread-count.
- **`app/services/notification_service.py`**: Service com create, list, unread count, mark read, mark all read.
- **`app/routers/notifications.py`**: Router com 4 endpoints:
  - `GET /api/v1/notifications`
  - `GET /api/v1/notifications/unread-count`
  - `PATCH /api/v1/notifications/{id}/read`
  - `PATCH /api/v1/notifications/read-all`
- **Migration**: `20260528_0009_create_notifications_table.py`
- **Integração em convites**: `app/routers/invites.py` agora cria notificação automaticamente quando o email convidado pertence a um usuário existente.
- **Correção 2026-05-29**: Convites agora normalizam email antes de verificar duplicidade, enviar email e buscar usuário existente para notificação.

### Frontend — Sistema de Notificações ✅
- **`src/lib/api/notifications.ts`**: Cliente tipado para todos os endpoints.
- **`src/stores/notifications.ts`**: Zustand store com estado de notificações, unread count, dropdown open/close, fetch, mark read (single/bulk).
- **`src/components/layout/notification-bell.tsx`**: Componente completo com:
  - Ícone de sino com badge dinâmico (mostra contagem real, sumiu quando zero)
  - Dropdown panel com lista de notificações
  - Ícones por tipo (invite, alert, system, email)
  - Formatação de tempo relativo ("agora", "5m", "2h", "3d")
  - Indicador visual de não lida (bolinha + background sutil)
  - Ação de "Marcar todas como lidas"
  - Click-through para `action_url`
  - Polling automático a cada 30 segundos
- **Correção 2026-05-29**: Dropdown agora usa tokens existentes, painel sólido/acessível e refaz fetch ao abrir para evitar lista vazia stale com badge não lido.
- **Correção 2026-05-29**: Página `/invites/accept` agora usa apenas o card do layout auth, com conteúdo compacto de uma dobra e sem wrapper `min-h-screen` aninhado.
- **`src/components/layout/top-nav.tsx`**: Substituído botão estático pelo `<NotificationBell />`.

### Email — Ajuste de Cores ✅
- Gradient do botão CTA: `#4f46e5 → #6366f1` (índigo) atualizado para `#171717 → #262626` (preto/cinza escuro)
- Links e cores de destaque atualizadas para `#171717`
- Security box com borda e background atualizados para combinar com o tema minimalista
- **Correção 2026-05-29**: CTA agora usa markup table-based centralizado e largura estável para alinhar corretamente no Gmail mobile.

### Testes ✅
- `tests/test_notification_routes.py`: 5 testes passando (list, unread count, mark read, mark all read, 404)
- `tests/test_invite_notifications.py`: cobre notificação para usuário existente e ausência de notificação para email sem conta.
- `tests/test_email_service.py`: cobre markup mobile-safe do CTA.
- `src/components/layout/__tests__/notification-bell.test.tsx`: cobre refresh ao abrir e painel vazio acessível/sólido.
- `src/app/(auth)/invites/accept/__tests__/page.test.tsx`: cobre detalhes do convite, aceite e ausência de shell full-screen aninhado.
- Suite completa API: **407 testes passando, 2 skipped**
- Suite completa Web unit: **73 testes passando**

### Documentação ✅
- `docs/development/CHANGELOG.md`: Entrada adicionada em [Unreleased]
- `docs/project/decisions.md`: DEC-049 e DEC-050 registrados
- `docs/project/current-state.md`: Atualizado para ~95% e marca notificações como implementadas


---

## Planejamento novo — Mobile notifications e bulk secrets (2026-05-30)

Foi criado o plano `plans/mobile-notifications-bulk-secrets-plan.md` para guiar duas entregas no dashboard web:

1. Corrigir o dropdown de notificações em mobile usando um painel viewport-safe, sem quebrar o dropdown desktop atual.
2. Adicionar seleção individual, seleção total e exclusão em lote de secrets no ambiente ativo, visível e acionável apenas para usuários `admin` e `owner`.

### Critérios principais planejados

- Developers/viewers continuam sem controles destrutivos ou checkboxes de seleção.
- A seleção é baseada em `secret.key`, limitada ao ambiente ativo e limpa ao trocar de ambiente ou bloquear o vault.
- A exclusão em lote recalcula o vault uma única vez e envia um único `pushSecrets`, preservando a arquitetura zero-knowledge.
- O dropdown mobile de notificações deve caber em larguras de 320px, 375px e 430px sem overflow horizontal.

---

## Próximos passos recomendados

1. **Smoke test RBAC**: Entrar como developer e confirmar que Settings não aparece, secret write abre modal de permissão e convite admin é bloqueado.
2. **Smoke test admin**: Entrar como admin/owner e confirmar que settings, rotação, exclusão e expiração continuam funcionais com modais.
3. **Produção**: Garantir que a migration de notificações já esteja aplicada antes de depender da limpeza de notificações de convites.

---

**Document Version**: 1.2
**Last Updated**: 2026-05-29
**Status**: Project RBAC and invite revocation implemented; verification in progress
