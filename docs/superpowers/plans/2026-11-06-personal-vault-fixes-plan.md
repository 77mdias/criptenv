# Cofre Pessoal: Plano de Correções da Revisão

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: usar superpowers:subagent-driven-development ou superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** corrigir os 7 problemas menores que a revisão final do PR #75 apontou e que ficaram adiados.

**Arquitetura:** a Fase A muda o **formato** dos envelopes: AAD amarrando cada envelope ao seu lugar, ids gerados pelo cliente e `wrapKey`/`unwrapKey` nativos. Por isso ela deve entrar **antes de o cofre ter dados reais**, ou seja, antes do merge do PR #75 ou antes de anunciar a feature. A Fase B só corrige comportamento e não mexe no formato.

**Stack:** a mesma do plano original (FastAPI + SQLAlchemy async · React 19/Vinext · WebCrypto · Jest + Cypress).

**Spec:** a seção "Decisões de design" de `docs/superpowers/plans/2026-11-06-personal-vault-plan.md`, junto com `docs/security/personal-vault.md`. Este plano não muda nenhuma decisão de lá. Só fecha lacunas que a revisão encontrou.

## Problemas e onde cada um é resolvido

| # | Problema (revisão do PR #75) | Efeito para quem usa | Tarefa |
|---|---|---|---|
| 1 | Envelopes sem AAD: o servidor pode trocar resumo e corpo entre itens, mudar `protected` ou, via `{...summary, ...body}`, sobrescrever `title`/`type` | Num servidor comprometido, um item mostra o conteúdo de outro ou perde a proteção extra sem que ninguém perceba | A1 |
| 2 | `fill(0)` não zera de verdade: VK e PK passam por strings base64, que são imutáveis | O material da chave fica no heap do JS até o garbage collector passar | A2 |
| 3 | Apagar em outra aba e depois editar ou apagar aqui mostra erro genérico | A pessoa não entende o que houve e a lista fica velha | B1 |
| 4 | `Promise.all` ao decifrar a lista | Um envelope corrompido some com a lista inteira | B2 |
| 5 | Dois `POST /config` simultâneos dão 500 | Erro genérico em vez de "o cofre já existe" | B3 |
| 6 | A chave de recuperação recusa travessão, `_`, `.` e outros separadores | Uma chave colada de um PDF ou documento parece inválida | B4 |
| 7 | Lacunas de teste: 403 só em 1 de 7 rotas, trava por inatividade sem diálogo aberto, UPDATE condicional sem teste no Postgres | Uma regressão nesses pontos passaria pela CI | B5 |

## Restrições globais

- Fase A antes de haver dados reais no cofre: sem migração de envelopes antigos e sem campo de versão de formato. **Se o PR #75 já tiver sido mergeado e usado em produção, a Fase A precisa de um passo extra de migração. Parar e decidir com o Jean.**
- AAD em UTF-8 no formato `criptenv:pv1:<contexto>`, com estes contextos exatos:
  - **Itens:** resumo `item:<itemId>:summary`; corpo `item:<itemId>:body:common` ou `item:<itemId>:body:protected`.
  - **Chaves da config:** `config:master_vault_key`, `config:recovery_vault_key`, `config:recovery_protected_key`, `config:extra_protected_key:inner` e `config:extra_protected_key:outer`.
- O id do item é gerado pelo cliente com `crypto.randomUUID()`. A API aceita o `id` no POST, valida como UUID e responde 409 `"Item id already exists"` se ele já existir.
- Nenhuma dependência nova. Toda string nova nas 3 locales, e `npm run check:i18n` passando.
- Commits no padrão do repo, numa branch `fix/personal-vault-review` cortada do estado atual de `feature/personal-vault`, ou da `main` se o PR #75 já tiver sido mergeado.

## Pontos de atenção na revisão

1. **Trocar resumo ou corpo entre dois itens do mesmo usuário** (simulando o servidor): o cliente recusa e mostra o item como ilegível, sem exibir o conteúdo do outro (A1 + B2).
2. **Inverter `protected` no servidor:** um corpo cifrado com PK e marcado como comum, ou o contrário, não abre (A1).
3. **Corpo que tenta trazer `title`/`type`:** é ignorado; vale sempre o resumo (A1).
4. **Chave de recuperação colada com travessões tipográficos** (`–`, `—`) ou quebras de linha: é aceita (B4).
5. **Dois `POST /config` ao mesmo tempo:** um responde 201 e o outro 409, nunca 500 (B3).

## Fora do escopo

- **Detectar rollback** (o servidor devolvendo uma versão antiga de um item com a `version` antiga). Exigiria guardar estado no cliente. Fica registrado em `docs/security/personal-vault.md`.
- **Mitigar a substituição da config por uma sessão roubada** (reautenticação ou e-mail de aviso). É um risco aceito no plano original e merece um plano próprio.

---

## Fase A: formato dos envelopes (antes de haver dados reais)

### Tarefa A1: AAD em todos os envelopes e ids gerados pelo cliente

**Arquivos:**
- Modificar: `apps/web/src/lib/personal-vault/crypto.ts`, `apps/web/src/lib/crypto.ts` (parâmetro opcional `aad` em `encrypt`/`decrypt`), `apps/web/src/lib/api/personal-vault.ts`, `apps/web/src/app/[locale]/(dashboard)/vault/_components/vault-item-dialog.tsx`
- Modificar: `apps/api/app/schemas/personal_vault.py` (`PersonalVaultItemCreate.id: UUID`; `PersonalVaultItemUpdate` não aceita `id`), `apps/api/app/services/personal_vault_service.py` (usa o `id` recebido; colisão vira `PersonalVaultConflict("Item id already exists")`)
- Teste: `apps/web/src/lib/personal-vault/__tests__/crypto.test.ts`, `apps/api/tests/test_personal_vault.py`

**Interfaces:**
- `encrypt(plaintext, key, aad?: string)` e `decrypt(ciphertext, key, iv, authTag, aad?: string)` em `@/lib/crypto`. Sem `aad`, o comportamento atual continua igual (o cofre de projetos não muda).
- `encryptItem(id: string, item, vaultKey, protectedKey | null): Promise<EncryptedItem & { id: string }>`
- `decryptSummary(id: string, summary, vaultKey)`
- `decryptItem(item: { id; protected; summary; body }, vaultKey, bodyKey)`: monta o resultado campo a campo. `type`/`title`/`username`/`url` vêm do resumo; `password`/`notes`/`content` vêm do corpo. Nenhum spread do corpo.
- `createPersonalVaultItem(input: EncryptedItem & { id: string })`
- O id do item novo é gerado no diálogo com `crypto.randomUUID()`.

- [ ] **Passo 1: testes que falham**
  - Web: `swapping summary and body between items is rejected`. Cifrar os itens A e B e tentar `decryptSummary(A.id, B.summary)`: espera `DECRYPTION_FAILED`.
  - Web: `flipping the protected flag is rejected`. `decryptItem({ ...enc, protected: false }, vk, pk)`: espera `DECRYPTION_FAILED`.
  - Web: `body cannot override summary fields`. Montar um corpo com `{ title: "X", type: "note" }` cifrado com o AAD certo: `decryptItem` devolve o título do resumo.
  - Web: `config envelopes are bound to their field`. Colocar `recovery_wrapped_vault_key` no lugar de `master_wrapped_vault_key`: `unlockVault` espera `WRONG_PASSWORD`.
  - Web: os testes atuais continuam passando, só com o id novo nas chamadas.
  - API: `test_item_create_uses_client_id` (o POST com `id` devolve o mesmo id) e `test_item_create_duplicate_id_conflicts` (o segundo POST com o mesmo id dá 409 `"Item id already exists"`).
- [ ] **Passo 2:** rodar `npx jest src/lib` e `pytest tests/test_personal_vault.py`. Esperado: FAIL.
- [ ] **Passo 3:** implementar. O AAD vai em `additionalData` do AES-GCM. O POST da API trata `IntegrityError` dentro de `begin_nested()`.
- [ ] **Passo 4:** rodar a suíte inteira do web e da API. Esperado: PASS.
- [ ] **Passo 5:** commit `fix(web,api): bind personal vault envelopes to their item and field`.

### Tarefa A2: VK e PK sem passar por strings

**Arquivos:**
- Modificar: `apps/web/src/lib/personal-vault/crypto.ts`
- Teste: `apps/web/src/lib/personal-vault/__tests__/crypto.test.ts`

**Interfaces:** as funções públicas não mudam, só a parte interna:
- **Criação:** VK e PK nascem com `crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])`, são embrulhadas com `crypto.subtle.wrapKey("raw", key, kek, { name: "AES-GCM", iv, additionalData })` e reimportadas como não extraíveis para uso.
- **Desbloqueio:** `crypto.subtle.unwrapKey(..., false, ["encrypt", "decrypt"])` direto.
- **`rewrapMaster`, `rewrapExtra` e `recoverVault`:** abrem a chave como **extraível** só dentro da função, para embrulhar de novo.
- `bufferToBase64` deixa de receber bytes de chave. Só IV, salts e ciphertext passam por base64.
- O envelope continua `{ iv, ciphertext, auth_tag }`, separando a tag dos últimos 16 bytes do resultado de `wrapKey`.

- [ ] **Passo 1: teste que falha.** `unlocking never turns key material into text`: com `jest.spyOn` em `decrypt` de `@/lib/crypto` e em `crypto.subtle.unwrapKey`, chamar `unlockVault` e `unlockProtectedKey`. Esperado: `decrypt` **não** é chamado (hoje é, porque a chave volta como texto base64) e `unwrapKey` é chamado uma vez em cada função. O teste olha o caminho das chamadas e não os bytes, porque os salts também têm 32 bytes.
- [ ] **Passo 2:** `npx jest src/lib/personal-vault`. Esperado: FAIL.
- [ ] **Passo 3:** implementar e remover os `fill(0)` que ficarem sem sentido.
- [ ] **Passo 4:** rodar a suíte do web e o Cypress `personal-vault.cy.ts`. Esperado: PASS.
- [ ] **Passo 5:** commit `fix(web): wrap personal vault keys with WebCrypto wrapKey/unwrapKey`. Atualizar a seção "Chaves" de `docs/security/personal-vault.md`.

---

## Fase B: comportamento (sem mudar o formato)

### Tarefa B1: item apagado em outra aba

**Arquivos:** `vault/_components/vault-item-dialog.tsx`, `vault/_components/vault-items.tsx`, `messages/{pt-BR,en,es}/vault.json`. Teste: `vault/__tests__/vault-items.test.tsx`.

- Um 404 em `updatePersonalVaultItem` segue o mesmo caminho do 409: o diálogo fecha, aparece o aviso **"Este item foi apagado em outra aba."** (`itemDialog.deleted`) e a lista recarrega.
- Um 404 em `deletePersonalVaultItem` só recarrega a lista, sem erro, porque o item já não existe.
- [ ] Testes: `editing an item deleted elsewhere shows a notice and reloads` e `deleting an item already deleted elsewhere just reloads`. RED → implementar → GREEN → commit `fix(web): handle personal vault items deleted in another tab`.

### Tarefa B2: um envelope ruim não derruba a lista

**Arquivos:** `vault/_components/vault-items.tsx`, mensagens. Teste: `vault/__tests__/vault-items.test.tsx`.

- Trocar `Promise.all` por `Promise.allSettled`. Um item que não decifra vira a linha **"Item ilegível"** (`items.unreadable`), só com a ação de apagar. Ele não entra na busca nem no filtro.
- [ ] Teste: `an undecryptable item is listed as unreadable and the rest still shows`. `decryptSummary` rejeita o `i2` e os outros aparecem. RED → GREEN → commit `fix(web): keep the vault list usable when one item cannot be decrypted`.

### Tarefa B3: `POST /config` concorrente

**Arquivos:** `apps/api/app/services/personal_vault_service.py`. Teste: `apps/api/tests/test_personal_vault.py`.

- O `flush` de `create_config` vai para dentro de `async with self.db.begin_nested()`. Um `IntegrityError` vira `PersonalVaultConflict("Personal vault already exists")`.
- [ ] Teste: `test_concurrent_create_config_conflicts_not_500`. Com `monkeypatch`, fazer `get_config` devolver `None` uma vez, para forçar o INSERT a colidir com a config existente: espera 409. RED → GREEN → commit `fix(api): return 409 on concurrent personal vault creation`.

### Tarefa B4: separadores da chave de recuperação

**Arquivos:** `apps/web/src/lib/personal-vault/crypto.ts`. Teste: `crypto.test.ts`.

- `decodeRecoveryKey` remove tudo que não for `[0-9A-Za-z]` antes de mapear `O→0` e `I/L→1`.
- [ ] Teste: estender `roundtrips recovery keys and tolerates sloppy typing` com `–`, `—`, `_`, `.`, `\n` e espaço não separável (` `) como separadores. RED → GREEN → commit `fix(web): accept any separator in pasted recovery keys`.

### Tarefa B5: lacunas de teste

**Arquivos:** `apps/api/tests/test_personal_vault.py`, `vault/__tests__/vault-page.test.tsx`, `apps/web/cypress/e2e/personal-vault.cy.ts`.

- **API:** `test_every_route_rejects_bearer` parametrizado nas 7 rotas (`GET`/`POST`/`PUT /config`, `GET`/`POST /items`, `PUT`/`DELETE /items/{id}`), todas com 403.
- **Web:** `idle lock closes an open reveal dialog`. Abrir "Revelar", mostrar o conteúdo e avançar 10 min: o diálogo some do DOM.
- **Cypress no Postgres real:** `a stale edit gets the conflict notice`. Abrir a edição de um item, aumentar a versão dele por `cy.request` (um PUT com `expected_version` atual) e salvar pela interface: aparece "Este item mudou em outra aba…" e o valor do PUT é o que fica.
- [ ] Estes testes cobrem comportamento que já existe e devem **passar de primeira**. Para cada um, confirmar que ele pega a regressão: quebrar temporariamente a linha que ele protege, ver o teste falhar e restaurar. Commit `test: cover personal vault auth, idle lock and conflicts end to end`.

---

## Ordem

```
A1 ─▶ A2            (formato; antes de haver dados reais)
B1, B2, B3, B4, B5  (independentes entre si; B2 depois de A1 porque usa a nova assinatura de decryptSummary)
```

Ao final: suíte da API, `npm run test:unit`, `npm run check:i18n`, `npm run lint`, `npm run build` e o Cypress `personal-vault.cy.ts`. Também atualizar `docs/security/personal-vault.md` (AAD, wrapKey e os riscos que deixam de existir) e o `docs/development/CHANGELOG.md`.

### Tarefa B6: pontos menores da revisão da Fase A

**Arquivos:** `apps/api/app/schemas/personal_vault.py`, `apps/api/app/services/personal_vault_service.py`, `vault/_components/vault-item-dialog.tsx`, `docs/security/personal-vault.md`. Testes: `apps/api/tests/test_personal_vault.py`, `vault/__tests__/vault-items.test.tsx`.

- **UUID canônico na API:** `PersonalVaultItemCreate.id` só aceita o formato minúsculo com hífens (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`), porque o cliente amarra o AAD exatamente a essa string. Maiúsculas, chaves, `urn:` ou sem hífen dão 422.
- **Repetir a criação depois de uma resposta perdida:** um 409 `"Item id already exists"` ao **criar** significa que o item já foi salvo. O diálogo fecha e a lista recarrega (`onSaved`), sem o aviso de "mudou em outra aba".
- **Comentário** em `create_item` explicando por que todo `IntegrityError` vira "Item id already exists" (só a PK pode disparar).
- **Doc:** a cópia extraível da chave existe também na criação do cofre, não só ao embrulhar de novo.
- [ ] Testes: `test_item_create_rejects_non_canonical_id` (maiúsculo, sem hífen e `{...}` dão 422) e `a create retried after a lost response just reloads the list`. RED → GREEN → commit `fix: canonical item ids and quiet create retries in the personal vault`.
