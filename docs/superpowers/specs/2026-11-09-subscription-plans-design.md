# Planos de assinatura: Free, Pro e Max

**Status:** aprovado pelo Jean em 2026-11-09 (divisão, limites, preços e regras de cobrança)
**Data:** 2026-11-09
**Antes desta:** `2026-11-07-vault-folders-design.md`, que criou a base de limites por plano (`apps/api/app/plans.py`, `users.plan`, erro 402)

## Por quê

O CriptEnv hospedado é gratuito e só recebe contribuição avulsa por Pix. O Jean quer três planos de assinatura, com cobrança de verdade.

Quem paga é **o desenvolvedor que cria, testa e mantém muitas aplicações e se perde nas variáveis de ambiente de cada uma**. Ele compra duas coisas ao mesmo tempo: segurança séria e organização. Quem chega ao Max já colocou o CriptEnv no meio do deploy: depende de as variáveis chegarem sozinhas na hospedagem (Vercel, Cloudflare, Render).

## Objetivos

1. Três planos no CriptEnv hospedado: **Free, Pro e Max**, com os limites da tabela abaixo aplicados pelo servidor.
2. O usuário assina, troca de plano e cancela sozinho, pelo painel, com cobrança recorrente pelo Mercado Pago.
3. O Max entrega o que promete: envio automático para a hospedagem ao salvar, novo deploy disparado junto e sincronização a partir de CI.
4. Toda tela de integração deixa claro que a sincronização é de mão única (CriptEnv → hospedagem).
5. A página de preços pública mostra os três planos.

## Não-objetivos

- Preço por usuário ou por assento. O preço é fixo por conta.
- Cobrança em dólar ou fora do Mercado Pago Brasil.
- Período de teste grátis, cupom e desconto (decisão: lançar sem; rever se pouca gente subir para o Max).
- Emissão automática de NFS-e (sai à mão no começo).
- Plano de equipe ou empresarial acima do Max.
- Sincronização da hospedagem para o CriptEnv além do `pull` manual que já existe.
- Mudar a contribuição por Pix (`/contribute`), que continua como está.
- Limitar tokens de CI ou chaves de API por quantidade.

## Anti-objetivos (falha mesmo que funcione)

- **Alguém perder acesso aos próprios segredos por causa de plano, pagamento ou limite.** Ler, editar, exportar e apagar funcionam sempre.
- Segurança virar degrau de plano. Criptografia zero-knowledge, 2FA, sessões e expiração de segredo são iguais nos três.
- O servidor passar a guardar ou conseguir ler segredos para viabilizar a automação.
- Dado apagado ou escondido quando a conta volta ao Free.
- Plano liberado sem pagamento confirmado pelo Mercado Pago, ou pagamento confirmado sem plano liberado.
- Instalação própria (self-host) passar a ter limite ou a exigir Mercado Pago.

## Os planos

Decidido pelo Jean, com números propostos pelo Claude e aprovados.

| | Free | Pro | Max |
|---|---|---|---|
| Preço mensal | R$ 0 | R$ 29 | R$ 69 |
| Preço anual (2 meses grátis) | | R$ 290 | R$ 690 |
| Segurança | completa | completa | completa |
| Projetos | 3 | sem limite | sem limite |
| Ambientes por projeto | 3 | sem limite | sem limite |
| Membros por projeto | 3 | 10 | 25 |
| Cofre pessoal | 120 itens, 10 pastas | sem limite | sem limite |
| Conexões com hospedagem por projeto | 1 | sem limite | sem limite |
| Envio para a hospedagem | manual | manual | automático ao salvar |
| Novo deploy após o envio | não | não | sim |
| Sincronizar a partir de CI | não | não | sim |
| Histórico de auditoria visível | 7 dias | 30 dias | 90 dias |
| Tokens de CI e chaves de API | sem limite | sem limite | sem limite |

O plano `unlimited` continua existindo para self-host (`DEFAULT_PLAN=unlimited`) e libera tudo, inclusive o que é do Max.

### De quem é o plano que vale

Chamada do Claude, a conferir na revisão:

- **Projetos** contam os projetos de que o usuário é dono (`projects.owner_id`), arquivados incluídos.
- **Tudo que é por projeto** (ambientes, membros, conexões, auditoria, envio automático, deploy, CI) segue o plano do **dono do projeto**, não o de quem está fazendo a ação. Um membro Free dentro de um projeto de dono Max usa os recursos do Max naquele projeto.
- **Membros** contam o dono e os convites pendentes.
- **Cofre pessoal** segue o plano do próprio usuário, como hoje.

### Contexto de mercado (2026-11-09)

| | Grátis | Pago de entrada |
|---|---|---|
| Infisical | 5 identidades, projetos ilimitados, 3 ambientes, 10 sincronizações | US$ 20 por identidade/mês |
| Doppler | 3 usuários, 10 projetos, 4 ambientes, 5 sincronizações, 3 dias de log | US$ 21 por usuário/mês |
| Phase | 5 usuários, 3 apps, 3 ambientes | US$ 10 por usuário/mês |
| Dotenvx | CLI aberta | US$ 5/mês (1 pessoa) |

**Risco aceito:** Infisical e Doppler dão sincronização automática no plano grátis. No CriptEnv ela fica só no Max. A defesa é o zero-knowledge (neles o servidor enxerga os segredos). Se o Max não vender, este é o primeiro ponto a rever.

## Conta acima do limite

Uma regra só, para todos os casos (volta ao Free, conta antiga que já passa do limite, limite reduzido no futuro):

- Nada é apagado, arquivado nem escondido.
- Ler, editar, exportar e apagar continuam funcionando em tudo.
- Criar o que estourou o limite devolve **402** (projeto, ambiente, membro ou convite, conexão), como o cofre pessoal já faz.
- Recursos do Max desligam: o envio automático para, o deploy não é disparado, a sincronização por CI devolve 402. O envio manual continua.
- A auditoria mais antiga que a janela do plano deixa de aparecer na listagem e na exportação, mas **não é apagada** do banco. Se a conta subir de plano, volta a aparecer.

Não há migração para contas que hoje passam dos limites do Free: valem as regras acima. Quantas são não foi verificado.

## Sincronização com a hospedagem

### Como é hoje

O envio é manual, pela web (`sync-modal.tsx`) ou pela CLI (`criptenv integrations sync`). O cliente decifra o ambiente no dispositivo e manda os valores para `POST /api/v1/projects/{id}/integrations/{id}/sync`; a API repassa ao provedor. Os valores passam pela API em memória nesse momento e não são gravados. O envio automático **não muda esse modelo**, só a frequência.

### Mão única

- CriptEnv → hospedagem funciona nos três provedores.
- Hospedagem → CriptEnv não é confiável: a Vercel não devolve o valor de variável sensível e a Cloudflare não devolve segredo. Variável criada ou alterada direto na hospedagem não chega ao CriptEnv, e o próximo envio pode sobrescrevê-la.
- **Todos os planos** veem esse aviso ao conectar uma hospedagem e na tela de sincronização: o CriptEnv é a fonte da verdade.

### Envio automático (Max)

- O servidor nunca tem a senha do cofre, então não existe sincronização em segundo plano. "Automático" é: quando o usuário salva, cria ou apaga uma variável **com o cofre aberto** (web ou CLI), o cliente envia o ambiente para as conexões daquele projeto que estão com o envio automático ligado.
- Cada conexão tem a opção "enviar automaticamente", ligada por quem administra o projeto. Só pode ser ligada em projeto de dono Max.
- Hoje a conexão é por projeto e o destino é escolhido a cada envio. Para o automático, **a conexão passa a guardar o vínculo**: qual ambiente do CriptEnv alimenta qual destino na hospedagem (ex.: `production` → Vercel `production`, `staging` → Vercel `preview`). Ao ligar o automático, o usuário escolhe esse vínculo. Salvar num ambiente sem vínculo não envia nada. Conexões que já existem ficam com o automático desligado e sem vínculo, sem migração de dados. (Chamada do Claude, a partir da revisão.)
- **Apagar** (decisão do Jean): quando o usuário apaga uma variável no CriptEnv, o envio automático remove **só essa variável** na hospedagem. Variáveis que existem só na hospedagem nunca são removidas; não há espelho completo. O envio manual continua só criando e atualizando, como hoje.
- Falha no envio não desfaz o que foi salvo no cofre. O usuário vê o erro e pode reenviar à mão.
- **Limite conhecido:** como o envio parte do cliente e a CLI é aberta, o servidor não distingue um envio automático de um manual repetido. O bloqueio do "automático ao salvar" vale nos clientes oficiais. O que o servidor bloqueia de verdade é o deploy e a sincronização por CI, abaixo.

### Novo deploy (Max)

- A Vercel exige novo deploy para variável nova ou alterada valer. Depois de um envio bem-sucedido, a API dispara o deploy no provedor.
- Opção por conexão, ligada por padrão no Max, que pode ser desligada (nem todo mundo quer deploy de produção a cada edição).
- É a API que chama o provedor, então o bloqueio por plano é do servidor.
- Vários salvamentos seguidos não devem gerar um deploy cada. Como agrupar fica com quem constrói.
- Fica com quem constrói: o mecanismo na Vercel (API de deploy ou Deploy Hook) e confirmar se Cloudflare Workers e Render precisam de deploy explícito.

### Sincronização a partir de CI (Max)

O endpoint de sync já aceita sessão de CI com escopo `write:integrations` (`_authenticate_integration_sync_or_ci`). Com sessão de CI, o endpoint passa a exigir que o dono do projeto seja Max (ou `unlimited`); senão, 402. Sem isso, qualquer plano automatizaria o envio manual com um script.

## Cobrança

### Provedor

**Mercado Pago Assinaturas**, na mesma conta já usada pelo Pix de contribuição (`mercadopago_client.py`, `routers/webhooks.py`, `webhook_security.py`). A página de visão geral do produto lista cartão, Pix e boleto e promete nova tentativa automática em cobrança recusada.

A confirmar por quem constrói, na documentação do Mercado Pago:

- Os objetos e tópicos de notificação de assinatura (não foram lidos nesta sessão).
- **Se o Pix renova sozinho todo mês.** Se não renovar, lançar só com cartão. (Chamada do Claude.)
- Quantas tentativas o Mercado Pago faz e em quanto tempo.

### Regras

| Situação | O que acontece |
|---|---|
| Assina | O plano vale quando o Mercado Pago confirma o pagamento. A confirmação vem do webhook ou de consulta à API deles, nunca só do retorno do navegador. |
| Sobe de plano (Pro → Max) | Decisão do Jean: começa uma **assinatura nova do Max agora**, cobrada inteira, na periodicidade que o usuário escolher. A parte não usada do Pro é devolvida, proporcional aos dias que faltavam. Vale igual para mensal e anual. Se o Mercado Pago não aceitar reembolso parcial, quem constrói para e avisa o Jean antes de trocar a regra. |
| Desce de plano (Max → Pro) | Vale no fim do período pago. |
| Troca mensal ↔ anual no mesmo plano | Vale no fim do período pago. |
| Cancela | Mantém o plano até o fim do período pago, depois volta ao Free. |
| Cancela em até 7 dias da cobrança de uma assinatura nova | Decisão do Jean: reembolso integral **automático uma vez por conta**, com volta ao Free na hora (direito de arrependimento, CDC art. 49). Da segunda vez em diante, o pedido chega ao Jean por e-mail e ele decide e devolve à mão; a conta segue a regra de "Cancela". Não vale para renovações. |
| Pagamento recusado | O Mercado Pago tenta de novo. A conta mantém o plano por 7 dias a partir da primeira recusa, com aviso por e-mail e no painel; depois volta ao Free. Pagou dentro do prazo, segue normal. |
| Volta ao Free | Regra de "Conta acima do limite". |

O prazo de 7 dias de tolerância e a descida só no fim do período são chamadas do Claude, aprovadas pelo Jean.

### Dados

- `users.plan` continua sendo o único lugar que `plan_for()` lê. O serviço de assinatura é quem escreve nele.
- Nova tabela de assinaturas, uma ativa por usuário: plano, periodicidade, estado, identificador no Mercado Pago, fim do período pago, fim do prazo de tolerância, plano agendado para o fim do período.
- Por usuário, fica registrado se o reembolso automático de 7 dias já foi usado.
- O webhook é idempotente e valida a assinatura da notificação, como o de contribuição já faz.
- Nenhum dado de cartão passa pelo CriptEnv nem é guardado.

### Nota fiscal

O Jean emite NFS-e em todas as vendas, à mão por enquanto. Ao assinar, a tela pede **CPF ou CNPJ, nome ou razão social e endereço**. Esses dados ficam guardados com a assinatura. A cada pagamento aprovado, o Jean recebe um e-mail com os dados para emitir a nota (pelo `email_service` que já existe).

### Self-host

Sem as credenciais do Mercado Pago configuradas, as rotas e telas de cobrança não aparecem. O operador define o plano de todos por `DEFAULT_PLAN`.

## Telas

- **Página de preços pública:** os três planos, mensal e anual, com a tabela de limites. Substitui a seção atual da landing (`pricing-trust-section.tsx`), mantendo o link para `/contribute`.
- **Assinatura, dentro da conta:** plano atual, uso contra os limites, próxima cobrança, trocar de plano, cancelar, dados para nota.
- **Uso e limite onde o usuário esbarra:** ao criar projeto, ambiente, membro e conexão, mostrar o uso ("2 de 3 projetos") e, no 402, dizer qual plano libera, com atalho para assinar. O cofre pessoal já tem esse padrão.
- **Integrações:** aviso de mão única; opções "enviar automaticamente" e "disparar deploy", visíveis para todos e bloqueadas com a indicação do Max para quem não tem.
- **Avisos de pagamento:** faixa no painel durante o prazo de tolerância.
- **E-mails:** assinatura confirmada, pagamento recusado, volta ao Free, cancelamento.

Tudo em pt-BR, en e es, como o resto do web. Preços sempre em real.

## Ordem de entrega

Três entregas, um PR cada, nesta ordem. Cada uma ganha o próprio plano de implementação.

1. **Planos e limites.** Entradas `pro` e `max` em `plans.py`, novos limites aplicados nos serviços, uso exposto em `/me`, telas de uso e 402, aviso de mão única. `users.plan` ainda é alterado à mão no banco. Nada é vendido.
2. **O que o Max promete.** Envio automático ao salvar (web e CLI), novo deploy, bloqueio da sincronização por CI.
3. **Cobrança.** Assinatura no Mercado Pago, webhook, tela de assinatura, página de preços, e-mails, tolerância, cancelamento e reembolso.

O Max só é vendido depois que existe: por isso a cobrança vem por último.

## Testes

- Cada limite: no teto, acima do teto, e que ler, editar e apagar seguem funcionando acima do teto.
- Cada transição de assinatura da tabela de regras, com o Mercado Pago simulado.
- Webhook: notificação repetida, fora de ordem e com assinatura inválida.
- Provedores de hospedagem: só testes de contrato, sem chamada real (decisão anterior do Jean).
- E2E: bater no limite de projetos no Free e ver o aviso; assinar no ambiente de teste do Mercado Pago.

## Fica com quem constrói

- Formato das tabelas, nomes de rotas e de chaves de limite.
- Onde aplicar cada limite (serviço ou estratégia), seguindo o padrão do cofre pessoal.
- Como o web e a CLI detectam "salvou" e agrupam envios e deploys.
- Mecanismo de deploy em cada provedor.
- Desenho das telas, dentro do sistema visual atual.
