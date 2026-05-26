# Current Task — CriptEnv

## Status atual

**CLI Remote Terminal implementado em 2026-05-14 e interoperabilidade de checksum CLI/Web corrigida em 2026-05-26. A CLI agora opera diretamente no vault remoto do projeto, sem master password local no caminho principal.**

---

## Tarefa em foco

Transformar a CLI em um terminal remoto sincronizado com o WEB: comandos principais de secrets leem e escrevem o vault remoto, mantendo zero-knowledge e solicitando apenas a Vault password do projeto quando precisam descriptografar ou alterar secrets.

---

## O que foi implementado nesta sessão

### CLI RemoteVault ✅
- Criada a camada `apps/cli/src/criptenv/remote_vault.py`.
- Resolução remota de projeto e ambiente.
- Leitura de `vault_config`.
- Prompt/env var `CRIPTENV_VAULT_PASSWORD`.
- Pull remoto, decrypt em memória, mutação, re-encrypt e push remoto.
- Tratamento de `409 Conflict` com mensagem para repetir o comando.

### Comandos remotos ✅
- `set`, `get`, `list`, `delete`, `rotate` agora operam no vault remoto.
- `import` e `export` usam o vault remoto e não persistem secrets localmente.
- `push FILE` virou alias de import remoto.
- `pull --output FILE` virou alias de export remoto.
- `push` sem arquivo e `pull` sem output falham com instruções claras.

### Senhas e sessões ✅
- `init` deixa de criar senha mestra/vault local de secrets; agora prepara metadata/config local.
- Sessões CLI e CI usam `auth.key`/storage de sessão.
- `doctor` valida metadata local, sessão, projeto atual e `/health`, sem master password.
- `ci deploy` importa arquivo/env para o vault remoto e não depende de vault local.

### API ✅
- `VaultPushRequest` ganhou `expected_version?: int`.
- `push_vault` recebe a versão lida antes da mutação.
- Escrita com versão antiga retorna `409 Conflict`.

### Documentação ✅
- Atualizados README principal, README da CLI, environment docs, implemented features, changelog, decisions, current state e task history.
- Atualizadas páginas de docs web de Quickstart, CLI overview, configuração, comandos e primeiro projeto.
- Criado `docs/features/remote-terminal-cli.md` como fonte para atualizar `criptenv.77mdevseven.tech/docs`.

### Testes
- CLI: **178 passed**
- API focado em vault/version conflict: **5 passed**
- Web build: **`make web-build` passed**

### Correção de interoperabilidade CLI/Web ✅
- Checksum canônico do vault remoto definido como `sha256(key_id:iv:ciphertext:auth_tag)`, alinhado ao Web.
- CLI lê blobs novos do Web e blobs legados com checksum de plaintext.
- CLI passa a gravar novos blobs remotos no formato canônico.
- `projects rekey` usa o mesmo helper de checksum e aceita blobs originados pelo Web.
- Web dashboard envia `expected_version` ao salvar secrets para usar a mesma proteção de concorrência da CLI.

---

## Próximos passos recomendados

1. Publicar nova versão da CLI.
2. Atualizar a documentação hospedada em `criptenv.77mdevseven.tech/docs` a partir de `docs/features/remote-terminal-cli.md`.
3. Fazer smoke em produção: criar/editar secret no Web, rodar `criptenv pull -p <project-id> -e <env> -o .env.production`, rodar `criptenv set KEY=value -p <project-id> -e <env>`, e recarregar o Web para confirmar leitura.

---

**Document Version**: 1.16
**Last Updated**: 2026-05-26
**Status**: CLI Remote Terminal implemented, verified, and checksum-aligned with Web/API
