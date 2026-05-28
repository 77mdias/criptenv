# Current Task — CriptEnv

## Status atual

**2FA login enforcement implementado em 2026-05-28. Contas com 2FA ativo agora precisam concluir challenge TOTP/backup code antes de receber sessão em login por senha, OAuth ou autorização CLI via browser/device, com opção de lembrar dispositivo por 30 dias.**

---

## Tarefa em foco

Finalizar a aplicação real do 2FA no login web/OAuth/CLI browser auth, mantendo sessões em cookies HTTP-only e trusted devices também em cookie HTTP-only com token hashado no banco.

---

## O que foi implementado nesta sessão

### 2FA Challenge Enforcement ✅
- `POST /api/auth/signin` agora retorna `requires_two_factor=true` e cria cookie `two_factor_challenge` quando a conta tem 2FA ativo e o dispositivo não está lembrado.
- `POST /api/auth/2fa/challenge/verify` valida TOTP ou backup code antes de emitir `session_token`.
- Backup codes continuam hashados e são consumidos após uso.

### Trusted Devices ✅
- Criadas tabelas `two_factor_challenges` e `two_factor_trusted_devices`.
- Dispositivo lembrado usa cookie HTTP-only `two_factor_device` por 30 dias e token hashado no banco.
- Trusted device exige mesmo user-agent e não é renovado automaticamente.

### OAuth e CLI Auth ✅
- OAuth redireciona para `/2fa?next=/dashboard` quando a conta exige 2FA.
- `/cli-auth` preserva o fluxo original e encaminha para `/2fa` antes de autorizar CLI/device flow.

### Web ✅
- Criada página `/2fa` no layout padrão de autenticação.
- Login reconhece a resposta discriminada de 2FA e redireciona para o challenge preservando `redirect`.

### Documentação ✅
- Atualizados changelog, decisions, current state, task history e docs web de autenticação.

---

## Próximos passos recomendados

1. Aplicar migração Alembic `20260528_0008_create_two_factor_login_tables` no ambiente alvo.
2. Fazer smoke em produção: ativar 2FA em uma conta, sair, logar novamente, validar challenge, marcar "lembrar dispositivo" e confirmar que o próximo login no mesmo navegador pula o 2FA.
3. Validar OAuth e `criptenv login --device` com uma conta 2FA ativa.

---

**Document Version**: 1.17
**Last Updated**: 2026-05-28
**Status**: 2FA login enforcement implemented and verified locally
