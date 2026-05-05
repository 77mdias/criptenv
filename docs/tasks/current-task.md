# Current Task — CriptEnv

## Status atual

**Project-scoped vault passwords — IMPLEMENTADO.**

---

## Tarefa em foco

Implementar senha de vault por projeto com zero-knowledge rígido em API, Web e CLI.

---

## O que foi implementado nesta sessão

### Vault password por projeto ✅
- Criação de projeto exige `vault_config` e `vault_proof`.
- API armazena apenas metadata criptográfica e hash bcrypt da prova em `projects.settings.vault`.
- Respostas de projeto expõem `vault_config` sanitizado e nunca retornam `proof_hash`.
- Vault `push` exige `vault_proof` para projetos v1.
- Settings ganhou rotação de senha do vault com recriptografia client-side.
- Settings também migra projetos legados sem `vault_config` usando a senha legada derivada do `kdf_salt` do usuário.
- CLI ganhou `criptenv projects create`; `push`, `pull` e `ci deploy` convertem entre vault local e vault do projeto.

### Segurança ✅
- Senha do vault nunca é enviada nem armazenada em claro.
- A prova de escrita/rekey é derivada separadamente da chave de descriptografia.
- Política de recuperação é zero-knowledge rígida: senha esquecida não é recuperável.

---

## Documentação atualizada

- [x] `docs/project/decisions.md` — DEC-013
- [x] `docs/development/CHANGELOG.md` — seção Project-Scoped Vault Passwords
- [x] `docs/project/current-state.md` — estado e contagens atualizadas
- [x] `docs/tasks/task-history.md` — sessão registrada
- [x] `docs/tasks/current-task.md` — este arquivo

---

## Próximos passos recomendados

1. Planejar transferência rápida de membros entre projetos como feature separada.
2. Continuar pendências Phase 3: RailwayProvider, Integration Config Encryption e Web Alert UI.
3. Validar manualmente a migração de um projeto legado real antes de remover qualquer fallback antigo.

---

**Document Version**: 1.3
**Last Updated**: 2026-05-05
**Status**: Implementation complete — ready for review
