# Chatbot de suporte — Plano de Implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: superpowers:executing-plans (o Jean executa em modo nativo). Passos com checkbox.

**Objetivo:** um assistente de suporte nas páginas públicas que responde qualquer dúvida sobre o CriptEnv com o Claude Sonnet, a partir de uma base curta sempre carregada e de busca por trechos na documentação.

**Arquitetura:** rota pública `POST /api/v1/support/chat` na API (FastAPI), que chama a API da Claude com o SDK `anthropic` (assíncrono, streaming) e devolve o texto por SSE. A base de conhecimento vai nas instruções, com cache; a busca é uma ferramenta que o modelo chama e que procura num retrato dos catálogos `docs.json`. No site, um componente cliente com o botão, o painel e o link do rodapé.

**Stack:** FastAPI + SDK `anthropic` (dependência nova) · React 19/Vinext + next-intl · pytest + Jest.

**Spec:** `docs/superpowers/specs/2026-11-12-support-chatbot-design.md`

## Restrições globais

- Modelo `claude-sonnet-5-5`; `output_config: {"effort": "low"}`; sem `thinking` (adaptativo é o padrão); `betas=["server-side-fallback-2026-07-01"]`, `fallbacks="default"`; chamadas por `client.beta.messages.stream(...)`.
- A chave vem de `ANTHROPIC_API_KEY` (variável de ambiente); nunca no código, em teste ou em log. Sem chave, o suporte fica desligado.
- O servidor não grava o texto das conversas; registra só contagens de tokens por requisição.
- Limites: 1.000 caracteres por mensagem do usuário; últimas 10 mensagens; 20 mensagens por hora por IP; teto diário global em `SUPPORT_DAILY_LIMIT` (padrão 500); no máximo 3 rodadas de busca por pergunta.
- Toda string nova da interface em pt-BR, en e es; `npm run check:i18n` passa.
- Tudo em uma PR, com um commit por tarefa.

## Decisões deste plano

- **`max_tokens` 2048, não 1024.** O Sonnet 5.5 pensa de forma adaptativa e o pensamento conta dentro de `max_tokens`; 1024 cortaria respostas. A resposta curta é pedida nas instruções.
- **Teto diário no limitador que já existe:** um segundo contador (`support:all`, janela de um dia) na mesma checagem do caminho `/api/v1/support/chat`. O limitador em memória hoje ignora a janela (expira sempre em 60 s); passa a respeitar `window_seconds`.
- **Busca por palavras:** pontuação por termos em comum (sem acentos, minúsculas, sem palavras curtas), com peso maior para o título da página.
- **Retrato da documentação** gerado por `apps/api/scripts/build_support_docs_index.py` a partir de `apps/web/messages/<locale>/docs.json`. Seção = os dois primeiros níveis da chave (`cli.commands`, `gettingStarted.installation`); caminho = esses níveis em kebab-case sob `/docs` (`/docs/cli/commands`). Uma seção cujo caminho não existe em `apps/web/src/app/[locale]/(docs)/docs/` usa o primeiro nível (`/docs/cli`) e, se nem esse existir, `/docs`.
- **O botão só aparece se `GET /api/v1/support/status` disser `enabled: true`.**
- **Link do rodapé:** o rodapé é componente de servidor; o link vira um componente cliente pequeno que dispara o evento `criptenv:open-support`, no padrão que a paleta de comandos já usa.

## Review Focus

1. Cloudflare (Worker do site e Tunnel da API) segurando o SSE até o fim, de modo que o texto apareça de uma vez. A resposta leva `Cache-Control: no-cache` e `X-Accel-Buffering: no`; conferir em produção.
2. Histórico forjado pelo navegador: mensagens de papel `assistant` inventadas, ordem trocada, conteúdo gigante ou blocos que não são texto. Tudo vira 422.
3. Pergunta fora do assunto ou tentativa de usar o chat como Claude genérico: o bot recusa com educação, em uma frase.
4. Chave ausente, API da Claude fora do ar ou 429 dela: o chat mostra a mensagem de indisponível e o e-mail, sem stack trace.
5. Pessoa colando um segredo: nada dele vai para log.

---

### Tarefa 1 — Limitador: janela por bucket e buckets do suporte

**Arquivos:** `apps/api/app/middleware/rate_limit.py`, `apps/api/app/config.py`, `apps/api/tests/test_rate_limit.py`

- [ ] Testes (vermelho primeiro):
  - `test_memory_storage_respects_window_seconds`: com janela de 3600 s, uma contagem de 61 s atrás ainda vale.
  - `test_support_chat_has_its_own_hourly_bucket`: `resolve_rate_limit` dá `"20/hour"` e `build_rate_limit_key` dá `support:<ip>` para `/api/v1/support/chat`.
  - `test_support_daily_cap_blocks_everyone`: com `SUPPORT_DAILY_LIMIT=2`, a terceira requisição de IPs diferentes recebe 429 com `code: "SUPPORT_DAILY_LIMIT"`.
  - `test_support_status_is_not_limited_by_the_chat_bucket`: `/api/v1/support/status` usa o bucket público comum.
- [ ] `RateLimitStorage` guarda a janela por chave e `_is_window_expired(timestamp, window_seconds)` a usa.
- [ ] `SUPPORT_CHAT_PATH = "/api/v1/support/chat"`, `SUPPORT_RATE_LIMIT = "20/hour"`; na `dispatch`, para esse caminho, depois do bucket por IP, checa `support:all` com `settings.SUPPORT_DAILY_LIMIT` por dia.
- [ ] `config.py`: `ANTHROPIC_API_KEY: str = ""`, `SUPPORT_DAILY_LIMIT: int = 500`.
- [ ] Commit.

### Tarefa 2 — Retrato da documentação e busca

**Arquivos:** `apps/api/scripts/build_support_docs_index.py`, `apps/api/app/support/docs_index/{pt-BR,en,es}.json`, `apps/api/app/support/search.py`, `apps/api/tests/test_support_search.py`

- [ ] Testes:
  - `test_docs_index_is_in_sync_with_the_web_catalogues`: rodar a geração em memória dá exatamente o conteúdo dos arquivos commitados (mensagem de falha manda rodar o script).
  - `test_every_indexed_path_exists_in_the_docs`: todo `path` do retrato corresponde a uma pasta em `apps/web/src/app/[locale]/(docs)/docs/` (ou é `/docs`).
  - `test_search_finds_the_docker_snippet`: `search("docker imagem binário", "pt-BR")` traz `/docs/getting-started/installation` entre os 3 primeiros.
  - `test_search_ignores_case_and_accents`, `test_search_returns_at_most_3`, `test_search_unknown_locale_falls_back_to_pt_br`.
- [ ] Script: lê os três `docs.json`, achata em seções `{id, path, title, text}` (texto com as tags `<code>`/`<link>` removidas), grava os JSON ordenados e com `ensure_ascii=False`.
- [ ] `search(query: str, locale: str, limit: int = 3) -> list[dict]` com o índice carregado uma vez por processo.
- [ ] Rodar o script e commitar os retratos.
- [ ] Commit.

### Tarefa 3 — Base de conhecimento

**Arquivos:** `apps/api/app/support/knowledge.md`, `apps/api/tests/test_support_knowledge.py`

- [ ] Escrever a base com as perguntas da spec ("Lista das perguntas da base"), em português, respostas curtas, cada uma com o link da página da documentação. Conferir cada número e regra contra `app/plans.py`, `app/services/billing_service.py`, `app/services/environment_access.py`, `app/config.py` (sessão) e os Termos 2.0. Divergências entre código, docs e Termos vão para o relatório da PR.
- [ ] Testes de sanidade (não de texto):
  - `test_knowledge_has_the_docker_recipe`: contém `ghcr.io/77mdias/criptenv-cli`, `CRIPTENV_API_KEY`, `CRIPTENV_VAULT_PASSWORD` e `criptenv run`.
  - `test_knowledge_prices_match_the_plan_table`: cada preço de `PRICES` aparece formatado (`R$ 29`, `R$ 290`, `R$ 69`, `R$ 690`).
  - `test_knowledge_fits_the_budget`: menos de 60.000 caracteres.
- [ ] Commit.

### Tarefa 4 — Rota do chat

**Arquivos:** `apps/api/app/support/chat.py` (instruções, laço com a ferramenta, SSE), `apps/api/app/schemas/support.py`, `apps/api/app/routers/support.py`, `apps/api/main.py`, `apps/api/requirements.txt`, `apps/api/tests/test_support_chat.py`

- [ ] `requirements.txt`: `anthropic>=<versão instalada>`.
- [ ] Testes com um cliente falso injetado pela dependência `get_support_client` (nenhuma chamada real):
  - `test_status_is_disabled_without_a_key` / `test_chat_returns_503_without_a_key`.
  - `test_chat_rejects_bad_history`: mensagem de usuário com mais de 1.000 caracteres, última mensagem que não é do usuário, papel desconhecido, lista vazia → 422.
  - `test_chat_keeps_only_the_last_10_messages_starting_with_a_user`.
  - `test_chat_streams_text_as_sse`: eventos `{"type":"text"}` e um `{"type":"done"}` final.
  - `test_chat_runs_the_search_tool_and_continues`: o falso pede `search_docs`, a rota devolve o resultado da busca no `tool_result` e a segunda rodada termina com texto.
  - `test_chat_stops_searching_after_3_rounds`.
  - `test_chat_reports_a_refusal`: `stop_reason == "refusal"` → evento `{"type":"error","code":"refusal"}`.
  - `test_chat_reports_provider_errors_without_details`: erro do SDK → evento `{"type":"error","code":"unavailable"}` e nada da exceção no corpo.
  - `test_request_sends_the_knowledge_cached_and_the_language_after_it`: o primeiro bloco de `system` tem `cache_control` e contém a base; o segundo diz o idioma.
  - `test_nothing_from_the_conversation_is_logged`: com `caplog`, o texto da pergunta não aparece; as contagens de tokens aparecem.
- [ ] `SupportChatRequest`: `messages: list[{role: "user"|"assistant", content: str}]` (1 a 40 itens; usuário até 1.000, assistente até 4.000 caracteres), `locale: "pt-BR"|"en"|"es"` (padrão `pt-BR`).
- [ ] Instruções (texto fixo, em inglês para o modelo, seguido da base): só CriptEnv; recusa curta para outros assuntos; não inventar; se a base e a busca não responderem, dizer que não sabe e indicar a documentação e `support@criptenv.dev`; respostas curtas com links relativos (`/docs/...`); nunca pedir nem repetir segredos e avisar para não colá-los; não prometer ações na conta.
- [ ] Ferramenta `search_docs` (`{"query": string}`, `eager_input_streaming: True`, entrada validada antes de rodar).
- [ ] `GET /api/v1/support/status` e `POST /api/v1/support/chat` (`StreamingResponse`, `text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`). Registrar o router em `main.py`.
- [ ] Commit.

### Tarefa 5 — Chat no site

**Arquivos:** `apps/web/src/components/support/support-chat.tsx`, `apps/web/src/components/support/support-link.tsx`, `apps/web/src/lib/api/support.ts`, `apps/web/src/app/[locale]/(marketing)/layout.tsx`, `apps/web/src/app/[locale]/(docs)/layout.tsx`, `apps/web/src/components/layout/footer.tsx`, `apps/web/messages/{pt-BR,en,es}/common.json`, testes em `apps/web/src/components/support/__tests__/`

- [ ] Testes:
  - `shows the bot button only when the support is enabled`.
  - `hides the button and remembers it`, e `the footer link opens the chat even when hidden` (evento `criptenv:open-support`).
  - `streams the answer into the conversation` (`fetch` falso devolvendo um `ReadableStream` com eventos SSE).
  - `shows the rate-limit and daily-limit messages` (429 com cada código) e `shows the unavailable message on an error event`.
  - `keeps the conversation in sessionStorage only`.
  - `opens as a dialog that closes on Escape and returns focus to the button`.
- [ ] `supportApi.status()` e `supportApi.chat(messages, locale, onText)`: `fetch` para `buildApiUrl("/api/v1/support/chat")`, leitura do corpo em linhas `data:`.
- [ ] Componente: botão fixo no canto inferior direito com o ícone `Bot`; painel com cabeçalho (Esconder, Fechar), aviso ao abrir (mensagens vão para a Anthropic; não cole segredos), lista de mensagens com `aria-live="polite"`, campo com limite de 1.000 caracteres. Respostas em texto com links relativos clicáveis e trechos entre crases em `<code>` (renderização simples, sem dependência nova).
- [ ] Montar `<SupportChat />` nos layouts de marketing e de docs; `<SupportLink />` no rodapé.
- [ ] Textos nas 3 locales; `check:i18n`.
- [ ] Commit.

### Tarefa 6 — Política de Privacidade 2.1 e documentação

**Arquivos:** `apps/web/src/app/[locale]/(marketing)/politica-de-privacidade/page.tsx`, `docs/legal/termos-de-uso-e-politica-de-privacidade.md`, `apps/api/app/config.py` (`TERMS_VERSION = "2.1"`), `apps/api/.env.example`, `deploy/vps/README.md`, `docs/technical/api.md`, `docs/development/CHANGELOG.md`

- [ ] Política: Anthropic na tabela de operadores ("Respostas do chat de suporte; recebe as mensagens da conversa, não guarda para treinar modelos") e na transferência internacional (Estados Unidos); 1.x nova "Chat de suporte": o que vai para a Anthropic, que o CriptEnv não guarda o texto e só conta tokens. Versão 2.1, data de vigência do merge.
- [ ] `.env.example` e README da VPS: `ANTHROPIC_API_KEY` (sem valor) e `SUPPORT_DAILY_LIMIT`; como desligar (tirar a chave).
- [ ] Doc técnica: as duas rotas, os limites e os códigos de erro.
- [ ] CHANGELOG.
- [ ] Commit.

### Verificação final

- [ ] API: `pytest tests` completo. Web: `npx jest`, `npm run lint`, `npm run check:i18n`, `npm run build`. CLI: sem mudança.
- [ ] Um teste manual com a chave real no ambiente local (pergunta sobre Docker, sobre preço, uma fora do assunto), contando o custo pelos tokens registrados. Só com o aceite do Jean, porque gasta créditos da API.
- [ ] Revisão final independente da branch.
- [ ] PR com as actions verdes.
