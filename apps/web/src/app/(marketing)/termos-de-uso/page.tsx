import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/footer";
import {
  LegalAlert,
  LegalDocument,
  LegalLi,
  LegalP,
  LegalSection,
  LegalSub,
  LegalUl,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Termos de Uso · CriptEnv",
  description:
    "Termos de Uso do CriptEnv: serviço gratuito Zero-Knowledge fornecido como está, sem SLA, com limitação de responsabilidade, regras de equipes e doações voluntárias.",
};

export default function TermsPage() {
  return (
    <>
      <LegalDocument
        badge="Documento jurídico"
        title="Termos de Uso"
        intro={
          <>
            <LegalP>
              Estes Termos de Uso regulam a utilização do{" "}
              <strong>CriptEnv</strong> — plataforma gratuita de gestão de
              variáveis de ambiente e segredos com criptografia{" "}
              <strong>Zero-Knowledge</strong> — composta por painel web
              (Dashboard), CLI, API pública, GitHub Action e integrações de
              CI/CD.
            </LegalP>
            <LegalP>
              A aceitação destes Termos ocorre no ato de criação da conta ou
              primeiro acesso após publicação de versão atualizada. No cadastro
              por e-mail, a aceitação é registrada mediante{" "}
              <strong>marcação expressa da caixa de aceite</strong> ao final do
              formulário; no cadastro ou acesso por provedores OAuth (Google,
              GitHub ou Discord), dá-se pelo <strong>primeiro uso</strong> do
              Serviço, com aviso exibido no momento da autenticação. Trata-se de
              contrato de adesão (art. 423 do Código Civil): as cláusulas
              limitativas estão destacadas e redigidas de forma compreensível.
              Estes Termos integram, e devem ser lidos junto com, a{" "}
              <Link
                href="/politica-de-privacidade"
                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Política de Privacidade
              </Link>
              .
            </LegalP>
          </>
        }
        version="Versão 1.0 · Em vigor desde 23 de setembro de 2026 · Contato e Encarregado (DPO): support@criptenv.dev"
      >
        <LegalSection id="1-natureza" title="1. Escopo, natureza do serviço e garantias">
          <LegalP>
            <strong>1.1. Natureza gratuita.</strong> O Serviço é fornecido
            integralmente <strong>de graça</strong>, como contribuição à
            comunidade de desenvolvedores. Não há mensalidade, cobrança por uso
            ou planos pagos; o financiamento ocorre por doações voluntárias
            (Cláusula 5).
          </LegalP>
          <LegalP>
            <strong>1.2. Ausência de SLA.</strong> Por ser gratuito,{" "}
            <strong>não existe Acordo de Nível de Serviço (SLA)</strong>,
            garantia de tempo de atividade (uptime), continuidade, performance
            mínima ou compromisso de recuperação. Indicadores de status
            exibidos na interface são meramente informativos.
          </LegalP>
          <LegalP>
            <strong>1.3. Ausência de suporte obrigatório.</strong> Não há
            suporte técnico contratual nem prazo de resposta. Dúvidas, bugs e
            vulnerabilidades podem ser encaminhados, por boa-fé, a{" "}
            <span className="font-mono text-sm">support@criptenv.dev</span> ou
            ao repositório público, sem criar dever de correção em prazo
            determinado.
          </LegalP>
          <LegalP>
            <strong>1.4. Serviço &quot;COMO ESTÁ&quot;.</strong> O Serviço é
            fornecido no estado em que se encontra (As-Is) e conforme disponível
            (As Available), <strong>sem garantias de qualquer natureza</strong>,
            expressas ou implícitas, incluindo comercialização, adequação a
            finalidade específica, disponibilidade ininterrupta ou ausência de
            erros.
          </LegalP>
          <LegalP>
            <strong>1.5. Direito de modificação e descontinuidade.</strong> O
            mantenedor pode <strong>modificar, suspender, limitar ou
            descontinuar</strong>, total ou parcialmente, o Serviço ou qualquer
            funcionalidade, endpoint ou terminal,{" "}
            <strong>a qualquer momento e sem aviso prévio</strong> — inclusive
            por segurança, custo ou mudanças em APIs de terceiros — sem direito
            a indenização, aviso prévio, migração assistida ou exportação
            compensatória. Mantenha cópias locais e backups próprios dos
            arquivos .env originais (Cláusula 2.4).
          </LegalP>
          <LegalP>
            <strong>1.6. Auto-hospedagem.</strong> Por ser software livre
            (licença MIT), você pode auditar, bifurcar e implantar sua própria
            instância a qualquer momento; instâncias próprias não são cobertas
            por estes Termos.
          </LegalP>
        </LegalSection>

        <LegalSection id="2-zero-knowledge" title="2. Arquitetura técnica e segurança (Zero-Knowledge)">
          <LegalP>
            <strong>2.1. Criptografia de ponta a ponta.</strong> Todo o conteúdo
            (.env, secrets, keys) é{" "}
            <strong>criptografado no lado do cliente</strong> — navegador ou CLI
            — antes de qualquer transmissão: a senha do vault é processada
            localmente por PBKDF2-HMAC-SHA256 (100.000 iterações), derivando
            chave de 256 bits; HKDF-SHA256 gera chave única por ambiente; o
            ciframento usa AES-256-GCM. Apenas o bloco cifrado (ciphertext, IV,
            auth tag e checksum) é enviado ao servidor.
          </LegalP>
          <LegalP>
            <strong>2.2. O servidor armazena blocos ilegíveis.</strong> A
            infraestrutura guarda somente <strong>blocos cifrados</strong> e
            metadados não sensíveis (IDs de projeto/ambiente, datas, versões).{" "}
            <strong>
              O servidor não possui a chave de descriptografia
            </strong>{" "}
            em nenhum momento: nem a administração do site, nem operadores de
            infraestrutura, nem um invasor com acesso completo ao banco de dados
            consegue ler segredos protegidos por esse modelo.
          </LegalP>
          <LegalAlert variant="danger" title="Aviso 2.4 — Irrecuperabilidade (leia com atenção)">
            <LegalP>
              <strong>
                Se você ou sua equipe perderem as senhas de vault, chaves
                mestres ou credenciais de desbloqueio, os dados cifrados serão
                perdidos para sempre.
              </strong>{" "}
              A administração do site{" "}
              <strong>não consegue recuperá-los</strong> — não há senha mestre
              universal, backdoor, cópia de chaves em posse do mantenedor ou
              mecanismo administrativo de descriptografia. A redefinição de senha
              de acesso recria credenciais de login, mas não restaura material
              criptográfico perdido.
            </LegalP>
            <LegalP>
              Recomendações: guarde as senhas de vault em gerenciador de senhas;
              mantenha backups próprios dos .env originais; documente o processo
              de recuperação com a equipe antes de depender do Serviço.
            </LegalP>
          </LegalAlert>
          <LegalP>
            <strong>2.3. Guarda de chaves, senhas e tokens.</strong> A
            responsabilidade pela guarda e sigilo de senhas de conta, senhas de
            vault, chaves mestres, códigos 2FA, códigos de recuperação e{" "}
            <strong>tokens gerados para integrações</strong> (API{" "}
            <span className="font-mono text-sm">cek_</span>, CI{" "}
            <span className="font-mono text-sm">ci_</span> e webhooks) é{" "}
            <strong>exclusiva do Usuário</strong>. Exposição de tokens em
            repositórios, logs de pipelines, forks ou mensagens é
            responsabilidade do Usuário — adote rotação periódica e menor
            privilégio.
          </LegalP>
          <LegalP>
            <strong>2.5. Limites do modelo.</strong> A proteção abrange
            armazenamento e trânsito na Plataforma;{" "}
            <strong>não abrange</strong> texto claro exibido em
            terminal/navegador, arquivos .env exportados para o disco local, o
            vault local SQLite da CLI (
            <span className="font-mono text-sm">~/.criptenv/</span>), variáveis
            injetadas em runners de CI/CD, nem vazamentos no equipamento ou
            infraestrutura do próprio Usuário.
          </LegalP>
          <LegalP>
            <strong>2.6. Boas práticas do Serviço.</strong> Sem dever de
            exaustividade nem criação de garantia: cookies HTTP-only, sessões
            armazenadas como hash, 2FA por TOTP, rate limiting, logs de
            auditoria, cifragem em repouso das configurações de integrações e
            tokens de API guardados apenas como hash.
          </LegalP>
        </LegalSection>

        <LegalSection id="3-responsabilidade" title="3. Segregação de ambientes e limitação de responsabilidade extrema">
          <LegalAlert variant="danger" title="Aviso 3.1 — Ambientes de produção vs. desenvolvimento local">
            <LegalP>
              O CriptEnv organiza segredos por ambientes (por padrão:
              production, staging e development) e foi desenhado para o{" "}
              <strong>fluxo de trabalho de desenvolvimento de software</strong>.{" "}
              <strong>
                O uso para armazenar, sincronizar ou distribuir credenciais de
                AMBIENTES DE PRODUÇÃO é por conta e risco exclusivo do Usuário e
                exige cautela máxima
              </strong>
              : avaliação de risco própria, backups, redundância de custódia das
              senhas de vault, plano de contingência para indisponibilidade e
              conformidade setorial aplicável (PCI-DSS, SOC 2, HIPAA, BACEN
              etc.).
            </LegalP>
            <LegalP>
              A irrecoverabilidade criptográfica (2.4), somada à ausência de SLA
              (1.2), pode tornar a dependência exclusiva do Serviço incompatível
              com requisitos de missão crítica.{" "}
              <strong>
                Não utilize o Serviço como única fonte de verdade para segredos
                de produção.
              </strong>
            </LegalP>
          </LegalAlert>
          <LegalSub title="3.2. Isenção de danos indiretos (lucros cessantes)" />
          <LegalP>
            Na extensão máxima permitida pela lei, o mantenedor{" "}
            <strong>não responde por danos indiretos, reflexos, emergentes ou
            lucros cessantes</strong>, incluindo:
          </LegalP>
          <LegalUl>
            <LegalLi>perdas financeiras ou de receita;</LegalLi>
            <LegalLi>interrupção de negócios ou de atividade profissional;</LegalLi>
            <LegalLi>
              <strong>falhas, quebras ou atrasos em pipelines de CI/CD</strong>,
              builds, deploys ou workflows;
            </LegalLi>
            <LegalLi>
              <strong>vazamentos locais</strong> no equipamento, repositório,
              runner ou infraestrutura do Usuário;
            </LegalLi>
            <LegalLi>
              perda de dados cifrados por esquecimento de senhas/chaves (2.4);
            </LegalLi>
            <LegalLi>
              indisponibilidade de sistemas derivados do uso — ou da
              impossibilidade de uso — da ferramenta;
            </LegalLi>
            <LegalLi>
              perda de dados por descontinuidade do Serviço (1.5).
            </LegalLi>
          </LegalUl>
          <LegalP>
            <strong>3.3. Terceiros e APIs conectadas.</strong> O mantenedor não
            responde por falhas, indisponibilidades, mudanças unilaterais,
            cotas, atrasos ou comprometimento de contas originados em{" "}
            <strong>GitHub (OAuth, Actions, workflows), Google, Discord,
            Mercado Pago, Vercel, Render, webhooks</strong> ou provedores de
            nuvem. Cada integração rege-se pelos termos do respectivo provedor.
          </LegalP>
          <LegalP>
            <strong>3.4. Responsabilidade do Usuário.</strong> Legalidade do
            conteúdo armazenado; titularidade ou autorização das credenciais
            guardadas; precisão dos dados; proteção de textos claros e exports
            locais; decisões de engenharia tomadas com base na Plataforma.
          </LegalP>
          <LegalP>
            <strong>3.5. Salvaguardas legais.</strong> As limitações não afastam
            responsabilidade por dolo, fraude ou culpa grave; não alcançam
            direitos irrenunciáveis nem normas de ordem pública; e, quando
            configurada relação de consumo, prevalecem as normas protetivas do
            Código de Defesa do Consumidor.
          </LegalP>
        </LegalSection>

        <LegalSection id="4-equipes" title="4. Gestão de equipes e dashboard">
          <LegalP>
            <strong>4.1.</strong> Projetos, ambientes e segredos podem ser
            organizados em equipes com papéis de acesso:{" "}
            <span className="font-mono text-sm">owner</span>,{" "}
            <span className="font-mono text-sm">admin</span>,{" "}
            <span className="font-mono text-sm">developer</span> e{" "}
            <span className="font-mono text-sm">viewer</span>.
          </LegalP>
          <LegalP>
            <strong>4.2. Responsabilidade do administrador.</strong> O{" "}
            <strong>
              criador do projeto ou administrador da organização/equipe é o
              único responsável por gerenciar quem tem permissão para ler,
              editar, importar, exportar ou remover os .env
            </strong>
            : política de convites, atribuição e revisão periódica de papéis
            (menor privilégio), revogação imediata de desligados e verificação
            da identidade dos convidados.
          </LegalP>
          <LegalP>
            <strong>4.3. Atos de membros convidados.</strong> Todas as ações
            praticadas por membros convidados — leitura, alteração, exportação e
            exclusão de segredos —{" "}
            <strong>são de responsabilidade do usuário administrador</strong>{" "}
            que os admitiu, perante terceiros e demais membros, sem direito de
            regresso contra o mantenedor.
          </LegalP>
          <LegalP>
            <strong>4.4. Segredos compartilhados.</strong> Ao convidar membros,
            o administrador consente o compartilhamento do material cifrado e da
            senha do vault. A proteção do texto claro após entrega ao membro
            (exports, cópias, repositórios) escapa ao controle do Serviço.
          </LegalP>
          <LegalP>
            <strong>4.5. Auditoria.</strong> A Plataforma registra logs por
            projeto (quem operou, qual operação, quando — sem conteúdo de
            segredos), acessíveis a administradores, como recurso de
            transparência e segurança (art. 15 do Marco Civil da Internet).
          </LegalP>
        </LegalSection>

        <LegalSection id="5-doacoes" title="5. Doações voluntárias">
          <LegalP>
            <strong>5.1. Natureza.</strong> As contribuições via{" "}
            <strong>Pix, processadas pelo Mercado Pago</strong>, são{" "}
            <strong>atos estritamente voluntários e não comerciais</strong> para
            apoiar infraestrutura, manutenção, documentação e evolução do
            Serviço. Não configuram compra, assinatura, licença, patrocínio,
            investimento nem contraprestação de direito material.
          </LegalP>
          <LegalP>
            <strong>5.2. Sem contrapartida.</strong>{" "}
            <strong>
              Doar não concede recursos exclusivos, suporte prioritário ou
              direitos comerciais
            </strong>{" "}
            — nem funcionalidades adicionais, níveis de acesso, tratamento
            diferenciado ou influência sobre o roadmap. Doadores e não doadores
            recebem idêntico Serviço, nas condições da Cláusula 1.
          </LegalP>
          <LegalAlert variant="warning" title="Aviso 5.3 — Valores não reembolsáveis">
            <LegalP>
              <strong>
                Os valores doados não são reembolsáveis sob nenhuma hipótese
              </strong>
              , ressalvadas apenas hipóteses previstas em normas de ordem
              pública, ordem judicial/autoridade competente e cobranças
              duplicadas comprovadamente técnicas, tratadas nos canais do
              Mercado Pago.
            </LegalP>
          </LegalAlert>
          <LegalP>
            <strong>5.4. Fluxo financeiro de terceiro.</strong> O processamento
            do pagamento (QR Code Pix, compensação, conciliação, estornos legais
            e dados transacionais){" "}
            <strong>corre sob os termos e riscos do Mercado Pago</strong>, que
            atua como controlador independente do evento de pagamento.
          </LegalP>
          <LegalP>
            <strong>5.5. Dados mínimos.</strong> Nome e e-mail no fluxo de
            doação são opcionais e servem apenas à confirmação/agradecimento e
            organização interna, conforme a{" "}
            <Link
              href="/politica-de-privacidade"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </LegalP>
        </LegalSection>

        <LegalSection id="6-uso-aceitavel" title="6. Uso aceitável e condutas proibidas">
          <LegalP>
            <strong>6.1.</strong> É vedado, sem limitação: armazenar conteúdo
            ilícito ou credenciais obtidas por meios fraudulentos; usar a
            Plataforma para distribuir malware ou material protegido sem
            autorização; burlar limites de requisição, autenticação, isolamento
            entre contas ou mecanismos de segurança; usar tokens de CI/API de
            terceiros sem autorização ou ceder a própria conta; abusar da
            infraestrutura gratuita (uso como armazenamento genérico, mineração,
            spam via webhooks).
          </LegalP>
          <LegalP>
            <strong>6.2. Sanções.</strong> O mantenedor pode, a seu critério e
            sem aviso, suspender, restringir ou encerrar acessos em caso de
            violação, risco à segurança ou à infraestrutura, sem prejuízo das
            medidas legais cabíveis.
          </LegalP>
        </LegalSection>

        <LegalSection id="7-propriedade" title="7. Propriedade intelectual e licenças">
          <LegalP>
            <strong>7.1.</strong> O código do CriptEnv é software livre sob{" "}
            <strong>licença MIT</strong>. Marcas de terceiros citadas (GitHub,
            Google, Discord, Mercado Pago, Vercel, Render e outras) pertencem a
            seus titulares e{" "}
            <strong>não indicam patrocínio, parceria ou endosso</strong>.
          </LegalP>
          <LegalP>
            <strong>7.2. Conteúdo do Usuário.</strong> Você mantém toda a
            titularidade do seu conteúdo — do qual, pela arquitetura
            Zero-Knowledge, o mantenedor sequer toma conhecimento em texto
            claro. É concedida apenas a licença mínima, não exclusiva e
            funcionalmente necessária para armazenar, replicar em backups e
            transmitir, de forma cifrada, os blocos que você mesmo envia.
          </LegalP>
        </LegalSection>

        <LegalSection id="8-terminais" title="8. Disponibilidade por terminais (CLI, API, GitHub Action)">
          <LegalP>
            <strong>8.1. CLI.</strong> A CLI mantém vault local em SQLite em{" "}
            <span className="font-mono text-sm">~/.criptenv/</span> e pode
            gravar .env em texto claro quando você exportar. A segurança da
            máquina local e dos arquivos exportados é exclusivamente sua
            (Cláusula 2.5).
          </LegalP>
          <LegalP>
            <strong>8.2. GitHub Action e CI/CD.</strong> A Action roda nos
            runners e repositórios do Usuário, sob sua configuração e custódia,
            com tokens de CI emitidos por você. Exposição de variáveis em logs,
            forks, caches ou artefatos depende da configuração de segurança do
            seu repositório.
          </LegalP>
          <LegalP>
            <strong>8.3. API pública.</strong> Endpoints, chaves{" "}
            <span className="font-mono text-sm">cek_</span> e limites de taxa
            podem ser alterados ou descontinuados conforme a Cláusula 1.5, com
            versionamento de melhor esforço (
            <span className="font-mono text-sm">/api/v1</span>).
          </LegalP>
        </LegalSection>

        <LegalSection id="9-gerais" title="9. Alterações, legislação e foro">
          <LegalP>
            <strong>9.1. Alterações.</strong> Estes Termos podem ser alterados a
            qualquer momento (mudanças no Serviço, na legislação ou em
            orientações da ANPD), vigorando imediatamente na publicação.
            Alterações materialmente relevantes serão comunicadas, quando
            factível, por e-mail ou aviso no Dashboard. O uso continuado após a
            publicação implica aceitação da versão vigente.
          </LegalP>
          <LegalP>
            <strong>9.2. Legislação e foro.</strong> Regem-se pelas leis da
            República Federativa do Brasil (Código Civil, LGPD, Marco Civil da
            Internet e, quando configurada relação de consumo, o CDC). Elege-se
            o foro do domicílio do titular em relações de consumo; não
            configurada relação de consumo, o foro do domicílio do mantenedor,
            em território brasileiro.
          </LegalP>
          <LegalP>
            <strong>9.3. Disposições gerais.</strong> A nulidade de qualquer
            cláusula não invalida o restante; a tolerância não implica renúncia;
            o silêncio não importa concordância; estes Termos e a documentação
            técnica pública constituem o inteiro acordo quanto ao seu objeto.
          </LegalP>
        </LegalSection>
      </LegalDocument>
      <Footer />
    </>
  );
}
