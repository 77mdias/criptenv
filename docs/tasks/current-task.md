# Current Task — CriptEnv

## Status atual

**Sistema de Notificações In-App implementado em 2026-05-28. O ícone de notificação (bell) no top-nav agora é funcional, com badge dinâmico, dropdown de notificações, polling a cada 30s, e integração automática no fluxo de convites. Cores do template de email de convite foram atualizadas para combinar com a identidade visual atual.**

---

## Tarefa em foco

Implementar sistema de notificações in-app funcionando, integrado ao fluxo de convites de projeto, e ajustar cores do template de email.

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
- **`src/components/layout/top-nav.tsx`**: Substituído botão estático pelo `<NotificationBell />`.

### Email — Ajuste de Cores ✅
- Gradient do botão CTA: `#4f46e5 → #6366f1` (índigo) atualizado para `#171717 → #262626` (preto/cinza escuro)
- Links e cores de destaque atualizadas para `#171717`
- Security box com borda e background atualizados para combinar com o tema minimalista

### Testes ✅
- `tests/test_notification_routes.py`: 5 testes passando (list, unread count, mark read, mark all read, 404)
- Suite completa: **404 testes passando, 2 skipped**

### Documentação ✅
- `docs/development/CHANGELOG.md`: Entrada adicionada em [Unreleased]
- `docs/project/decisions.md`: DEC-049 registrado
- `docs/project/current-state.md`: Atualizado para ~95% e marca notificações como implementadas

---

## Próximos passos recomendados

1. **Aplicar migration Alembic** `20260528_0009_create_notifications_table` no ambiente de produção.
2. **Smoke test**: Criar um convite para um usuário existente e verificar se a notificação aparece no bell icon com badge.
3. **Futuro**: Expandir notificações para outros eventos (secret expirations, member removed, etc.).

---

**Document Version**: 1.0
**Last Updated**: 2026-05-28
**Status**: In-App Notification System implemented and tested
