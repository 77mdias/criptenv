# Chatbot de suporte — Design

**Status:** rascunho para aprovação do Jean (2026-11-12)

## Por quê

Quem chega ao site do CriptEnv tem dúvidas que hoje só a documentação responde, e ela foi escrita para quem já usa (comandos, rotas da API). Um visitante quer saber se é seguro, quanto custa, como cancelar, como levar os segredos para um contêiner. Um assistente que estudou o produto responde na hora, no idioma da pessoa, e aponta a página certa da documentação.

## O que é (decidido pelo Jean)

- Responde **qualquer dúvida sobre o CriptEnv**, sem roteiro fechado: produto, uso, CLI, API, integrações, planos, cobrança, segurança, termos.
- **Botão flutuante com a carinha de um bot**, no canto inferior direito. Clicou, abre o chat.
- A pessoa pode **esconder** o botão. O **rodapé** tem um link "Suporte" que abre o chat mesmo com o botão escondido.
- Aparece para **visitantes, nas páginas públicas**. Quem estiver logado e abrir uma página pública também vê o botão (escolha do Claude: as páginas públicas não precisam saber se há sessão).
- Modelo: **Sonnet, pela API da Claude**.
- Uma dúvida que precisa ter resposta certa: **como subir contêineres Docker puxando os segredos de um ambiente**. As demais perguntas da base são escolha do Claude.
- Custo é uma preocupação: o bot não deve reler a documentação inteira a cada pergunta sem necessidade.

## Metas

1. Responder certo, conforme o que o código faz hoje, as perguntas mais comuns de quem visita: o que é, segurança (zero-knowledge), planos e preços, cobrança, cancelamento e reembolso, cada tipo de credencial, Docker, CI/CD, hospedagens, equipes e papéis, ambientes restritos, conta e privacidade.
2. Para perguntas técnicas detalhadas, buscar o trecho certo da documentação e indicar o link da página.
3. Custo baixo e previsível, mesmo aberto ao público.
4. Responder no idioma do site (pt-BR, en, es).

## Fora do escopo

- O bot não age na conta: não vê projetos, segredos nem dados de ninguém, não cria nem cancela nada.
- Não fica no painel logado nesta entrega.
- Sem atendimento humano ao vivo nem abertura de chamados: quando não souber, indica `support@criptenv.dev`.
- Sem guardar conversas no servidor.
- Sem busca semântica com embeddings nem banco vetorial.

## O que não pode acontecer (anti-metas)

- **Inventar** recurso, preço, prazo ou regra que o produto não tem. Errar preço ou regra de reembolso é pior que dizer "não sei".
- Virar um Claude de graça para assuntos fora do CriptEnv.
- Uma conta da API da Claude estourada por abuso.
- A pessoa colar um segredo de verdade no chat e ele ficar guardado em algum lugar nosso.

## Como funciona

### Conhecimento: base curta sempre carregada, mais busca por trechos

1. **Base de conhecimento** (`apps/api/app/support/knowledge.md`), escrita para o suporte, em português, com perguntas e respostas sobre os temas da meta 1. Mira entre 8 e 15 mil tokens. Vai inteira nas instruções do bot, com cache: a primeira pergunta de cada janela de 5 minutos paga a escrita do cache, as seguintes pagam a leitura (US$ 0,10 por milhão de tokens no Sonnet 5.5). A conta aproximada, com 1.000 perguntas por mês, fica em uns US$ 5 a 15.
2. **Busca por trechos** na documentação do site, como ferramenta que o bot chama quando a base não basta (pergunta técnica, comando específico, rota da API). Retorna as 3 seções mais parecidas com a consulta, com o texto e o link da página. Busca por palavras (pontuação por termos em comum), sem dependência nova.
   - Fonte: os catálogos `apps/web/messages/{pt-BR,en,es}/docs.json`. A API roda num contêiner sem os arquivos do site, então um script gera um retrato desses textos em `apps/api/app/support/docs_index/<locale>.json`, que vai no repositório. Um teste falha quando o retrato estiver desatualizado em relação aos catálogos, para lembrar de rodar o script.
   - Cada seção do retrato guarda o caminho da página (`/docs/cli/commands`, por exemplo), para o bot indicar o link.

**Entrada obrigatória da base: Docker.** Resposta certa conforme o código de hoje:
- copiar o binário da imagem oficial: `COPY --from=ghcr.io/77mdias/criptenv-cli:latest /usr/local/bin/criptenv /usr/local/bin/criptenv`;
- criar uma chave de API só leitura presa ao ambiente (no painel ou `criptenv api-keys create`);
- passar ao contêiner `CRIPTENV_API_KEY`, `CRIPTENV_VAULT_PASSWORD` e o projeto (`-p` ou `CRIPTENV_PROJECT`) como variáveis do orquestrador (Docker secrets, variáveis do serviço), nunca dentro da imagem;
- iniciar com `criptenv run -e production -- <comando>`: os segredos entram como variáveis do processo, sem `.env` em disco;
- ambiente restrito: só uma chave criada para ele o alcança.

### Backend (FastAPI)

- Rota pública **`POST /api/v1/support/chat`**, sem login.
- Recebe as últimas mensagens da conversa (o navegador guarda o histórico) e o idioma, e responde em **streaming** (SSE), para o texto aparecer enquanto é escrito.
- Chama a API da Claude com o SDK oficial `anthropic` para Python (dependência nova), modelo `claude-sonnet-5-5`, esforço `low` (chat), com a ferramenta de busca e no máximo 3 rodadas de busca por pergunta.
- Instruções do bot: só fala do CriptEnv; recusa com educação outros assuntos; não inventa, e quando a base e a busca não respondem diz que não sabe e indica a documentação e `support@criptenv.dev`; responde no idioma pedido; avisa para nunca colar segredos de verdade no chat; não promete ações na conta.
- Chave `ANTHROPIC_API_KEY` como variável de ambiente da API em produção, do mesmo jeito que `RESEND_API_KEY` e as outras chaves de hoje (o `env_file` da VPS); guardada também no projeto CriptEnv da própria aplicação. Nunca no código nem no repositório. O deploy não muda. Sem a chave, a rota responde que o suporte está indisponível e o botão some.
- **Recusa do modelo** (`stop_reason: "refusal"`) tratada: o bot mostra uma resposta neutra e indica o suporte por e-mail. A requisição usa o fallback do lado do servidor da API da Claude (beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`): quando o classificador de segurança recusa, a própria API tenta de novo num modelo escolhido por ela. É o recomendado para o Sonnet 5.5; só entra em ação em recusa, não muda o modelo das respostas comuns.

### Limites contra abuso

- Por IP: até 20 mensagens por hora, pelo limitador que a API já usa (`app/middleware/rate_limit.py`, Redis em produção).
- Mensagem com até 1.000 caracteres; só as últimas 10 mensagens da conversa vão para o modelo; resposta com até 1.024 tokens.
- Teto global por dia (por exemplo, 500 mensagens), configurável por variável de ambiente. Passou dele, o chat responde que o suporte está cheio e indica o e-mail.

### Privacidade

- O servidor não guarda o texto das conversas. Registra só contagens (mensagens, tokens, recusas) para acompanhar o custo.
- A Anthropic passa a ser operadora de dados: as mensagens do chat vão para a API dela. **Na mesma entrega**, a Política de Privacidade (página em português, mais a cópia em `docs/legal/`) ganha essa linha na tabela de operadores e na transferência internacional, com versão 2.1; o chat e o texto novo entram juntos no mesmo deploy, e o chat mostra, ao abrir, uma frase curta: "As mensagens vão para a Anthropic (Claude) para gerar a resposta. Não cole segredos de verdade."

### Frontend

- Botão flutuante com o ícone de bot (`Bot` do lucide) no canto inferior direito das páginas públicas: landing, termos, privacidade, contribuição e documentação.
- Painel do chat: cabeçalho com "Esconder" e "Fechar", mensagens, campo de texto. As respostas mostram links e blocos de código.
- "Esconder" grava a preferência no `localStorage`. O link **"Suporte"** no rodapé abre o painel e mostra o botão de novo.
- Histórico só no `sessionStorage` do navegador: some ao fechar a aba.
- Textos da interface em pt-BR, en e es; o bot responde no idioma da página.
- Acessível: o painel é um diálogo com foco gerenciado, abre e fecha pelo teclado, e as respostas chegam por uma região `aria-live`.

## Escolhas do Claude (o Jean pode mudar)

- Modelo `claude-sonnet-5-5` (o Sonnet atual), esforço `low`.
- Páginas onde aparece: as públicas, incluindo `/docs`; fora do painel logado.
- Números dos limites: 20 por hora por IP, 500 por dia no total, 1.000 caracteres, 10 mensagens de contexto, 1.024 tokens de resposta.
- Busca por palavras, sem embeddings.
- Conversa sem registro no servidor.
- Frase de aviso sobre a Anthropic e sobre segredos ao abrir o chat.

## Fonte da verdade da base de conhecimento (escolha do Claude)

- Para preços, limites, cobrança, reembolso e tolerância, vale o que o código faz (`app/plans.py`, `app/services/billing_service.py`). Os Termos de Uso 2.0 foram escritos a partir desse código e dizem o mesmo; a base cita a cláusula dos Termos quando for regra contratual.
- Se quem constrói achar divergência entre código, documentação e Termos, a base segue o código e a divergência vira item no relatório da PR, sem corrigir os Termos nesta entrega.
- O Jean revisa o texto da base no pull request, junto com o resto. Não há etapa de aprovação separada.

## Lista das perguntas da base (escolha do Claude)

Agrupadas por tema; cada uma com resposta curta, fiel ao código, e o link da página da documentação.

- **Produto:** o que é o CriptEnv; para quem serve; diferença para `.env` em disco, Doppler e Infisical; código aberto e auto-hospedagem.
- **Segurança:** o que é zero-knowledge na prática; o que o servidor vê e o que nunca vê; o que acontece se eu perder a senha do cofre; 2FA; e se o CriptEnv for invadido.
- **Começar:** criar conta; instalar a CLI; primeiro projeto e primeiro segredo; importar um `.env`.
- **Credenciais:** login, token de CI, chave de API e integração com hospedagem: para que serve cada um e qual usar.
- **Docker:** a receita acima.
- **CI/CD:** GitHub Action; GitLab e outros com `criptenv ci login`; token de CI que grava.
- **Hospedagem:** Vercel, Render e Cloudflare Workers; envio manual e automático (Max); o que é sincronização de mão única.
- **Ambientes:** os três padrão; ambientes extras por plano; ambientes restritos.
- **Equipe:** papéis owner, admin, developer e viewer; quem grava segredos; convites.
- **Planos e preços:** Free, Pro e Max, limites e preços; o que acontece acima do limite.
- **Cobrança:** como assinar; Mercado Pago e cartão; renovação; cobrança recusada e tolerância de 7 dias; nota fiscal.
- **Cancelamento e reembolso:** cancelar; arrependimento em 7 dias; trocar de plano; excluir a conta com assinatura ativa.
- **Conta e privacidade:** sessão de 20 dias; excluir a conta; que dados guardamos; exportar meus segredos.
- **Contato:** `support@criptenv.dev`; reportar vulnerabilidade.

## O que fica para quem constrói

- Formato exato do retrato da documentação e a pontuação da busca.
- Estrutura do componente do chat e o desenho do painel, dentro do estilo do site.
- Texto final da base de conhecimento, conferido contra o código e a documentação.
- Como medir e registrar o custo (contagem de tokens por dia).
