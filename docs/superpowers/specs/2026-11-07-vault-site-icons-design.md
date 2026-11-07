# Ícones de site nos itens do cofre pessoal

**Data:** 2026-11-07 · **Status:** aprovada (2026-11-07)

## Por quê

Na lista do cofre pessoal (`/vault`) todo login aparece com o mesmo ícone de chave (`KeyRound`). Com muitos itens, fica difícil achar um no olho. O Bitwarden mostra o ícone do próprio site (o do GitHub, o do Google...) e o Jean quer o mesmo no CriptEnv.

## Como o Bitwarden faz (referência)

Lido no código aberto deles (`bitwarden/server/src/Icons` e `bitwarden/clients/libs/common/src/vault/icon/build-cipher-icon.ts`):

- O app tira o domínio da URL do item e põe num `<img>`: `https://icons.bitwarden.net/github.com/icon.png`. Se falhar, mostra um ícone genérico.
- O servidor baixa a página do site, lê os `<link rel="icon">` do `<head>`, escolhe o de melhor tamanho e, se não achar nada, tenta `/favicon.ico`.
- Antes de conectar, ele confere que o domínio não aponta para IP interno e conecta no IP que conferiu. Só aceita PNG, ICO e JPEG, conferindo os bytes do arquivo. Guarda em cache, inclusive o "não achei".
- O usuário pode desligar os ícones ("mostrar ícones de sites"), porque pedir o ícone revela o domínio para quem serve o ícone.

## Objetivos

- **Lista do cofre:** item do tipo login com URL de site mostra o ícone do site no lugar do `KeyRound` (`vault-items.tsx`). Sem URL, URL que não serve (ver regras do navegador), ícone que não carrega ou opção desligada: continua o `KeyRound` de hoje. Notas continuam com `StickyNote`.
- **Opção "Mostrar ícones de sites"** no diálogo de configurações do cofre (`vault-settings-dialog.tsx`), numa seção acima das trocas de senha. Vale para este navegador (fica no `localStorage`). Desligada, o navegador não faz nenhum pedido de ícone. Mudar a opção atualiza a lista na hora, sem recarregar.
- **Rota na API:** `GET /api/v1/icons/{hostname}/icon.png`, que devolve a imagem ou 404.
- **Texto da opção** explica em uma frase o que vaza: "Para mostrar o ícone, o CriptEnv busca o site pelo domínio do item. O domínio passa pelo servidor, mas não é guardado." Nos três idiomas (`messages/pt-BR`, `en`, `es`).
- **Doc de segurança:** `docs/security/personal-vault.md` ganha uma seção dizendo o que o servidor fica sabendo com a opção ligada e como desligar. A frase de hoje "O servidor **não vê** ... URLs" (linha 36) passa a dizer a exceção: com os ícones ligados, o servidor vê o domínio (não a URL inteira) de cada login.

## Não objetivos

- Ícone em outros lugares (diálogo do item, diálogo de revelar). Só a lista.
- Perguntar ao Google (`google.com/s2/favicons`) ou a qualquer serviço de terceiro.
- Tentar `http://`, outra porta, o domínio principal (`sub.site.com` → `site.com`) ou `www.`. Só `https://{hostname}` na porta 443; redirecionamentos cobrem a maior parte desses casos.
- Tabela de domínios equivalentes (`accounts.google.com` → `google.com`).
- Ícone enviado pelo usuário, SVG, WebP, redimensionar imagem.
- Cache compartilhado em Redis. Cache em memória por processo basta.
- Limpar metadados do PNG (o Bitwarden faz). Aqui a resposta sai com `nosniff` e tipo conferido pelos bytes.

## Anti-objetivos (falhou, mesmo funcionando)

- **O servidor virar porta para a rede interna (SSRF).** A VPS tem Postgres, Redis e outros containers na rede do Docker. Nenhum pedido de ícone pode chegar neles, nem por redirecionamento, nem por DNS que muda de IP entre a checagem e a conexão.
- **O domínio ir parar em log, banco, auditoria ou Sentry do CriptEnv.** Hoje o log de acesso do gunicorn (`--access-logfile -`), o `request_logging_middleware` do `main.py`, o `console.warn` e o `console.error` (com `targetUrl`) do proxy em `apps/web/worker/index.ts` escrevem o caminho da requisição. Para a rota de ícones, o caminho sai como `/api/v1/icons/[oculto]/icon.png`. Os logs automáticos do Worker na Cloudflare (`invocation_logs` em `wrangler.jsonc`) também guardam a URL: ver "Decidido pelo Jean".
- **Ícone atrapalhar o cofre.** Falha de ícone nunca mostra erro na tela. Os pedidos de ícone não podem gastar o limite de requisições que o cofre usa (100/min por IP hoje, sessão web cai em `anonymous`) e não podem segurar conexão do banco nem trava na linha da sessão enquanto buscam o site.
- **Executar conteúdo do site.** Só sai imagem conferida pelos bytes.

## Como funciona

### Navegador

**Tirar o hostname da URL do item** (função pura, testada com tabela):

- Aceita `https://site.com/...`, `http://site.com/...` e `site.com/...` sem esquema (assume `https://`).
- Recusa (não faz pedido): outro esquema (`androidapp://`, `ftp://`...), nome sem ponto, IP (v4 ou v6), `localhost` e nomes terminados em `.localhost`, `.local`, `.internal`, `.lan`, `.home.arpa`, `.onion`, `.i2p`. Isso evita mandar ao servidor nome de rede interna ou de rede anônima.
- Resultado em minúsculas, sem ponto no final.

**Imagem:**

```tsx
<img
  src={`${API_BASE_URL}/api/v1/icons/${hostname}/icon.png`}
  alt=""
  aria-hidden
  width={16}
  height={16}
  loading="lazy"
  decoding="async"
  referrerPolicy="no-referrer"
  onError={() => /* volta para o KeyRound */}
/>
```

- `API_BASE_URL` vem de `apps/web/src/lib/api/base-url.ts`, o mesmo que o resto do cliente usa. Em produção é `https://criptenv.77mdevseven.tech` (`.env.production.local`), a própria origem do dashboard: o Worker repassa para a API e a CSP (`img-src 'self'`) já libera. Em dev é `http://localhost:8000`, mesmo site, o cookie de sessão vai junto. Se um dia o dashboard for servido de outra origem, o ícone falha e cai no `KeyRound`; nada quebra (decisão minha).
- O hostname sai do resumo que o navegador já decifrou (`summary.url`). Nada novo é cifrado, guardado ou mandado para a API além do próprio pedido do ícone.

**Opção:** chave `criptenv:vault:site-icons` no `localStorage`, valores `"on"`/`"off"`. Sem valor, vale o padrão: ligada. Toda leitura e escrita em `try/catch`; se o `localStorage` falhar, vale o padrão. Como o diálogo e a lista estão na mesma página, a lista precisa reagir quando o diálogo muda a opção.

### API

**Rota:** `app/routers/icons.py`, `prefix="/api/v1/icons"`, `GET /{hostname}/icon.png`, com `Depends(get_current_web_user)`: só quem está logado no dashboard usa, para a API não virar um buscador de ícones aberto para a internet. A rota não grava nada sobre o pedido.

`get_current_web_user` atualiza `sessions.last_accessed_at` e o `get_db` só faz commit no fim da requisição. Para não segurar conexão do banco nem trava na linha da sessão durante a busca (até 10 s), a rota faz `await db.commit()` logo depois da autenticação e só então busca o ícone (decisão minha; o toque em `last_accessed_at` continua, quem está vendo o cofre está ativo).

**Validar o hostname** (antes de qualquer rede): minúsculas, até 253 caracteres, partes de 1 a 63 caracteres com letras, números e hífen (sem hífen no começo ou no fim), pelo menos um ponto, não pode ser IP. Fora disso: 400.

**Serviço** `app/services/site_icon_service.py`:

1. **Cache em memória:** chave = hostname. Guarda acerto (ícones de até 50 KB) e "não achei", por 24 horas, até 5.000 entradas (descarta as mais antigas).
2. **Página:** `GET https://{hostname}/`. Lê no máximo 512 KB do corpo e só se for `text/html`.
3. **Ler o `<head>`** com `html.parser` da biblioteca padrão: guarda `<link>` com `href` e `rel` igual a `icon`, `shortcut icon` ou `apple-touch-icon`. Respeita `<base href>`. Resolve `href` relativo e `//host/...`. Para no `</head>` ou no `<body>`.
4. **Ordem** (igual ao Bitwarden, pelo `sizes`): 32×32, depois 64×64, depois quadrado entre 24 e 128, depois 16×16, depois o resto. Tenta os 5 primeiros em sequência; o primeiro que passar na conferência ganha.
5. **Plano B:** `https://{hostname}/favicon.ico`.
6. **Conferir a imagem:** baixa no máximo 200 KB (maior que isso: descarta). Só aceita pelos primeiros bytes: PNG (`89 50 4E 47 0D 0A 1A 0A`), ICO (`00 00 01 00`), JPEG (`FF D8 FF`). O `Content-Type` que o site mandou é ignorado; o da resposta sai dos bytes.
7. **Resposta:**
   - Achou: 200, `Content-Type` dos bytes, `Cache-Control: private, max-age=604800` (7 dias), `X-Content-Type-Options: nosniff`. (Sem CSP própria: o Worker troca a CSP de toda resposta `/api/` pela do dashboard.)
   - Não achou ou qualquer erro do site (timeout, DNS, TLS, 5xx): 404 com `Cache-Control: private, max-age=86400`. Nunca 5xx, nunca detalhe do erro no corpo.

**Toda conexão para fora** (página, ícone, favicon e cada redirecionamento):

- Passa pela resolução que já existe em `app/services/alert_settings_service.py` (`resolve_webhook_target`): recusa IP privado, reservado, loopback, link-local, multicast; resolve o DNS uma vez e conecta no IP resolvido com `Host` e `extensions={"sni_hostname": ...}`, como `webhook_service.py` já faz. Ela hoje fala só de webhook (nome e mensagens); generalizar para um nome neutro e manter o webhook usando a mesma função.
- Só `https` na porta 443, sem usuário e senha na URL. A exceção de `http://localhost` em desenvolvimento que o webhook tem **não** vale para ícones.
- `httpx` sem seguir redirecionamento sozinho. No máximo 2 redirecionamentos (301, 302, 303, 307, 308), cada destino conferido de novo; destino `http://` é trocado para `https://`.
- Timeout de 5 s por conexão e 10 s no total por pedido de ícone.
- `User-Agent` próprio e honesto (`CriptEnv-Icons/1.0`), `Accept: text/html` na página.

**Limite de requisições:** caminhos que começam com `/api/v1/icons/` ganham balde próprio por IP, 300/min (chave com prefixo `icons:` em `app/middleware/rate_limit.py`). Assim os ícones não gastam o limite do cofre.

**Logs:** um filtro troca o hostname por `[oculto]` em todo log que tenha o caminho de ícones: log de acesso do gunicorn/uvicorn, `request_logging_middleware` e o `console.warn`/`console.error` do Worker. A rota não deixa exceção escapar para o Sentry. O `traces_sample_rate` é 0 por padrão, mas `SENTRY_TRACES_SAMPLE_RATE` pode ligar: as transações do caminho de ícones são descartadas antes de sair (`before_send_transaction` ou `traces_sampler` em `app/observability/__init__.py`).

**O que o servidor fica sabendo** (vai para o doc de segurança): com a opção ligada, cada domínio de login passa pela API junto com o cookie de sessão (o navegador manda sozinho). O CriptEnv não guarda nem registra isso, mas quem opera o servidor poderia. A Cloudflare, que fica na frente de todo o tráfego, também vê. Quem não quer isso desliga a opção.

## Testes

**API (pytest, sem rede: `httpx` e resolução mockados):**

- 401 sem sessão web; 400 para IP, `localhost`, nome sem ponto, nome longo demais, caractere inválido.
- DNS que resolve para IP privado: 404 e nenhuma conexão feita.
- Escolhe o 32×32 em vez do 16×16; usa `apple-touch-icon`; resolve `href` relativo, `//host/...` e `<base href>`; cai no `/favicon.ico` quando a página não tem link.
- Redirecionamento: segue até 2, confere cada um (redirecionamento para IP privado é recusado), o 3º dá 404.
- HTML disfarçado de `.png` dá 404; imagem maior que 200 KB dá 404; o `Content-Type` da resposta vem dos bytes.
- Segundo pedido do mesmo hostname não usa a rede, tanto para acerto quanto para "não achei".
- Cabeçalhos da resposta (`Cache-Control`, `nosniff`).
- A rota faz commit da sessão do banco antes de buscar o site.
- Transação do Sentry do caminho de ícones é descartada.
- Balde de limite separado: 100 pedidos de ícone não bloqueiam uma chamada do cofre.
- Linha de log de um pedido de ícone não contém o hostname.
- Os testes de webhook que já existem continuam passando depois da generalização.

**Web (Jest):**

- Tabela da função que tira o hostname (aceitos e recusados acima).
- `vault-items`: login com URL mostra `<img>` com o `src` certo; `onError` volta para `KeyRound`; opção desligada não renderiza `<img>`; nota não renderiza `<img>`.
- Diálogo de configurações: marcar e desmarcar grava no `localStorage` e a lista muda sem recarregar; `localStorage` quebrado não derruba a tela.

**E2E (Cypress, `personal-vault.cy.ts`):** criar login com URL, interceptar o pedido do ícone com uma imagem de teste e ver o ícone; desligar nas configurações e ver o `KeyRound` sem nenhum pedido novo de ícone.

## Decisões que tomei (Claude)

- **Rota na API (FastAPI), não no Worker da Cloudflare:** a API tem testes, roda no Docker em dev e já tem a proteção contra SSRF com IP fixado. O Worker só roda no deploy e não tem testes.
- **Exige sessão web:** o cookie vai junto de qualquer jeito (mesma origem), então exigir não piora a privacidade e impede uso por estranhos.
- **Opção por navegador, não sincronizada:** igual ao Bitwarden; sincronizar exigiria guardar a preferência cifrada no cofre.
- **Só HTTPS, sem Google, sem limpar metadados do PNG:** menos código e nenhum terceiro.
- Números (512 KB, 200 KB, 5 candidatos, 24 h, 5.000 entradas, 300/min, timeouts): chute razoável, o construtor pode ajustar se algum teste mostrar problema.

## Decidido pelo Jean (2026-11-07)

- **Padrão da opção: ligada**, como no Bitwarden. Sem valor no `localStorage`, os ícones aparecem. Quem não quiser desliga nas configurações do cofre. Os testes de Jest e Cypress partem desse padrão.
- **Logs automáticos do Worker:** `wrangler.jsonc` passa a ter `invocation_logs: false`, para a Cloudflare não guardar na conta do CriptEnv a URL de cada requisição (inclusive `/api/v1/icons/github.com/icon.png`). Os `console.*` do Worker continuam sendo guardados (`logs.enabled` e `persist` ficam `true`), e os de ícone saem com o hostname oculto. O preço é perder a lista automática de requisições do Worker inteiro.
