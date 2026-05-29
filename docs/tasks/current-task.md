# Current Task — CriptEnv

## Status atual

**Correção do sistema de notificações de convite em andamento em 2026-05-29. O fluxo mantém email para todos os convites e notificação in-app apenas para usuários já cadastrados, com normalização de email, dropdown visualmente sólido e CTA de email compatível com Gmail mobile.**

---

## Tarefa em foco

Corrigir confiabilidade e UX do sistema de notificações in-app para convites de projeto e o botão de aceite no email em mobile.

## O que foi implementado nesta sessão

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
- Suite completa API: **407 testes passando, 2 skipped**
- Suite completa Web unit: **71 testes passando**

### Documentação ✅
- `docs/development/CHANGELOG.md`: Entrada adicionada em [Unreleased]
- `docs/project/decisions.md`: DEC-049 e DEC-050 registrados
- `docs/project/current-state.md`: Atualizado para ~95% e marca notificações como implementadas

---

## Próximos passos recomendados

1. **Aplicar migration Alembic** `20260528_0009_create_notifications_table` no ambiente de produção.
2. **Smoke test**: Criar um convite para um usuário existente e verificar se a notificação aparece no bell icon com badge.
3. **Futuro**: Expandir notificações para outros eventos (secret expirations, member removed, etc.).

---

**Document Version**: 1.1
**Last Updated**: 2026-05-29
**Status**: Invite notification UX fix implemented and verified
