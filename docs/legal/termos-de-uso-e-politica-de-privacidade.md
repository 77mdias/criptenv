# Termos de Uso e Política de Privacidade — CriptEnv

| | |
|---|---|
| **Instrumento** | Termos de Uso e Política de Privacidade (documento combinado) |
| **Serviço** | CriptEnv — plataforma de gestão de segredos e variáveis de ambiente com criptografia Zero-Knowledge |
| **Endereço** | https://criptenv.77mdevseven.tech |
| **Contato / Encarregado (DPO)** | support@criptenv.dev |
| **Versão** | 1.0 |
| **Em vigor desde** | 23 de setembro de 2026 |

---

## Sumário em linguagem simples

Antes do texto jurídico, um resumo honesto para desenvolvedores:

1. **O serviço é gratuito e oferecido "COMO ESTÁ".** Não há SLA de disponibilidade nem suporte técnico obrigatório, e o projeto pode ser modificado, limitado ou descontinuado a qualquer momento, sem aviso prévio.
2. **Zero-Knowledge de verdade:** seus segredos são criptografados no seu dispositivo (navegador ou CLI) com AES-256-GCM antes de chegarem ao servidor. O servidor armazena apenas blocos cifrados ilegíveis e **não possui a chave de descriptografia**.
3. **Se você perder a senha do vault ou suas chaves, os dados são perdidos para sempre.** A administração não tem como recuperá-los — por desenho, não por negligência.
4. **Uso com dados de produção é por sua conta e risco.** A ferramenta foi desenhada para o fluxo de desenvolvimento; segredos de produção exigem cautela máxima e backups próprios.
5. **Não vendemos, alugamos ou compartilhamos seus dados cadastrais com terceiros** para fins comerciais. A coleta via OAuth é mínima: e-mail, nome de exibição, identificador público e (quando disponível) URL de avatar.
6. **Doações via Pix (Mercado Pago) são voluntárias, não dão direitos exclusivos e não são reembolsáveis.**
7. **Você pode excluir sua conta a qualquer momento** diretamente no dashboard, o que remove seus dados de login e seus blocos criptografados.
8. O código é open source (licença MIT): você pode auditar, bifurcar e auto-hospedar o CriptEnv quando quiser independência do serviço oficial.

---

## 0. Definições, aceitação e âmbito

**0.1.** Estes Termos de Uso e Política de Privacidade ("**Termos**") regulam o uso do serviço CriptEnv ("**Serviço**" ou "**Plataforma**"), um gerenciador de variáveis de ambiente, arquivos `.env` e credenciais sensíveis com criptografia de ponta a ponta, composto por: (i) painel web ("**Dashboard**"); (ii) interface de linha de comando ("**CLI**"); (iii) API pública; (iv) GitHub Action e integrações para pipelines de CI/CD.

**0.2.** "**Usuário**" é qualquer pessoa física ou jurídica que utilize o Serviço. "**Equipe**" é o conjunto de Usuários convidados para um projeto compartilhado. "**Conteúdo do Usuário**" são os dados enviados à Plataforma pelo Usuário, incluindo variáveis de ambiente, segredos, chaves de API e arquivos `.env` — sempre em forma cifrada, nos termos da Cláusula 2.

**0.3.** A aceitação destes Termos é condição para utilização do Serviço e se dá no ato de criação da conta ou primeiro acesso após a publicação de versão atualizada (Cláusula 20). No cadastro por e-mail, a aceitação é registrada mediante **marcação expressa da caixa de aceite** ao final do formulário; no cadastro ou acesso por provedores OAuth (Google, GitHub ou Discord), dá-se pelo **primeiro uso** do Serviço, com aviso exibido no momento da autenticação. Para fins de comprovação, a aceitação é **registrada eletronicamente** com data/hora e a **versão vigente** do instrumento, vinculadas à conta do Usuário. O Usuário declara ter lido e compreendido este instrumento, em especial os avisos de irrecoverabilidade (Cláusula 2.4) e de limitação de responsabilidade (Cláusula 3). Tratando-se de contrato de adesão (art. 423 do Código Civil), as cláusulas limitativas aqui previstas foram redigidas de forma destacada e em linguagem compreensível.

**0.4.** O Serviço é mantido de forma independente, sem cobrança de assinatura ou licença (Cláusula 1), por projeto de software livre licenciado sob MIT, cujo código-fonte pode ser auditado publicamente.

---

# PARTE I — TERMOS DE USO

## 1. Escopo, natureza do serviço e garantias

**1.1. Natureza gratuita.** O Serviço é fornecido integralmente **de graça**, como contribuição à comunidade de desenvolvedores. Não há relação de consumo onerosa, mensalidade, cobrança por uso nem planos pagos. O financiamento ocorre por doações voluntárias (Cláusula 5).

**1.2. Ausência de SLA.** Por ser gratuito, **não existe Acordo de Nível de Serviço (SLA)**, garantia de tempo de atividade (*uptime*), continuidade, performance mínima, janela de recuperação nem compromisso de escalabilidade. Eventuais indicadores de status exibidos na interface são meramente informativos e não constituem obrigação contratual.

**1.3. Ausência de suporte obrigatório.** Não há suporte técnico contratual, atendimento com prazo de resposta ou canal obrigatório de help desk. Dúvidas, relatos de bugs e vulnerabilidades podem ser encaminhados, por boa-fé, a **support@criptenv.dev** ou ao repositório público do projeto, sem que isso crie expectativa de resposta ou dever de correção em prazo determinado.

**1.4. Serviço "COMO ESTÁ".** O Serviço é fornecido no estado em que se encontra ("**AS-IS**") e conforme disponível ("**AS AVAILABLE**"), **sem garantias de qualquer natureza, expressas ou implícitas**, incluindo, sem limitação, garantias de comercialização, adequação a finalidade específica, integridade, exatidão, disponibilidade ininterrupta ou ausência de erros.

**1.5. Direito de modificação e descontinuidade.** O mantenedor reserva-se o direito de **modificar, suspender, limitar ou descontinuar, total ou parcialmente, o Serviço — ou qualquer funcionalidade, integração, endpoint ou terminal — a qualquer momento e sem aviso prévio**, inclusive por motivos de segurança, custo de infraestrutura, mudanças em APIs de terceiros ou decisão unilateral. O Usuário concorda que não assiste direito a indenização, aviso prévio, migração assistida ou exportação compensatória em caso de descontinuidade — **recomenda-se fortemente manter cópias locais e rotinas próprias de backup dos arquivos `.env` originais** (Cláusula 2.4).

**1.6. Auto-hospedagem como alternativa.** Por ser software livre (MIT), o Usuário pode, a qualquer momento, bifurcar, auditar e implantar sua própria instância do CriptEnv, independentemente do serviço oficial, não sendo tais instâncias de qualquer forma cobertas por estes Termos, salvo quanto a elas o Usuário decida aplicar.

## 2. Arquitetura técnica e segurança (Zero-Knowledge)

**2.1. Modelo de criptografia de ponta a ponta.** O CriptEnv adota arquitetura **Zero-Knowledge**: todo o Conteúdo do Usuário (variáveis `.env`, *secrets*, chaves de API, tokens) é **criptografado no lado do cliente** — no navegador (Web Crypto API) ou na CLI — antes de qualquer transmissão. O fluxo é:

- a senha do vault do projeto é processada localmente por **PBKDF2-HMAC-SHA256 (100.000 iterações)**, gerando a chave mestre de 256 bits;
- derivação adicional via **HKDF-SHA256** produz uma chave única por ambiente;
- o ciframento é realizado com **AES-256-GCM** (cifra autenticada);
- apenas o **bloco cifrado** (texto cifrado, vetor de inicialização, etiqueta de autenticação e *checksum*) é enviado e armazenado.

**2.2. O que o servidor armazena e o que ele jamais possui.** A infraestrutura do Serviço guarda somente **blocos ilegíveis** (`ciphertext`, `IV`, `auth tag`, `checksum`, versão) e metadados não sensíveis (identificadores de projeto/ambiente, datas, versões). **O servidor não possui, em nenhum momento, a senha do vault, as chaves derivadas ou a capacidade de descriptografar o Conteúdo do Usuário.** Nem a administração do site, nem operadores de infraestrutura, nem um eventual invasor com acesso completo ao banco de dados consegue ler segredos protegidos por esse modelo.

**2.3. Responsabilidade exclusiva pela guarda das chaves.** O Usuário assume, de forma exclusiva e irrestrita, a responsabilidade pela **guarda e sigilo de suas senhas de conta, senhas de vault de projeto, chaves mestres, códigos 2FA, códigos de recuperação e dos tokens de integração gerados para CI/CD, API e webhooks** (prefixos `cek_`, `ci_` e equivalentes). A exposição de tokens em repositórios, logs de pipelines, forks, mensagens ou arquivos de configuração é responsabilidade do Usuário, que deve adotar rotação periódica e o princípio do menor privilégio.

> ### ⚠️ 2.4. AVISO DE IRRECUPERABILIDADE (leia com atenção)
> **Se você ou sua Equipe perderem as senhas de vault, chaves mestres ou credenciais de desbloqueio, os dados cifrados serão perdidos PARA SEMPRE.** A administração do site **não consegue recuperá-los, reimprimi-los ou reconstituí-los** — não há "senha mestre universal", backdoor, cópia de chaves em posse do mantenedor ou mecanismo administrativo de descriptografia. A redefinição de senha de acesso recria credenciais de login, mas **não restaura material criptográfico perdido**. Recomenda-se: (i) guardar as senhas de vault em gerenciador de senhas confiável; (ii) manter backups próprios dos `.env` originais em local seguro; (iii) documentar o processo de recuperação com a Equipe antes de depender do Serviço.

**2.5. Limites do modelo Zero-Knowledge.** A proteção criptográfica abrange o **armazenamento e trânsito** dos dados na Plataforma. **Não abrange**: (i) texto claro exibido no terminal, navegador ou tela do Usuário após descriptografia; (ii) arquivos `.env` exportados (`criptenv export`/`pull`) gravados no disco local; (iii) o vault local SQLite da CLI (`~/.criptenv/`); (iv) variáveis de ambiente injetadas em runners de CI/CD, que seguem a segurança do provedor escolhido pelo Usuário; (v) vazamentos ocorridos no equipamento ou na infraestrutura do próprio Usuário. Nesses cenários, a segurança é responsabilidade exclusiva de quem detém o texto claro.

**2.6. Boas práticas de segurança do Serviço.** Sem dever de exaustividade e sem criar garantia: sessões via cookies `HTTP-only`; armazenamento de identificadores de sessão em forma de *hash*; 2FA por TOTP com códigos de recuperação; limitação de taxa de requisições (*rate limiting*); logs de auditoria por projeto (Cláusula 4.5); cifragem em repouso das configurações de integrações; tokens de API armazenados apenas como *hash*.

## 3. Segregação de ambientes e limitação de responsabilidade extrema

> ### 🛑 3.1. AVISO ENFÁTICO — AMBIENTES DE PRODUÇÃO vs. DESENVOLVIMENTO
> O CriptEnv organiza segredos por ambientes (por padrão, *production*, *staging* e *development*) e foi desenhado primordialmente para o **fluxo de trabalho de desenvolvimento de software**. **O uso do Serviço para armazenar, sincronizar ou distribuir credenciais de AMBIENTES DE PRODUÇÃO é por conta e risco EXCLUSIVOS do Usuário e exige CAUTELA MÁXIMA**, incluindo: avaliação formal de risco própria, política interna de backups, redundância de custódia das senhas de vault, plano de contingência para indisponibilidade do Serviço e conformidade com regulamentações setoriais aplicáveis ao Usuário (PCI-DSS, SOC 2, HIPAA, normas do BACEN etc.). O Usuário reconhece que a irrecoverabilidade criptográfica (Cláusula 2.4), somada à ausência de SLA (Cláusula 1.2), pode tornar a dependência exclusiva do Serviço incompatível com requisitos de missão crítica. **Não utilize o Serviço como única fonte de verdade para segredos de produção.**

**3.2. Isenção de danos indiretos.** Na extensão máxima permitida pela lei aplicável, o mantenedor **não responde por qualquer perda ou dano indireto, reflexo, emergente ou por lucros cessantes**, incluindo, sem limitação:

- perdas financeiras ou de receita;
- interrupção de negócios ou de atividade profissional;
- **falhas, quebras ou atrasos em pipelines de CI/CD**, builds, deploys ou workflows;
- **vazamentos locais** ocorridos no equipamento, repositório, runner ou infraestrutura do Usuário;
- perda de dados cifrados por esquecimento de senhas/chaves (Cláusula 2.4);
- indisponibilidade, lentidão ou corrupção de sistemas derivados do uso (ou da impossibilidade de uso) da ferramenta;
- perda de dados por descontinuidade do Serviço (Cláusula 1.5).

**3.3. Isenção por atos de terceiros e APIs conectadas.** O Serviço integra-se a sistemas de terceiros — **GitHub** (OAuth, Actions e workflows), Google, Discord, Mercado Pago, Vercel, Render, webhooks e provedores de nuvem. O mantenedor **não responde por falhas, indisponibilidades, mudanças unilaterais de API, limites de cota, atrasos, sequestro de conta ou qualquer evento originado nesses terceiros**, tampouco por falhas de autenticação OAuth causadas pelos provedores. Cada integração rege-se pelos termos do respectivo provedor, com o qual o Usuário mantém relação própria.

**3.4. Responsabilidade do Usuário.** O Usuário é o único responsável por: (i) a legalidade do Conteúdo que armazena; (ii) a titularidade ou autorização para uso das credenciais guardadas; (iii) a precisão e integridade de seus dados; (iv) a proteção dos textos claros e exports locais; (v) decisões de engenharia tomadas com base em informações obtidas na Plataforma.

**3.5. Salvaguardas legais.** As limitações desta Cláusula: (i) não afastam responsabilidade por dolo, fraude ou culpa grave; (ii) não alcançam direitos que não possam ser objeto de renúncia por acordo privado, inclusive normas de ordem pública; (iii) aplicam-se conforme a natureza da relação — quando configurada relação de consumo, prevalecem as normas protetivas do Código de Defesa do Consumidor, inclusive quanto à responsabilidade objetiva e à vedação de cláusulas que impossibilitem exoneração essencial a que se obrigou o fornecedor. Nada nestes Termos limita a responsabilidade além do permitido em lei.

## 4. Gestão de equipes e dashboard

**4.1.** O CriptEnv permite organizar projetos, ambientes e segredos em Equipes, com papéis de acesso: `owner` (proprietário), `admin`, `developer` e `viewer`.

**4.2. Responsabilidade do administrador.** O **criador do projeto ou administrador da organização/Equipe é o único e exclusivo responsável por gerenciar quem tem permissão para ler, editar, importar, exportar ou remover segredos**, incluindo: (i) a política de convites e o critério de admissão de membros; (ii) a atribuição e revisão periódica de papéis (menor privilégio); (iii) a revogação imediata de acesso de membros desligados; (iv) a verificação da identidade dos convidados.

**4.3. Atos de membros convidados.** **Todas as ações praticadas por membros convidados dentro de um projeto — inclusive leitura, alteração, exportação e exclusão de segredos — são imputadas à responsabilidade do administrador que os admitiu**, que responde por elas perante terceiros e demais membros, como se próprias fossem, sem direito de regresso contra o mantenedor do Serviço.

**4.4. Segredos compartilhados com Equipe.** Ao convidar membros, o administrador consente que compartilhe com eles o material cifrado e a senha do vault, quando assim decidir. Medidas de proteção do texto claro após entrega ao membro (exports, cópias, repositórios) escapam ao controle do Serviço e são de responsabilidade da Equipe.

**4.5. Auditoria.** A Plataforma registra logs de auditoria por projeto (quem operou, qual operação, quando), acessíveis a administradores, como recurso de transparência e segurança (art. 15 do Marco Civil da Internet). Os logs têm finalidade de segurança, conforme a Parte II, e não substituem controles internos da Equipe.

## 5. Doações voluntárias

**5.1. Natureza.** As contribuições financeiras via **Pix, processadas pelo Mercado Pago**, são **atos estritamente voluntários e não comerciais**, destinados a apoiar a infraestrutura, manutenção, documentação e evolução do Serviço. A doação não configura compra, assinatura, licença, patrocínio, investimento nem qualquer contraprestação de direito material.

**5.2. Ausência de contrapartida.** **Doar não concede recursos exclusivos, funcionalidades adicionais, níveis de acesso, suporte prioritário, tratamento diferenciado, direito a roadmap, nem direitos comerciais, contratuais ou societários** sobre o projeto. Todos os Usuários — doadores ou não — recebem idêntico Serviço, nas condições da Cláusula 1.

**5.3. Irreembolsabilidade.** Em razão de sua natureza voluntária, **os valores doados não são reembolsáveis sob nenhuma hipótese**, ressalvadas, exclusivamente, as hipóteses previstas em normas de ordem pública, ordem judicial ou autoridade competente, e as cobranças duplicadas comprovadamente decorrentes de falha técnica de processamento, caso em que o tratamento ocorrerá nos canais do Mercado Pago.

**5.4. Fluxo financeiro de terceiro.** O processamento do pagamento (geração do QR Code Pix, compensação, conciliação, estornos legais e dados transacionais) **corre por conta e sob os termos, políticas e riscos do Mercado Pago**, que atua como controlador independente do respectivo evento de pagamento. Dúvidas, contestações e incidentes de cobrança devem ser dirigidas ao Mercado Pago.

**5.5. Dados mínimos do doador.** Nome e e-mail informados no fluxo de doação são **opcionais** e, quando fornecidos, destinam-se apenas à emissão de agradecimento/confirmação e à organização interna das contribuições, tratados conforme a Parte II destes Termos.

## 6. Uso aceitável e condutas proibidas

**6.1.** O Usuário compromete-se a utilizar o Serviço de forma lícita e em conformidade com estes Termos. É **vedado**, sem limitação:

- armazenar Conteúdo cuja posse ou uso seja ilícito, ou credenciais obtidas por meios fraudulentos;
- utilizar a Plataforma para distribuir malware, ataques ou material protegido por direito autoral de terceiros sem autorização;
- tentar burlar limites de requisições, autenticação, isolamento entre contas ou mecanismos de segurança (incluindo varreduras automatizadas e engenharia reversa com finalidade de abuso);
- usar tokens de CI/API de terceiros sem autorização, ou ceder/compartilhar a própria conta;
- abusar da infraestrutura gratuita (ex.: uso como armazenamento genérico de arquivos, mineração, spam via webhooks).

**6.2. Sanções.** O mantenedor pode, a seu critério e sem aviso prévio, suspender, restringir ou encerrar acessos em caso de violação, risco à segurança, à infraestrutura ou a terceiros, sem prejuízo das medidas legais cabíveis.

## 7. Propriedade intelectual e licenças

**7.1.** O código do CriptEnv é software livre sob **licença MIT**, mantida a identificação de autoria. Marcas, logotipos e nomes de terceiros citados na interface ou documentação (GitHub, Google, Discord, Mercado Pago, Vercel, Render, entre outros) pertencem a seus titulares e **não indicam patrocínio, parceria ou endosso** ao Serviço.

**7.2. Conteúdo do Usuário.** O Usuário mantém toda a titularidade sobre seu Conteúdo — do qual, em razão da arquitetura Zero-Knowledge, o mantenedor sequer toma conhecimento em texto claro. Ao utilizar o Serviço, o Usuário concede ao mantenedor apenas a **licença mínima, não exclusiva e funcionalmente necessária** para armazenar, replicar em backups e transmitir, de forma cifrada, os blocos que o próprio Usuário envia, pelo tempo necessário à prestação do Serviço. Nenhuma licença adicional é concedida, e nenhuma é exigida sobre o material em texto claro, que jamais é acessado.

## 8. Disponibilidade por terminais (CLI, API, GitHub Action)

**8.1. CLI.** A CLI armazena vault local em SQLite sob `~/.criptenv/` e pode gravar arquivos `.env` em texto claro quando o Usuário solicitar export. **A segurança da máquina local e dos arquivos exportados é de responsabilidade exclusiva do Usuário** (Cláusula 2.5).

**8.2. GitHub Action e CI/CD.** A Action oficial é executada nos runners/repositórios **do Usuário**, sob sua custódia e configuração, utilizando tokens de CI emitidos pelo próprio Usuário. Exposição de variáveis em logs, *pull requests* de forks, *caches* ou artefatos depende inteiramente da configuração de segurança do repositório do Usuário, que deve seguir as práticas recomendadas pelo GitHub.

**8.3. API pública.** Endpoints, chaves `cek_` e limites de taxa podem ser alterados ou descontinuados conforme a Cláusula 1.5, com versionamento de melhor esforço (`/api/v1`).

---

# PARTE II — POLÍTICA DE PRIVACIDADE (LGPD)

*Aplicam-se a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD), o Marco Civil da Internet (Lei nº 12.965/2014) e normas correlatas. O mantenedor do CriptEnv atua como **controlador** dos dados descritos abaixo.*

## 9. Dados tratados, finalidades e bases legais

**9.1. Princípio da minimização.** Coletamos o mínimo indispensável para autenticar Usuários e operar Equipes. **O conteúdo dos seus segredos jamais é coletado**: é cifrado no seu dispositivo e chega ao servidor como bloco ilegível (Cláusula 2).

**9.2. Dados de autenticação via OAuth.** Ao entrar com Google, GitHub ou Discord, solicitamos ao provedor **apenas**:

| Dado | Finalidade |
|---|---|
| E-mail | autenticação, verificação de identidade e avisos de segurança da conta |
| Nome de exibição | identificação no dashboard e nas telas de Equipe |
| Identificador público da conta do provedor | vínculo único entre a conta do provedor e a conta CriptEnv |
| URL de avatar (quando disponível) | exibição de foto de perfil |

Os *escopos* solicitados são os mínimos: `read:user user:email` (GitHub), `openid email profile` (Google), `identify email` (Discord). Os pedidos de permissão exibidos pelo provedor no momento do consentimento prevalecem sobre qualquer descrição aqui contida, na hipótese de divergência.

**9.3. Dados de autenticação por e-mail e senha.** Para o fluxo clássico: e-mail, nome, **hash** da senha (nunca a senha em texto claro), *salt* de derivação, indicadores de verificação de e-mail e configuração de 2FA. E-mails transacionais (verificação, redefinição de senha, convites, alertas de expiração, confirmação de doação) são enviados quando o evento correspondente ocorre.

**9.4. Dados técnicos e de segurança.** Para proteger a Plataforma (base legal: legítimo interesse em segurança, art. 7º, IX, e art. 11, II, "f" da LGPD; art. 15 do Marco Civil): registros de sessão com endereço IP e *user-agent*; logs de auditoria por projeto (identificador do operador, operação realizada e data/hora — **sem conteúdo de segredos**); métricas agregadas de uso e telemetria mínima de desempenho; registros de *rate limiting* e prevenção a abuso.

**9.5. Dados de doações.** Apenas os voluntariamente informados (nome e e-mail opcionais; valor; status), para confirmação, agradecimento e cumprimento de obrigações contábeis/fiscais (art. 7º, II e V, LGPD).

**9.6. Metadados de projetos.** Nomes de projetos, ambientes e papéis de membros — necessários à execução do serviço solicitado (art. 7º, V, LGPD).

**9.7. Bases legais resumidas.** Execução do Serviço solicitado (conta, Equipes, sincronização); cumprimento de obrigação legal (fiscal/contábil; registros de segurança); legítimo interesse (segurança, prevenção a fraude e abuso); consentimento, quando expressamente solicitado para tratamento específico.

**9.8. O que NÃO fazemos.** Não coletamos dados de navegação para publicidade; não usamos cookies de rastreamento ou redes de anúncios; não criamos perfis comportamentais; não tomamos decisões automatizadas com efeitos jurídicos (art. 20 da LGPD); **e não vendemos, alugamos, negociamos ou monetizamos dados pessoais**.

## 10. Compartilhamento e não comercialização de dados

**10.1. Compromisso.** **Os dados cadastrais dos Usuários não são comercializados nem compartilhados com terceiros para fins publicitários, de marketing, de prospecção ou de qualquer outra natureza mercantil.**

**10.2. Operadores e subprocessadores.** Alguns fornecedores tratam dados, exclusivamente para operar o Serviço, sob a condição de operadores (arts. 5º, VII, e 39 da LGPD), com quem são adotadas salvaguardas contratuais e técnicas:

| Fornecedor | Tratamento |
|---|---|
| Cloudflare (Pages, Workers, Tunnel, R2) | entrega do aplicativo, proxy/TLS, armazenamento de avatares |
| Mercado Pago | processamento de doações Pix (dados transacionais permanecem com o provedor) |
| Resend | envio de e-mails transacionais (destinatário e conteúdo da mensagem) |
| GitHub / Google / Discord | autenticação OAuth — são **controladores** dos dados em suas plataformas, regidos por suas políticas |
| Provedor de VPS/banco de dados | hospedagem da API e do PostgreSQL (dados cifrados de vault; cadastro básico) |

**10.3. Hipóteses legais.** Dados podem ser compartilhados perante ordem judicial, requisição de autoridade competente (incluindo autoridades de segurança pública e ANPD, nos termos do art. 23 da LGPD e do Marco Civil), ou para proteção de direitos, prevenção a fraude e segurança da Plataforma, sempre na menor extensão possível.

## 11. Transferência internacional de dados

Alguns operadores acima podem processar dados fora do território brasileiro (por exemplo, Cloudflare e Resend, nos Estados Unidos; GitHub, Google e Discord em centros de dados globais). Nessas hipóteses, a transferência rege-se pelo art. 33 da LGPD, sendo adotadas garantias como cláusulas contratuais padrão do fornecedor, cifragem em trânsito (TLS) e a própria arquitetura Zero-Knowledge, que impede que o conteúdo dos segredos acompanhe qualquer transferência. O Usuário pode solicitar ao Encarregado informações sobre os países envolvidos e as salvaguardas aplicáveis.

## 12. Cookies e armazenamento local

**12.1.** Utilizamos um cookie de sessão `HTTP-only` (inacessível a scripts, mitigando XSS) para manter o login, e chaves de `localStorage` estritamente funcionais (ex.: preferência de tema). **Chaves criptográficas nunca são persistidas em `localStorage`** — existem apenas em memória durante a sessão.

**12.2.** Não há cookies de terceiros para publicidade, *fingerprinting* ou rastreamento entre sites. A autenticação OAuth e o pagamento Pix ocorrem nos domínios dos respectivos provedores, sujeitos a suas políticas.

## 13. Medidas de segurança e notificação de incidentes

**13.1.** Além da arquitetura da Cláusula 2.6: transporte cifrado (TLS) em toda a Plataforma; controle de acesso baseado em papéis (RBAC) por projeto; armazenamento de tokens como *hash*; verificação de assinatura em webhooks de pagamento; isolamento entre contas e projetos; variáveis sensíveis de infraestrutura mantidas apenas como segredos de ambiente.

**13.2. Incidentes.** Em caso de incidente de segurança que possa acarretar risco relevante aos titulares, o mantenedor comunicará à **ANPD** e aos titulares afetados os dados descritos no art. 48 da LGPD, em prazo razoável, pelo e-mail cadastrado e/ou aviso no Serviço. Importante: **a arquitetura Zero-Knowledge foi desenhada para que incidentes de servidor não exponham o conteúdo dos segredos**.

**13.3. Reporte de vulnerabilidades.** Relatos responsáveis são bem-vindos e devem ser enviados a **support@criptenv.dev** com detalhes técnicos. Pedimos uso ético da divulgação (*responsible disclosure*), com prazo razoável para correção antes de publicação.

## 14. Retenção de dados

**14.1.** Dados de conta são retidos enquanto a conta existir. Sessões expiram conforme configurado. Logs de segurança e auditoria são retidos pelo período necessário à proteção da Plataforma e cumprimento de obrigações legais (art. 15, §1º, do Marco Civil), com posterior eliminação ou anonimização. Registros de doações são mantidos pelo prazo de obrigações contábeis/fiscais aplicável.

**14.2.** Ao final do tratamento, os dados são eliminados ou anonimizados (art. 16 da LGPD), respeitadas retenções legais. Os blocos cifrados de vault, sem conhecimento da chave, são matematicamente inúteis e eliminados junto com os projetos (Cláusula 16).

## 15. Direitos do titular (art. 18 da LGPD)

O Usuário pode solicitar, a qualquer momento: confirmação da existência de tratamento; acesso aos dados; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade; portabilidade; informação sobre compartilhamentos; revogação de consentimento, quando aplicável; oposição a tratamentos baseados em legítimo interesse.

**15.1. Como exercer.** (i) **Correção de perfil e exclusão de avatar**: diretamente no Dashboard (Configurações da conta), sem intermediários; (ii) **Exclusão da conta e dados**: autoatendimento na própria conta (Cláusula 16); (iii) **Demais solicitações**: e-mail ao Encarregado (**support@criptenv.dev**) a partir do endereço cadastrado, com descrição do pedido. Respostas são dadas em até **15 (quinze) dias**, prorrogáveis uma vez por igual período em caso de justificativa comunicada ao titular, conforme orientação da ANPD.

**15.2.** O titular pode também peticionar diretamente à ANPD ou recorrer ao Poder Judiciário, sem prejuízo de canais administrativos.

## 16. Exclusão definitiva da conta

**16.1. Como excluir.** No Dashboard, em **Configurações da conta → Excluir conta** (confirmação por digitação de segurança), ou por solicitação ao Encarregado por e-mail registrado.

**16.2. O que é removido.** A exclusão produz **eliminação definitiva** de: dados de login (e-mail, nome, avatar); vínculos OAuth (Google/GitHub/Discord); sessões ativas e dispositivos confiáveis; tokens de API/CI; participações em Equipes; e **os blocos de dados criptografados dos projetos de sua titularidade**, incluindo vaults cifrados de todos os ambientes.

**16.3. Efeitos sobre Equipes (importante).** Projetos **de titularidade do Usuário** são excluídos em cascata — **membros convidados perdem o acesso**. Se a intenção é apenas sair de uma Equipe sem destruir o projeto, transfira a titularidade ou peça a um administrador a remoção da sua participação, em vez de excluir a conta. **Exporte previamente os `.env` que desejar conservar** (Cláusula 2.4: após a exclusão, nada pode ser recuperado).

**16.4. Backups residuais.** Cópias de segurança rotineiras podem persistir por ciclo limitado, sendo eliminadas com a rotação; encerrado esse ciclo, nenhuma cópia identificável permanece. Podem ser conservados apenas dados anonimizados/estatísticos irrelacionáveis ao titular e registros obrigatórios por lei (ex.: doações).

## 17. Titulares menores

O Serviço não é direcionado a menores de 16 (dezesseis) anos. O tratamento de dados de crianças e adolescentes (art. 14 da LGPD) não faz parte do escopo do Serviço; contas suspeitas de pertencer a menores podem ser suspensas, com eliminação dos dados.

## 18. Encarregado (DPO) e contato

O **Encarregado de Proteção de Dados** do CriptEnv atende pelo canal **support@criptenv.dev**, para: exercício de direitos de titulares, comunicação de incidentes, reporte de vulnerabilidades e questões sobre estas Políticas. Em caso de resposta insatisfatória, cabe reclamação à ANPD.

## 19. Alterações destes Termos

**19.1.** Estes Termos podem ser alterados a qualquer momento (inclusive em razão de mudanças no Serviço, na legislação ou em orientações da ANPD), entrando em vigor imediatamente na publicação. Alterações **materialmente relevantes** serão comunicadas, quando factível, por e-mail ou aviso no Dashboard.

**19.2.** O uso continuado do Serviço após a publicação implica aceitação da versão vigente. A data e a versão vigentes constam sempre do topo deste documento e das páginas `/termos-de-uso` e `/politica-de-privacidade` do Serviço.

## 20. Legislação aplicável, foro e disposições gerais

**20.1.** Estes Termos regem-se pelas leis da República Federativa do Brasil, especialmente o Código Civil, a LGPD, o Marco Civil da Internet e, quando configurada relação de consumo, o CDC.

**20.2. Foro.** Fica eleito o foro do **domicílio do titular** para dirimir controvérsias decorrentes de relação de consumo (art. 6º, VI, do CDC); não configurada relação de consumo, o foro do domicílio do mantenedor do projeto, em território brasileiro, ressalvada a faculdade do autor da ação de eleger o foro de residência da parte ré, onde for domiciliado, nas hipóteses admitidas em lei (art. 63, §3º, do CPC).

**20.3.** A nulidade ou inexequibilidade de qualquer cláusula não invalida o restante do instrumento, aplicando-se, no que couber, a norma legal equivalente mais próxima da intenção original. A tolerância a eventuais descumprimentos não implica renúncia ou novação. O silêncio não importa em concordância. Estes Termos, junto com a documentação técnica pública do projeto, constituem o inteiro acordo entre as partes quanto ao seu objeto.

---

## Anexo A — Resumo técnico: o que o servidor vê e o que nunca vê

| O servidor VÊ | O servidor NUNCA VÊ |
|---|---|
| Blocos cifrados AES-256-GCM (`ciphertext`, `IV`, `auth tag`, `checksum`) | Senha da conta em texto claro (armazenamos apenas *hash*) |
| Salt PBKDF2 e chave de envelopamento do usuário (`wrapped DEK`) | **Senha do vault do projeto e chaves derivadas** |
| "Vault proof" (comprovação de conhecimento, sem revelar segredo) | **Conteúdo de variáveis, secrets, chaves e tokens** |
| Metadados: IDs de projeto/ambiente, nomes, versões, datas | Chaves em `localStorage` (nunca persistidas) |
| Logs de auditoria (quem, qual operação, quando — sem valores) | Exports `.env` do usuário (existem apenas na máquina dele) |
| IP e user-agent de sessão (segurança) | Dados de navegação para publicidade (não coletamos) |

*Documento redigido com base em auditoria técnica do código-fonte do CriptEnv (criptografia, autenticação, OAuth, doações, gestão de equipes e fluxos de exclusão de conta), visando à precisão entre o texto jurídico e a implementação real (art. 6º, VI — transparência, LGPD).*
