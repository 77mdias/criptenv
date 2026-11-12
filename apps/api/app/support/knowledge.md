# Base de conhecimento do suporte — CriptEnv

Fonte da verdade para o assistente de suporte. Cada resposta reflete o que o produto faz hoje. Links relativos apontam para páginas do site (https://criptenv.77mdevseven.tech).

## Produto

**O que é o CriptEnv?**
Um gerenciador de segredos e variáveis de ambiente com criptografia zero-knowledge, para desenvolvedores e equipes. Você guarda os segredos de cada projeto por ambiente (development, staging, production e outros), usa pelo painel web, pela CLI (`criptenv`), pela API ou pela GitHub Action, e envia as variáveis para a hospedagem (Vercel, Render, Cloudflare Workers). Os valores são cifrados no seu navegador ou na CLI antes de sair da sua máquina; o servidor guarda só blocos ilegíveis. Visão geral: /docs

**Para quem serve?**
Para quem cria e mantém várias aplicações e se perde nas variáveis de cada uma: dev solo, equipes pequenas, quem tem pipelines de CI/CD e contêineres que precisam dos segredos sem arquivo `.env` espalhado.

**Por que não deixar um `.env` no disco ou no repositório?**
Um `.env` em disco vaza fácil (commit por engano, backup, imagem Docker, máquina compartilhada) e não tem histórico nem controle de quem vê. No CriptEnv os segredos ficam cifrados, com papéis por pessoa, auditoria e envio direto para a hospedagem. Com `criptenv run`, o programa recebe as variáveis sem nenhum arquivo em disco.

**Qual a diferença para Doppler e Infisical?**
O ponto central é o zero-knowledge: nem o servidor do CriptEnv consegue ler seus segredos, porque a chave nunca sai do seu lado. O preço é fixo por conta, em reais, e não por usuário. O código é aberto (licença MIT) e pode ser auto-hospedado. Em troca, o envio automático para a hospedagem só existe no plano Max, enquanto alguns concorrentes oferecem sincronizações no plano grátis.

**É código aberto? Posso hospedar eu mesmo?**
Sim. O código está em https://github.com/77mdias/criptenv, sob licença MIT. Uma instância própria não tem limites de plano nem cobrança.

## Segurança

**O que é zero-knowledge, na prática?**
Seus segredos são cifrados no navegador (Web Crypto) ou na CLI com AES-256-GCM antes de qualquer envio. A chave vem da senha do cofre do projeto, por PBKDF2-HMAC-SHA256 com 100.000 iterações, e cada ambiente tem uma chave própria derivada por HKDF-SHA256. O servidor recebe só o bloco cifrado. Detalhes: /docs/security/zero-knowledge e /docs/security/encryption

**O que o servidor vê e o que nunca vê?**
Vê: blocos cifrados, nomes de projetos, ambientes e chaves (os nomes das variáveis, não os valores), versões, datas, auditoria (quem fez o quê e quando, sem valores), IP e navegador das sessões e, de quem assina um plano, os dados para nota fiscal.
Nunca vê: a senha do cofre, as chaves derivadas, os valores dos segredos, a senha da conta em texto (só um hash) e os dados do cartão (ficam no Mercado Pago).

**E se eu perder a senha do cofre?**
Os segredos cifrados ficam perdidos para sempre. Ninguém, nem a equipe do CriptEnv, consegue recuperá-los: não existe senha mestra nem porta dos fundos. Trocar a senha da conta não recupera o cofre. Guarde a senha do cofre num gerenciador de senhas e mantenha cópia dos valores originais.

**E se o CriptEnv for invadido?**
Quem invadir o banco de dados leva blocos ilegíveis. Os valores só podem ser lidos com a senha do cofre, que não fica no servidor. Ameaças e limites do modelo: /docs/security/threat-model

**Tem autenticação em dois fatores?**
Sim, 2FA por app autenticador (TOTP), com códigos de recuperação. Ative em Conta. A página Segurança, no painel, mostra o que falta proteger na sua conta.

**O que o zero-knowledge não protege?**
O texto que aparece na sua tela depois de destravar o cofre, arquivos `.env` que você exportar, variáveis injetadas no seu CI e o que acontece na sua máquina ou no seu servidor.

**Como reporto uma vulnerabilidade?**
Escreva para support@criptenv.dev com os detalhes técnicos e dê um prazo razoável para a correção antes de divulgar.

## Começar

**Como crio uma conta?**
Em /signup, com e-mail e senha ou com GitHub, Google ou Discord. O plano Free não pede cartão.

**Como instalo a CLI?**
`pip install criptenv` (Python 3.10 ou mais novo), ou `pipx install criptenv`. Para servidores e contêineres existe um binário único que já inclui o Python. Confira a instalação com `criptenv doctor`. Página: /docs/getting-started/installation

**Como faço o primeiro projeto?**
No painel, Projetos → Novo projeto, escolhendo uma senha de cofre (ela não pode ser recuperada). Todo projeto nasce com os ambientes development, staging e production. Pela CLI: `criptenv login`, depois `criptenv projects create meu-app`. Guia: /docs/getting-started/quickstart

**Como guardo um segredo?**
No painel, abra o projeto, escolha o ambiente, destrave o cofre e adicione. Pela CLI: `criptenv set API_URL=https://... -p <project-id> -e production`.

**Como importo um `.env` que já tenho?**
`criptenv import .env -e development` (ou o botão Importar no painel). Depois apague o arquivo do disco. Guia de migração: /docs/guides/migration

**Como uso os segredos na minha máquina sem arquivo `.env`?**
`criptenv run -p <project-id> -e development -- npm run dev`: o comando recebe as variáveis do ambiente e nada é gravado em disco.

## Credenciais: qual usar

**Quais são os tipos de acesso?**
- **Login** (você e a equipe): tudo o que o seu papel permite. Na CLI, `criptenv login`. A sessão dura até 30 dias e cai depois de 20 dias sem uso.
- **Token de CI** (pipelines): lê e grava segredos e sincroniza com a hospedagem, numa sessão curta por execução. Crie nas configurações do projeto ou com `criptenv ci tokens create --name deploy --expires-in 90` (`--environment staging` limita a um ambiente; `--expires-in` conta em dias, sem ele o token não vence; `--scopes` escolhe os escopos, separados por vírgula). No pipeline, `criptenv ci login --token $CRIPTENV_TOKEN`.
- **Chave de API** (contêineres e scripts): **só leitura** (`read:secrets` e, se quiser, `read:audit`). Crie no painel ou com `criptenv api-keys create --name worker --env production --expires-days 90` (`--env` limita a um ambiente; `--expires-days` de 1 a 365). Usada para gravar, recebe 403.
- **Integração com a hospedagem** (Vercel, Render, Cloudflare Workers): envia as variáveis de um ambiente para lá. Não é credencial de leitura.
Página: /docs/api/authentication

**Uma chave de API ou um token de CI alcança todos os ambientes?**
Se você não escolher um ambiente ao criar, alcança todos os ambientes que **não** são restritos. Um ambiente restrito só é alcançado por uma credencial criada especificamente para ele. Na CLI, o ambiente é `--environment <nome>` no `criptenv ci tokens create` e `--env <nome>` no `criptenv api-keys create`.

## Docker e contêineres

**Como subo contêineres Docker puxando os segredos de um ambiente?**
1. Coloque a CLI na imagem copiando o binário da imagem oficial (não precisa de Python):
   ```dockerfile
   COPY --from=ghcr.io/77mdias/criptenv-cli:latest /usr/local/bin/criptenv /usr/local/bin/criptenv
   ```
   O binário funciona em imagens com glibc (Debian, Ubuntu, `node:*-slim`). Em Alpine, instale com `pip install criptenv`.
2. Crie uma **chave de API só leitura** presa ao ambiente que o contêiner usa (no painel, em Configurações do projeto → Chaves de API, ou `criptenv api-keys create --name container --env production`).
3. Passe ao contêiner, como variáveis do orquestrador (Docker secrets, variáveis do serviço no Compose, Kubernetes ou da plataforma), **nunca dentro da imagem**:
   - `CRIPTENV_API_KEY`: a chave do passo 2;
   - `CRIPTENV_VAULT_PASSWORD`: a senha do cofre do projeto (a decifragem acontece dentro do contêiner).
4. Inicie o processo pela CLI:
   ```dockerfile
   CMD ["criptenv", "run", "-p", "<project-id>", "-e", "production", "--", "node", "server.js"]
   ```
   Os segredos entram como variáveis do processo, sem `.env` em disco.
Se o ambiente for restrito, a chave precisa ter sido criada para ele. Instalação e binário: /docs/getting-started/installation

## CI/CD

**Como uso no GitHub Actions?**
Com a Action oficial `77mdias/criptenv/packages/github-action@github-action-v1`, que puxa os segredos de um ambiente e os injeta no job. Use um token de CI guardado nos secrets do repositório. Página: /docs/integrations/github-action

**E no GitLab, CircleCI e outros?**
Instale a CLI no job e use `criptenv ci login --token $CRIPTENV_TOKEN`, depois `criptenv ci secrets --env production` ou `criptenv run`. Guia: /docs/guides/cicd-setup

**Meu pipeline precisa gravar segredos.**
Use um token de CI (a chave de API só lê). Para gravar sem interação, o job também precisa de `CRIPTENV_VAULT_PASSWORD`.

## Hospedagem

**Quais hospedagens são integradas?**
Vercel, Render e Cloudflare Workers. Railway ainda não. Página: /docs/integrations

**Como envio as variáveis para a hospedagem?**
Conecte em Integrações no painel ou com `criptenv integrations connect vercel` (render, cloudflare), escolha o ambiente e envie: `criptenv integrations sync --provider vercel --env production`. No plano Max, o envio acontece sozinho ao salvar, com um novo deploy disparado junto.

**A sincronização traz as variáveis da hospedagem de volta?**
Não, ela é de mão única: CriptEnv → hospedagem. A Vercel não devolve variáveis sensíveis e a Cloudflare não devolve segredos. O CriptEnv é a fonte.

## Ambientes

**Quantos ambientes posso ter?**
Todo projeto nasce com development, staging e production. O plano do dono do projeto define o total: 3 no Free, 5 no Pro e 7 no Max.

**O que é um ambiente restrito?**
Um ambiente extra que só o dono do projeto e os admins veem e leem. Para os outros membros ele não existe. Útil para um contêiner que mexe no banco de dados ou para backups. Quem cria escolhe e pode mudar depois. Os três ambientes padrão nunca são restritos. Crie em Configurações do projeto → Ambientes ou com `criptenv env create db-admin -p <project-id> --restricted`. Página: /docs/api/environments

## Equipe

**Quais são os papéis?**
- **Owner:** tudo; é quem criou o projeto e define o plano que vale para ele.
- **Admin:** vê e edita segredos, gerencia a equipe, as credenciais e as configurações do projeto.
- **Developer:** vê segredos, não edita.
- **Viewer:** vê segredos, não edita.
Só Owner e Admin veem ambientes restritos. Guia: /docs/guides/team-setup

**Como convido alguém?**
Em Equipe, no projeto, com o e-mail da pessoa e o papel. A pessoa precisa da senha do cofre do projeto para ler os valores; combine isso fora do CriptEnv.

## Planos e preços

**Quais são os planos?**
- **Free (grátis):** 3 projetos; por projeto, 3 ambientes, 3 membros e 1 integração com hospedagem; 7 dias de histórico de auditoria; cofre pessoal com 120 itens e 10 pastas.
- **Pro — R$ 29 por mês ou R$ 290 por ano:** projetos, integrações e cofre pessoal sem limite; por projeto, 5 ambientes e 10 membros; 30 dias de histórico.
- **Max — R$ 69 por mês ou R$ 690 por ano:** o mesmo do Pro, com 7 ambientes e 25 membros por projeto, 90 dias de histórico, envio automático para a hospedagem ao salvar, novo deploy junto e sincronização a partir de CI.
Os limites de um projeto seguem o plano do dono. Preços em reais, com tributos incluídos. A segurança (zero-knowledge, 2FA, sessões) é a mesma em todos os planos.

**O que acontece se eu passar do limite ou descer de plano?**
Nada é apagado nem escondido. Ler, editar, exportar e apagar continuam funcionando; só criar algo novo acima do limite fica bloqueado.

**Tem período de teste ou desconto?**
Não há período de teste nem cupom. O plano Free não vence.

## Cobrança

**Como assino?**
Em Conta → Assinatura, escolha o plano e o ciclo, informe os dados para nota fiscal (CPF ou CNPJ, nome ou razão social, endereço) e o e-mail da sua conta no Mercado Pago, e pague na página do Mercado Pago. O plano vale assim que o pagamento é aprovado.

**Quais formas de pagamento?**
As que a página do Mercado Pago oferecer para assinaturas, em geral cartão de crédito. O CriptEnv não vê os dados do seu cartão.

**A assinatura renova sozinha?**
Sim, a cada mês ou ano, até você cancelar.

**E se a cobrança for recusada?**
O Mercado Pago tenta de novo e sua conta mantém o plano por 7 dias a partir da primeira recusa, com aviso por e-mail e no painel. Pagando nesse prazo, tudo segue normal; depois dele, a conta volta ao Free sem apagar nada.

**Recebo nota fiscal?**
Sim, de cada pagamento, com os dados que você informou. Você pode corrigi-los em Conta → Assinatura.

## Cancelamento e reembolso

**Como cancelo?**
Em Conta → Assinatura → Cancelar assinatura, a qualquer momento. Não há novas cobranças e o plano vale até o fim do período já pago; depois a conta volta ao Free.

**Tenho direito a reembolso?**
Cancelando em até 7 dias da primeira cobrança de uma assinatura, o valor é devolvido e a conta volta ao Free na hora (direito de arrependimento, art. 49 do CDC). A devolução é automática na primeira vez em cada conta; um pedido seguinte dentro do prazo vai para o suporte. Depois dos 7 dias, o período em curso não é devolvido. O valor volta pelo Mercado Pago, no meio de pagamento usado.

**Como troco de plano?**
Subir do Pro para o Max vale na hora: o Max é cobrado inteiro e a parte do Pro ainda não usada é devolvida, proporcional ao tempo. Descer de plano ou trocar entre mensal e anual vale no fim do período pago; essa troca é uma assinatura nova, paga ao contratar, e só pode ser feita nos últimos 31 dias do período.

**E se eu excluir a conta com uma assinatura ativa?**
A assinatura é cancelada no Mercado Pago, sem novas cobranças, mas a exclusão não devolve valores. Para usar os 7 dias de arrependimento, cancele a assinatura antes de excluir a conta.

## Conta e privacidade

**Quanto tempo dura o login?**
Até 30 dias, e cai antes se ficar 20 dias sem uso. Vale para o painel e para a CLI.

**Como excluo minha conta?**
Em Conta → Excluir conta. Projetos de sua titularidade são apagados junto e os membros perdem o acesso. Exporte antes os segredos que quiser guardar: depois, nada pode ser recuperado.

**Como exporto meus segredos?**
No painel, com o cofre destravado, use Exportar; pela CLI, `criptenv export`. O arquivo exportado fica em texto, na sua máquina, sob sua responsabilidade.

**Que dados meus vocês guardam? Vendem meus dados?**
O mínimo para autenticar e operar: e-mail, nome, avatar, sessões, auditoria e, de quem assina, os dados para nota fiscal. Não vendemos nem compartilhamos dados para publicidade. Detalhes: /politica-de-privacidade e /termos-de-uso

**As mensagens deste chat ficam guardadas?**
O CriptEnv não guarda o texto da conversa. As mensagens vão para a Anthropic (Claude) para gerar a resposta. Nunca cole segredos de verdade aqui.

## Contato

**Como falo com uma pessoa?**
Escreva para support@criptenv.dev. Dúvidas sobre o código também podem ir para o repositório no GitHub.
