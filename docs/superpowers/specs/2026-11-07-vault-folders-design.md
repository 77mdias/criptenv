# Pastas no cofre pessoal e limites por plano

**Status:** aprovado pelo Jean em 2026-11-07
**Data:** 2026-11-07
**Depois desta:** gerador de token secreto, token de API e certificado (spec separada)

## Por quê

O cofre pessoal (`/vault`) só tem uma lista com filtro por tipo (Todos, Logins, Notas). Com mais itens, e com os tokens, chaves e certificados que o gerador vai criar, o usuário precisa organizar o que guarda. A ideia é que **cada usuário crie as próprias pastas e coloque nelas os itens que criou**, do jeito que o Bitwarden faz.

Junto com isso, o Jean quer **planos de assinatura no futuro**, que liberam funções e aumentam limites. O código desta entrega já nasce com essa base: os limites deixam de ser constantes soltas e passam a vir do plano do usuário. Hoje só existe o plano gratuito.

## Objetivos

1. O usuário cria, renomeia e apaga as próprias pastas, dentro do cofre dele.
2. Cada item pode ficar em uma pasta. A lista filtra por pasta, junto com o filtro por tipo e a busca.
3. O servidor continua sem ler nada: não vê o nome das pastas nem quais itens estão em cada uma.
4. Os limites do cofre vêm do plano do usuário. No plano gratuito: **10 pastas e 120 itens**.
5. O web mostra o uso ("3 de 10 pastas", "45 de 120 itens") e avisa quando o limite do plano for atingido.

## Não-objetivos

- Pasta dentro de pasta (decisão do Jean: um nível só resolve).
- Item em mais de uma pasta, etiquetas (tags).
- Arrastar item para a pasta, mover vários itens de uma vez.
- Compartilhar pasta com outro usuário.
- Cobrança, página de planos, planos pagos, troca de plano pela interface. Só a base para eles.
- Gerador de segredos (próxima spec).

## Anti-objetivos (falha mesmo que funcione)

- O servidor conseguir saber o nome de uma pasta, ou quais itens estão juntos na mesma pasta.
- Baixar o limite apagar, esconder ou travar o acesso a itens que o usuário já tem.
- Apagar uma pasta apagar os itens dela.
- Um limite do plano espalhado pelo código, de um jeito que um plano pago precise mexer em vários lugares.

## Decisões do Jean

- Quem cria as pastas é o próprio usuário. Um nível só.
- Os filtros Todos, Logins e Notas continuam e funcionam junto com a pasta (ex.: "Trabalho" + "Logins").
- Layout **B**: coluna de pastas à esquerda, estilo Bitwarden, com "Todas", as pastas do usuário, "Sem pasta" e "+ Nova pasta", cada uma com a quantidade de itens. No celular, a coluna vira um menu de pastas no topo da lista.
- Limites por plano, pensando em planos pagos no futuro. Plano gratuito: **10 pastas e 120 itens** (o Jean primeiro disse 200 e depois baixou para 120).
- Aprovou, sem mudar: cada item em uma pasta só; apagar a pasta manda os itens para "Sem pasta"; nome da pasta cifrado no navegador; a pasta do item fica dentro do resumo cifrado.
- **Quem hospeda o próprio CriptEnv** escolhe o plano padrão numa configuração do servidor. O padrão é o gratuito, e há um plano "sem limites" para quem hospeda.
- **Mover um item de pasta não pede a senha extra**, nem em item com proteção extra. A senha extra continua valendo para ver e editar o conteúdo.

## Como funciona

### Dados e criptografia

- **Pasta** é um registro novo por usuário: `id` (UUID gerado no cliente, como os itens), o nome num envelope `{iv, ciphertext, auth_tag}`, `version` e datas.
- **O nome é cifrado com a VK**, com AAD `criptenv:pv1:folder:<id>:name`. Assim o servidor não consegue trocar o nome de uma pasta pelo de outra sem a decifragem falhar. Nome com 1 a 100 caracteres, sem espaços nas pontas.
- **A pasta do item vai dentro do resumo cifrado** do item, num campo opcional `folderId`. O servidor não tem coluna de pasta nos itens. Item sem `folderId`, ou com `folderId` de uma pasta que não existe mais, aparece em **"Sem pasta"**.
- **Apagar uma pasta só apaga o registro da pasta.** Nenhum item é reescrito: os itens que apontavam para ela caem sozinhos em "Sem pasta". Como os ids são aleatórios, uma pasta nova nunca "recupera" itens de uma pasta apagada.
- **Trocar senha, senha extra ou usar a recuperação não mexe nas pastas**: a VK é a mesma, só muda o embrulho.
- Itens antigos (sem `folderId`) continuam válidos e aparecem em "Sem pasta". Não há migração de dados cifrados.

### Planos e limites

- **Um lugar só no código da API define os planos.** Cada plano tem um id, os limites (`personal_vault_items`, `personal_vault_folders`) e a lista de funções liberadas. Um limite pode ser "sem limite". Hoje existem dois planos, nenhum com função extra:
  - `free`: 120 itens e 10 pastas.
  - `unlimited`: sem limite de itens nem de pastas, para quem hospeda o próprio CriptEnv.
- **Plano padrão numa configuração do servidor** (variável de ambiente, padrão `free`). Um valor que não é um plano conhecido impede a API de subir, com um erro claro, para um erro de digitação não virar limite sem ninguém perceber.
- **Cada usuário pode ter um plano próprio**, numa coluna nova em `users` (texto, vazia por padrão). Vazia quer dizer "o plano padrão do servidor", então quem hospeda pode trocar o padrão a qualquer momento, inclusive para usuários antigos. Quando os planos pagos chegarem, o pagamento preenche essa coluna. Um valor desconhecido nela vale como `free`, nunca como "sem limite".
- **A API checa o limite ao criar** uma pasta ou um item. O limite atual de 1000 itens (`MAX_PERSONAL_VAULT_ITEMS`) sai e passa a vir do plano.
- **O erro de limite é próprio**, separado do 409 de conflito de versão, e diz qual limite estourou e o máximo do plano. O web reconhece esse erro sem comparar texto.
- **A API informa ao web o plano do usuário**, com os limites e as funções liberadas, para o web mostrar o uso e já saber o que está liberado.
- **Baixar um limite nunca apaga nada.** Quem já tiver mais de 120 itens continua com todos e consegue ler, editar e apagar. Só não cria novos até ficar abaixo do limite.

### API

Todas as rotas novas seguem o resto do cofre: só cookie de sessão web (`get_current_web_user`), filtradas pelo usuário da sessão, com `expected_version` e UPDATE condicional nas edições.

- Listar, criar, renomear e apagar pastas, em `/api/v1/personal-vault/folders`.
- Pasta de outro usuário responde 404.
- Apagar a conta apaga as pastas, como já apaga os itens e a config (`AuthService.delete_account`).

### Web

- **Coluna de pastas à esquerda** da lista: "Todas", as pastas em ordem alfabética, "Sem pasta" e "+ Nova pasta". Cada linha mostra a quantidade de itens da pasta (todos os tipos). Embaixo, o uso: "3 de 10 pastas".
- **Menu "⋯" em cada pasta** com Renomear e Apagar. Apagar pede confirmação e explica que os itens vão para "Sem pasta".
- **No celular**, a coluna vira um menu de pastas no topo da lista, com as mesmas opções.
- **O título da lista mostra a pasta escolhida.** Filtro por tipo e busca valem dentro da pasta escolhida.
- **Formulário do item ganha o campo "Pasta"**, com "Sem pasta" e as pastas do usuário. Ao criar um item com uma pasta selecionada na coluna, o campo já vem com ela. Editar o item mantém a pasta, a não ser que o usuário troque.
- **Ação "Mover para pasta"** em cada item da lista, para qualquer item, **sem pedir a senha extra**. Ela cifra de novo só o resumo, com a pasta nova, e reenvia o corpo cifrado como está. Isso já é aceito pela API de hoje, porque a AAD do corpo amarra o id do item e a marca de proteção, não a versão.
- **Uso de itens** perto do botão de novo item: "45 de 120 itens". Sem limite no plano, só "45 itens" (e "3 pastas").
- **No limite**, "+ Nova pasta" ou "Novo item" ficam desligados, com um aviso de que é o limite do plano gratuito. O texto já deixa espaço para um "conheça os planos" no futuro, mas sem link agora.
- **Pasta com nome que não decifra** aparece como "Pasta ilegível", só com a opção de apagar (mesma ideia dos itens ilegíveis de hoje).
- Trancar o cofre desmonta a coluna junto com a lista, como já acontece com os dados decifrados.
- Textos em pt-BR, en e es.

### Documentação

- `docs/security/personal-vault.md`: o que o servidor vê das pastas (envelope do nome, versão, datas e a quantidade de pastas, mas não quais itens estão em cada uma), a AAD nova, os limites por plano e que mover de pasta não pede a senha extra (só o resumo muda; o corpo protegido não é aberto).
- `.env.example` da API e o guia de self-host: a variável do plano padrão e o plano `unlimited`.

## Chamadas que eu fiz (Claude)

- A pasta de cada item fica dentro do resumo cifrado, e não numa coluna da tabela de itens. É mais privado, e apagar uma pasta não precisa reescrever itens. Em troca, o servidor não consegue contar itens por pasta, e o web conta depois de decifrar.
- A busca vale dentro da pasta escolhida, não no cofre todo. Para buscar em tudo, basta escolher "Todas".
- Nome de pasta com até 100 caracteres. Pastas com o mesmo nome são permitidas, porque o servidor não consegue checar.
- Valor de plano desconhecido no banco vale como `free`. Na configuração do servidor, impede a API de subir.
- Coluna `plan` vazia por padrão (= plano padrão do servidor), em vez de gravar `free` em todo mundo, para quem hospeda poder trocar o padrão depois.
- Mover de pasta é uma ação própria na lista, além do campo no formulário, porque o formulário de um item protegido começa travado pela senha extra.
- Sem link para planos por enquanto, porque ainda não existe página de planos.

## Fica para quem constrói

- Nomes de arquivos, funções e o formato exato das rotas e do erro de limite.
- Por onde o web recebe o plano (rota própria ou junto da sessão).
- Componentes de UI, desde que sigam os que o cofre já usa.

## Riscos e notas de deploy

- **Usuários com mais de 120 itens** em produção deixam de conseguir criar itens. Antes do deploy, contar no banco quantos usuários passam de 120 itens.
- **Limite com count + insert**, como hoje: duas criações ao mesmo tempo podem passar do limite por um.
- **Migração** nova: coluna `plan` em `users` e a tabela de pastas. Roda no entrypoint do container, como as outras.
- API e web precisam ir juntos: o web novo chama as rotas de pastas.
- **Aba antiga aberta durante o deploy:** o web antigo não conhece `folderId`. Se alguém editar um item numa aba de antes do deploy, o resumo é refeito sem a pasta, e o item volta para "Sem pasta" sem aviso. Não perde dado; recarregar a página resolve.
