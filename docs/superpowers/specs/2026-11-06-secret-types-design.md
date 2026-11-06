# Tipos de variável: Config e Secret (sync com a Vercel)

**Data:** 2026-11-06 · **Status:** aguardando aprovação

## Por quê

Na Vercel cada variável de ambiente tem um tipo:

- **Config**: dá para ler depois de salva.
- **Secret**: só pode ser escrita; ninguém lê depois de salva.

Hoje o CriptEnv manda toda variável como `encrypted`, e na Vercel isso vira Config, até senha e token. Por isso, depois de sincronizar o app do Jean, as variáveis ficaram com o tipo errado na Vercel. O CriptEnv precisa guardar o tipo de cada variável e respeitar esse tipo ao sincronizar.

## Objetivos

- Cada variável de um ambiente de projeto tem um tipo: **Config** ou **Secret**.
- **Padrão:** variável nova nasce **Config**. Marcar como Secret é opcional, tanto no web quanto na CLI.
- **Dentro do CriptEnv o tipo não muda nada:** qualquer variável continua visível e editável no dashboard e na CLI, como hoje. O tipo só diz como a variável chega na Vercel.
- **Sync push para a Vercel:**
  - Secret vai com `"type": "sensitive", "visibility": "secret"`.
  - Config vai com `"type": "encrypted", "visibility": "config"`.
  - Os dois tipos valem para qualquer target, incluindo `development`: a Vercel passou a aceitar Secret em Development.
- **Dashboard web:**
  - O formulário de criar e editar variável ganha um controle Config/Secret.
  - A lista mostra um rótulo com o tipo de cada variável.
- **CLI:**
  - `criptenv set KEY=value --secret` marca a variável como Secret.
  - Sem a flag, uma variável nova nasce Config e uma variável existente mantém o tipo que já tinha.
  - Para voltar uma variável para Config pela CLI: `--config`.
- **`criptenv push` e qualquer outro envio da lista de variáveis não pode perder o tipo** (detalhes em "Regras que não podem quebrar").

## Fora do escopo

- Esconder valores dentro do CriptEnv. O tipo não é controle de acesso aqui.
- Mudar o comportamento das outras integrações (Render, Cloudflare, GitHub Actions). Elas ignoram o tipo.
- Valores diferentes por ambiente ou por branch de Preview na Vercel.
- A política de time "Separate Production Secret Values" da Vercel. Se ela recusar um envio, o erro aparece como os outros erros da Vercel já aparecem hoje.

## O que seria falha, mesmo funcionando

- Um `criptenv push` (ou um push do web feito por um cliente antigo) desmarcar em silêncio as variáveis Secret.
- Uma variável Secret chegar na Vercel como Config.
- Um sync que troca Secret por Config apagar a variável na Vercel e falhar antes de recriá-la, deixando o app sem a variável.

## Restrições e fatos da Vercel

Fonte: <https://vercel.com/docs/environment-variables/sensitive-environment-variables>, lida em 2026-11-06.

- Criação via `POST /v10/projects/{id}/env`:
  - Secret: `"type": "sensitive", "visibility": "secret"`.
  - Config: `"type": "encrypted"` (ou `plain`) com `"visibility": "config"`.
- Variáveis `sensitive` antigas contam como Secret.
- Não dá para converter um Secret salvo em Config no mesmo lugar. É preciso apagar o Secret e criar um Config.
- Não está documentado se o `upsert=true` muda o tipo de uma variável que já existe. O builder precisa descobrir isso (ver "Deixado para o builder").
- O pull continua pulando variáveis `sensitive`, porque a Vercel não devolve o valor delas.

## Decidido

**Onde o tipo mora**

- Coluna nova não secreta em `vault_blobs`, com migration Alembic e valor padrão Config para todas as linhas existentes.
- O tipo não é segredo e fica em texto claro. É o mesmo nível de informação que o nome da chave, que já fica em claro.
- O nome e a forma da coluna ficam com o builder; minha sugestão é `kind`, com os valores `config` e `secret`.

**API do vault**

- `VaultBlobPush` aceita o tipo como campo opcional.
- `VaultBlobPull` devolve o tipo.

**Preservação do tipo (decisão minha)**

- O push do vault apaga e regrava todas as variáveis do ambiente (`ReplaceAllVaultBlobsStrategy`).
- Quando uma variável chega **sem** o tipo, o servidor mantém o tipo que a variável de mesmo `key_id` tinha antes do push. Se ela não existia, nasce Config.
- Quando o tipo vem preenchido, ele vale.
- Isso protege clientes antigos da CLI que não conhecem o campo.

**Sync**

- `SyncSecret` ganha o tipo, opcional, com três estados: `config`, `secret` ou ausente. Decisão minha.
- **Ausente** quer dizer "comportamento de hoje":
  - vai como `encrypted`;
  - **nunca** apaga nem converte uma variável que já existe na Vercel.
  - Isso protege a CLI antiga e os jobs de CI que mandam só `{key, value}`: o endpoint de sync não sabe de qual ambiente do CriptEnv a lista veio, então não tem como buscar o tipo guardado.
- A conversão entre Secret e Config só acontece quando o tipo vem explícito.
- Quem monta a lista de push manda o tipo de cada variável. Hoje são o modal de sync do web e o `criptenv integrations sync` da CLI.
- `VercelProvider.push_secrets` usa o tipo para escolher `type` e `visibility`.

**Secret virando Config na Vercel (decisão minha)**

- O push consulta as variáveis da Vercel naquele target.
- Para cada variável enviada como Config cujo par chave + target já existe na Vercel como `sensitive`, o push apaga essa variável e então cria a Config.
- O resultado do sync diz quais variáveis foram recriadas.
- Se a criação falhar depois de apagar, a mensagem de erro precisa dizer quais chaves ficaram sem valor na Vercel, para não ser uma perda silenciosa.

**Registro da Vercel que cobre vários targets (decisão minha)**

- Um registro criado no painel da Vercel pode cobrir vários targets, por exemplo `[production, preview]`. Apagá-lo durante o sync de um target tiraria a variável dos outros, e o valor de um Secret não pode ser lido de volta.
- Nesse caso o push:
  1. edita o registro existente (`PATCH`) para tirar só o target que está sendo sincronizado;
  2. cria a variável nova só para esse target.
- Assim os outros targets continuam como estavam.
- O registro só é apagado quando cobre apenas o target sincronizado.
- Se a Vercel recusar a edição, o push daquela chave para e o resultado diz quais outros targets o registro cobre. Não apaga nada.

**Textos do web**

- Os rótulos aparecem como "Config" e "Secret", os mesmos nomes da Vercel, em pt-BR, en e es.
- Cada opção tem uma frase curta: Config "dá para ler na Vercel"; Secret "na Vercel ninguém lê depois de salvo".

## Deixado para o builder

- **Mudança de Config para Secret numa variável que já existe na Vercel:**
  - Descobrir, contra a API real ou um teste de contrato, se o `upsert=true` com `type: sensitive` converte a variável no mesmo lugar ou se é preciso apagar e recriar.
  - Depois aplicar o mesmo cuidado de "apagar e recriar com erro explícito".
  - Se não der para testar contra a API real, assumir apagar e recriar e deixar escrito.
- Nome da coluna e da flag interna. A flag pública da CLI fica `--secret` / `--config`.
- Onde exatamente o controle fica no formulário e no rótulo da lista, seguindo os componentes que já existem (`secret-form.tsx`, `secret-row.tsx`).
- Se o `criptenv list`/`get` da CLI mostra o tipo. Sugestão: o `list` mostra.
- Os testes, que precisam incluir:
  - preservação do tipo em push sem o campo;
  - envio do `type`/`visibility` certo para a Vercel, inclusive em `development`;
  - troca de Secret para Config;
  - `set --secret` na CLI.
