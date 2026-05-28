# Current Task — CriptEnv

## Status atual

**CI/API token remote-auth alignment implementado em 2026-05-28. A separação entre sessão humana, API Key, CI Token e sessão CI temporária agora reflete a arquitetura remota atual da CLI/API/Web.**

---

## Tarefa em foco

Corrigir gaps de CI Tokens e API Keys após a migração da CLI para fluxo remoto, mantendo least privilege e suporte Zero-Knowledge.

## O que foi implementado nesta sessão

### Programmatic Auth Alignment ✅
- API Keys agora preservam metadados no contexto de autenticação para enforcement de `scopes` e `environment_scope`.
- Vault pull/version exigem `read:secrets` ou `admin:project` quando autenticados via API Key.
- Environment e vault reads respeitam `environment_scope`.
- CI sessions `ci_s_` podem fazer vault push apenas com `write:secrets`.
- Integração list/sync via CI session exige `write:integrations`.

### CLI Remota ✅
- `criptenv ci tokens list/create/revoke` agora usa sessão humana normal.
- Removido registro top-level acidental de `criptenv tokens`; o caminho suportado é `criptenv ci tokens`.
- `ci login` salva `environment_scope`.
- `ci secrets` usa endpoint leve de listagem.
- `ci deploy` valida escopo, ambiente e `CRIPTENV_VAULT_PASSWORD` antes de escrever secrets.

### GitHub Action ✅
- Novo input opcional `vault-password`.
- Sem `vault-password`, mantém export de ciphertext.
- Com `vault-password`, decripta localmente no runner e exporta plaintext mascarado.

### Documentação/UI ✅
- Settings do projeto explicam diferença entre CI Tokens e API Keys.
- Docs de autenticação corrigidos para `Authorization: Bearer cek_...`.
- Changelog e decisions atualizados com DEC-048.

## Próximos passos recomendados

1. Validar smoke real: criar CI Token com `read:secrets,write:secrets`, executar `ci login` e `CRIPTENV_VAULT_PASSWORD=... criptenv ci deploy --env production --file .env.production`.
2. Validar GitHub Action em repositório de teste com e sem `vault-password`.
3. Quando a Public API de escrita for desenhada, reabilitar escopos reservados de API Key na UI/CLI.

---

## Status anterior

**2FA login enforcement implementado em 2026-05-28. Contas com 2FA ativo agora precisam concluir challenge TOTP/backup code antes de receber sessão em login por senha, OAuth ou autorização CLI via browser/device, com opção de lembrar dispositivo por 30 dias.**

---

## Tarefa anterior

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
