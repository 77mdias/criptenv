# Test Users

> Usuários de teste criados para desenvolvimento local e validação manual.
> **NÃO usar em produção.** Senhas fracas por design.

---

## Playwright / E2E

### `test-playwright@criptenv.dev`

| Campo | Valor |
| --- | --- |
| **Nome** | Test Playwright |
| **Email** | `test-playwright@criptenv.dev` |
| **Senha** | `TestPlay123!` |
| **ID (UUID)** | `b3720bd5-4aa7-4cb7-b9a8-2df8f870c006` |
| **Email verificado** | Sim (token aplicado via DB) |
| **2FA** | Desativado |
| **Criado em** | 2026-06-04 |
| **Ambiente** | Local (http://localhost:3000 / http://localhost:8000) |

**Fluxo de criação:**

1. Signup via UI (`/signup`) — name, email, password, confirmPassword
2. Verificação de email via token (coletado em `email_verification_tokens` e aplicado em `/api/auth/verify-email`)
3. Login via UI (`/login`) — sucesso, redirecionamento para `/dashboard`

**Comandos úteis:**

```bash
# Login
curl -X POST http://localhost:8000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test-playwright@criptenv.dev","password":"TestPlay123!"}'

# Reenviar email de verificação
curl -X POST http://localhost:8000/api/auth/send-verification \
  -H "Content-Type: application/json" \
  -d '{"email":"test-playwright@criptenv.dev"}'

# Resetar estado do usuário no DB (caso precise recomeçar)
PGPASSWORD=77mdevOpsCMD psql -h localhost -p 5433 -U postgres -d criptenv -c \
  "DELETE FROM users WHERE email = 'test-playwright@criptenv.dev';"
```

---

> Adicione novos usuários de teste abaixo conforme necessário, mantendo o
> formato da tabela.
