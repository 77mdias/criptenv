# Ambientes extras e ambientes restritos

**Status:** conversa com o Jean em 2026-11-10; ele pediu para seguir direto à implementação depois deste documento, no modo nativo, com PR no fim.
**Antes desta:** `2026-11-09-subscription-plans-design.md` (planos e limites). Esta spec **muda um limite de lá**: ambientes por projeto.

## Por quê

O Jean quer separar variáveis por risco, não só por fase. O caso dele: um contêiner que só sobe para alterar o banco de dados precisa de uma variável que, nas mãos erradas, "lasca tudo". Hoje essa variável mora em `production`, ao lado das variáveis da aplicação, e qualquer pessoa do time com acesso ao projeto a lê. Um segundo caso é um ambiente só para variáveis de backup.

A preocupação é **alguém da própria equipe** que, sozinho, usa uma variável que não devia e quebra o banco. Só os responsáveis pelo sistema devem alcançá-la.

Faltam duas coisas no produto:

1. O web não cria ambientes. A API e a CLI criam; o web só lista os três que nascem com o projeto.
2. O acesso é decidido pelo projeto inteiro. Quem lê um ambiente lê todos.

## Objetivos

1. Criar, renomear e arquivar ambientes extras pelo web.
2. Limite de ambientes por projeto por plano: **Free 3, Pro 5, Max 7**, `unlimited` sem limite.
3. Um ambiente extra pode ser **restrito**: só o criador do projeto e os administradores o leem, alteram e enxergam.
4. A restrição vale em todo lugar por onde dados de um ambiente saem: web, CLI, API, tokens de CI e chaves de API.

## Não-objetivos

- Restringir os três ambientes que nascem com o projeto (`production`, `staging`, `development`). Decisão do Jean: a restrição é só para os extras.
- Lista de pessoas por ambiente. O acesso segue o papel que a pessoa já tem no projeto.
- Senha de cofre por ambiente. A senha continua uma por projeto; o bloqueio é do servidor, que não entrega os dados cifrados (chamada do Claude).
- Restaurar ambiente arquivado.
- Mudar quem pode gravar no cofre (hoje só administrador; fica assim).

## Anti-objetivos (falha mesmo que funcione)

- Dado de um ambiente restrito chegar a um desenvolvedor ou leitor por qualquer rota: variáveis cifradas, nomes das chaves, contagens por ambiente, expirações, histórico.
- Um token de CI ou uma chave de API "para todos os ambientes" alcançar um ambiente restrito.
- A restrição trancar o criador do projeto ou um administrador para fora.
- Um dos três ambientes padrão ficar restrito.
- Voltar a um plano menor apagar, arquivar ou **liberar** um ambiente.

## Limites por plano

| | Free | Pro | Max | unlimited |
|---|---|---|---|---|
| Ambientes por projeto | 3 | 5 | 7 | sem limite |

Decisão do Jean. Antes, Pro e Max eram sem limite. Ninguém assina ainda, então não há conta para migrar. Ambiente arquivado não conta, como já é hoje. Acima do limite vale a regra de sempre: nada é apagado, só não dá para criar outro (402).

A página de preços, a tabela da spec de planos e os testes que conferem a tabela passam a dizer 3, 5 e 7.

## Ambiente restrito

**O que é.** Uma marca no ambiente (`restricted`). Decisões do Jean: quem cria escolhe, na criação, se o ambiente é restrito ou aberto ao time, e pode mudar depois; só vale para ambientes extras.

**Quem entra.** Criador do projeto (`owner`) e administradores (`admin`). Desenvolvedores (`developer`) e leitores (`viewer`) ficam de fora. Promover alguém a administrador dá acesso na hora; rebaixar tira na hora, porque a conferência é feita a cada requisição.

**O que "ficar de fora" significa.** Para quem não é administrador, o ambiente restrito **não existe**: não aparece em listas e pedir por ele responde 404, igual a um ambiente que não existe (chamada do Claude, aceita pelo Jean).

**Quais ambientes podem ser restritos.** Qualquer um que não se chame `production`, `staging` ou `development` e que não seja o ambiente padrão do projeto (`is_default`). Tentar restringir um desses responde 422. Um ambiente restrito não pode virar o padrão (chamada do Claude: a CLI cai no ambiente padrão quando nenhum é informado).

**Quem muda a marca.** Administrador, pela mesma rota que já renomeia o ambiente.

### Onde a restrição vale

Uma regra só, aplicada em um lugar só do código (um serviço que responde "este papel alcança este ambiente?" e "quais ambientes deste projeto este papel alcança?"). Cada ponto abaixo consulta essa regra.

| Onde | Para quem não é administrador |
|---|---|
| Lista de ambientes e detalhe de um ambiente | O restrito não aparece; o detalhe responde 404. |
| Cofre: baixar e ver a versão | 404. (Gravar já exige administrador.) |
| Rotação e expiração: status e histórico de uma chave | 404. |
| Lista de segredos expirando do projeto | Sem os itens de ambientes restritos. |
| Matriz de segredos do projeto | Sem a coluna do ambiente restrito. |
| Visão geral (`/me/overview`) | Sem o ambiente restrito e sem os alertas dele. |
| Auditoria do projeto | Sem os eventos cujo recurso é o ambiente restrito (envio ao cofre, rotação, expiração, criação e arquivamento do ambiente). |
| Integrações | Os vínculos de envio automático de ambientes restritos não aparecem. |
| Lista de tokens de CI | Sem os tokens presos a um ambiente restrito. |

### Tokens de CI e chaves de API

- Escopo vazio continua querendo dizer "todos os ambientes", mas passa a ser **todos os não restritos**.
- Um ambiente restrito só é alcançado por um token ou uma chave **presos explicitamente a ele**.
- Criar token ou chave já exige administrador; nada muda aí.
- Uma chave de API age como quem a criou: se essa pessoa deixou de ser administradora, a chave deixa de alcançar o ambiente restrito.

Assim o contêiner sigiloso do Jean usa um token preso ao ambiente dele, e o token do contêiner da aplicação, mesmo sendo "de todos os ambientes", não o alcança.

### Limites conhecidos, ditos na tela

- **O que já foi lido não volta.** Restringir um ambiente que estava aberto não tira das pessoas o que elas já baixaram. A tela diz isso ao restringir e recomenda rotacionar as variáveis.
- **A senha do cofre é uma por projeto.** A proteção é o servidor não entregar os dados; não é uma segunda senha.
- **O nome do ambiente pode aparecer** em eventos de auditoria sobre tokens e chaves presos a ele (o evento é do token, não do ambiente) e na contagem de uso do plano ("5 de 5 ambientes").
- **A contagem de atividade** do painel soma todos os ambientes; só números, sem nomes.

## Telas

- **Configurações do projeto, seção nova "Ambientes"** (a página já é só para administradores): lista dos ambientes com o uso ("3 de 5 ambientes"), criar (nome, nome de exibição, opção "Restrito a administradores"), renomear, ligar e desligar a restrição nos extras, arquivar com confirmação. No limite, o aviso e o atalho "Ver planos" que já existem para projetos e membros.
- **Seletor de ambiente** na tela de segredos: o ambiente restrito aparece com um cadeado para quem o enxerga.
- **Arquivar** diz o que acontece: as variáveis deixam de ser acessíveis e o nome não pode ser reutilizado.
- **Página de preços:** linha "Ambientes por projeto" com 3, 5 e 7.

Tudo em pt-BR, en e es.

## CLI

- `criptenv env create NOME --restricted`.
- `criptenv env update ID --restricted` e `--open`.
- `criptenv env list` marca os restritos.

## Dados

- Coluna nova `environments.restricted`, booleana, falsa por padrão. Ambientes que já existem ficam abertos.
- Nada muda no cofre nem na criptografia.

## Testes

- Para cada linha da tabela "Onde a restrição vale": um desenvolvedor não recebe o dado e um administrador recebe.
- Token de CI e chave de API sem escopo não alcançam o ambiente restrito; presos a ele, alcançam.
- Rebaixar um administrador tira o acesso; promover dá.
- Os três ambientes padrão e o ambiente padrão do projeto recusam a marca (422).
- Limites 3, 5 e 7 no teto e acima do teto; arquivar libera a vaga.
- Voltar ao Free com 5 ambientes: todos continuam lá, os restritos continuam restritos, criar o sexto responde 402.
- E2E: administrador cria um ambiente restrito pelo web; um desenvolvedor do mesmo projeto não o vê.

## Fica com quem constrói

- Nome e forma do serviço da regra, e como cada rota o consulta.
- Desenho da seção "Ambientes", dentro do sistema visual atual.
- Ordem das tarefas.
