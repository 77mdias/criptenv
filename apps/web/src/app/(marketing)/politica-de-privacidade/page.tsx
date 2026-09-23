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
  title: "Política de Privacidade · CriptEnv",
  description:
    "Política de Privacidade do CriptEnv (LGPD): coleta mínima via OAuth, arquitetura Zero-Knowledge, não comercialização de dados, transferência internacional, retenção e exclusão definitiva da conta.",
};

function DataTable({
  rows,
}: {
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.label}
              className={index % 2 === 0 ? "bg-[var(--background-subtle)]" : ""}
            >
              <th
                scope="row"
                className="w-1/3 px-4 py-3 align-top font-medium text-[var(--text-primary)]"
              >
                {row.label}
              </th>
              <td className="px-4 py-3 align-top leading-relaxed text-[var(--text-secondary)]">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <>
      <LegalDocument
        badge="Documento jurídico · LGPD"
        title="Política de Privacidade"
        intro={
          <>
            <LegalP>
              Esta Política descreve como o{" "}
              <strong>CriptEnv</strong> trata dados pessoais, em conformidade
              com a <strong>Lei nº 13.709/2018 (LGPD)</strong>, o Marco Civil da
              Internet (Lei nº 12.965/2014) e normas correlatas. O mantenedor
              atua como <strong>controlador</strong> dos dados descritos abaixo.
            </LegalP>
            <LegalP>
              Ela integra, e deve ser lida junto com, os{" "}
              <Link
                href="/termos-de-uso"
                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                Termos de Uso
              </Link>
              . O princípio central:{" "}
              <strong>
                o conteúdo dos seus segredos jamais é coletado
              </strong>{" "}
              — é cifrado no seu dispositivo e chega ao servidor como bloco
              ilegível.
            </LegalP>
          </>
        }
        version="Versão 1.0 · Em vigor desde 23 de setembro de 2026 · Encarregado (DPO): support@criptenv.dev"
      >
        <LegalSection id="1-dados" title="1. Dados tratados, finalidades e bases legais">
          <LegalP>
            <strong>1.1. Minimização.</strong> Coletamos o mínimo indispensável
            para autenticar usuários e operar equipes. Nada além disso.
          </LegalP>
          <LegalSub title="1.2. Coleta via OAuth (Google, GitHub, Discord)" />
          <LegalP>
            Ao entrar com um provedor OAuth, solicitamos{" "}
            <strong>apenas</strong> os dados abaixo, puramente para fins de{" "}
            <strong>autenticação e gestão de equipes</strong>:
          </LegalP>
          <DataTable
            rows={[
              {
                label: "E-mail",
                value:
                  "Autenticação, verificação de identidade e avisos de segurança da conta.",
              },
              {
                label: "Nome de exibição",
                value: "Identificação no dashboard e nas telas de equipe.",
              },
              {
                label: "ID público da conta do provedor",
                value:
                  "Vínculo único entre a conta do provedor e a conta CriptEnv.",
              },
              {
                label: "URL de avatar (quando disponível)",
                value: "Exibição de foto de perfil.",
              },
            ]}
          />
          <LegalP>
            Escopos mínimos solicitados:{" "}
            <span className="font-mono text-sm">read:user user:email</span>{" "}
            (GitHub), <span className="font-mono text-sm">openid email profile</span>{" "}
            (Google), <span className="font-mono text-sm">identify email</span>{" "}
            (Discord). Em caso de divergência, prevalece o pedido de permissão
            exibido pelo provedor no momento do consentimento.
          </LegalP>
          <LegalSub title="1.3. Autenticação por e-mail e senha" />
          <LegalP>
            E-mail, nome, <strong>hash</strong> da senha (nunca o texto claro),
            salt de derivação, indicadores de verificação de e-mail e
            configuração de 2FA. E-mails transacionais (verificação, redefinição
            de senha, convites, alertas de expiração, confirmação de doação) são
            enviados quando o evento correspondente ocorre.
          </LegalP>
          <LegalSub title="1.4. Dados técnicos e de segurança" />
          <LegalP>
            Para proteger a Plataforma (legítimo interesse em segurança, art.
            7º, IX, e art. 11, II, &quot;f&quot; da LGPD; art. 15 do Marco
            Civil): registros de sessão com IP e user-agent; logs de auditoria
            por projeto (identificador do operador, operação e data/hora —{" "}
            <strong>sem conteúdo de segredos</strong>); métricas agregadas de
            uso; registros de rate limiting e prevenção a abuso.
          </LegalP>
          <LegalSub title="1.5. Doações e metadados" />
          <LegalP>
            Doações: apenas os dados voluntariamente informados (nome e e-mail
            opcionais; valor; status), para confirmação, agradecimento e
            obrigações contábeis/fiscais (art. 7º, II e V, LGPD). Metadados de
            projetos (nomes de projetos, ambientes e papéis de membros) são
            necessários à execução do serviço solicitado (art. 7º, V).
          </LegalP>
          <LegalAlert variant="info" title="O que NÃO fazemos">
            <LegalUl>
              <LegalLi>
                Não coletamos dados de navegação para publicidade nem usamos
                cookies de rastreamento ou redes de anúncios.
              </LegalLi>
              <LegalLi>Não criamos perfis comportamentais nem decisões automatizadas com efeitos jurídicos (art. 20 da LGPD).</LegalLi>
              <LegalLi>
                <strong>
                  Não vendemos, alugamos, negociamos ou monetizamos dados
                  pessoais.
                </strong>
              </LegalLi>
            </LegalUl>
          </LegalAlert>
        </LegalSection>

        <LegalSection id="2-compartilhamento" title="2. Compartilhamento e não comercialização de dados">
          <LegalP>
            <strong>2.1. Compromisso.</strong>{" "}
            <strong>
              Os dados cadastrais dos usuários não são comercializados nem
              compartilhados com terceiros
            </strong>{" "}
            para fins publicitários, de marketing, de prospecção ou de qualquer
            outra natureza mercantil.
          </LegalP>
          <LegalP>
            <strong>2.2. Operadores e subprocessadores.</strong> Alguns
            fornecedores tratam dados exclusivamente para operar o Serviço, na
            condição de operadores (arts. 5º, VII, e 39 da LGPD), com salvaguardas
            contratuais e técnicas:
          </LegalP>
          <DataTable
            rows={[
              {
                label: "Cloudflare",
                value:
                  "Entrega do aplicativo, proxy/TLS e armazenamento de avatares (R2).",
              },
              {
                label: "Mercado Pago",
                value:
                  "Processamento das doações Pix; dados transacionais permanecem com o provedor.",
              },
              {
                label: "Resend",
                value: "Envio de e-mails transacionais (destinatário e conteúdo da mensagem).",
              },
              {
                label: "GitHub / Google / Discord",
                value:
                  "Autenticação OAuth; são controladores dos dados em suas próprias plataformas, regidos por suas políticas.",
              },
              {
                label: "Provedor de VPS / banco de dados",
                value:
                  "Hospedagem da API e do PostgreSQL (dados cifrados de vault; cadastro básico).",
              },
            ]}
          />
          <LegalP>
            <strong>2.3. Hipóteses legais.</strong> Dados podem ser
            compartilhados perante ordem judicial, requisição de autoridade
            competente (incluindo ANPD e autoridades de segurança, art. 23 da
            LGPD e Marco Civil) ou para proteção de direitos, prevenção a fraude
            e segurança — sempre na menor extensão possível.
          </LegalP>
        </LegalSection>

        <LegalSection id="3-transferencia" title="3. Transferência internacional de dados">
          <LegalP>
            Alguns operadores podem processar dados fora do território
            brasileiro (por exemplo, Cloudflare e Resend, nos Estados Unidos;
            GitHub, Google e Discord em centros de dados globais). A
            transferência rege-se pelo <strong>art. 33 da LGPD</strong>, com
            garantias como cláusulas contratuais padrão do fornecedor,
            cifragem em trânsito (TLS) e a própria arquitetura Zero-Knowledge —
            que impede que o conteúdo dos segredos acompanhe qualquer
            transferência. Você pode solicitar ao Encarregado informações sobre
            os países envolvidos e as salvaguardas aplicáveis.
          </LegalP>
        </LegalSection>

        <LegalSection id="4-cookies" title="4. Cookies e armazenamento local">
          <LegalP>
            <strong>4.1.</strong> Utilizamos um cookie de sessão{" "}
            <strong>HTTP-only</strong> (inacessível a scripts, mitigando XSS)
            para manter o login e chaves de localStorage estritamente funcionais
            (ex.: preferência de tema).{" "}
            <strong>
              Chaves criptográficas nunca são persistidas em localStorage
            </strong>{" "}
            — existem apenas em memória durante a sessão.
          </LegalP>
          <LegalP>
            <strong>4.2.</strong> Não há cookies de terceiros para publicidade,
            fingerprinting ou rastreamento entre sites. A autenticação OAuth e o
            pagamento Pix ocorrem nos domínios dos respectivos provedores,
            sujeitos a suas políticas.
          </LegalP>
        </LegalSection>

        <LegalSection id="5-seguranca" title="5. Medidas de segurança e notificação de incidentes">
          <LegalP>
            <strong>5.1.</strong> Além da arquitetura descrita nos{" "}
            <Link
              href="/termos-de-uso#2-zero-knowledge"
              className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
            >
              Termos de Uso (Cláusula 2)
            </Link>
            : transporte cifrado (TLS) em toda a Plataforma; controle de acesso
            baseado em papéis (RBAC) por projeto; tokens armazenados como hash;
            verificação de assinatura em webhooks de pagamento; isolamento entre
            contas e projetos; segredos de infraestrutura mantidos apenas como
            variáveis de ambiente.
          </LegalP>
          <LegalP>
            <strong>5.2. Incidentes (art. 48 da LGPD).</strong> Em caso de
            incidente de segurança que possa acarretar risco relevante aos
            titulares, comunicaremos à <strong>ANPD</strong> e aos titulares
            afetados os dados exigidos por lei, em prazo razoável, por e-mail
            cadastrado e/ou aviso no Serviço. A arquitetura Zero-Knowledge foi
            desenhada para que incidentes de servidor não exponham o conteúdo
            dos segredos.
          </LegalP>
          <LegalP>
            <strong>5.3. Reporte de vulnerabilidades.</strong> Relatos
            responsáveis são bem-vindos em{" "}
            <span className="font-mono text-sm">support@criptenv.dev</span>,
            com detalhes técnicos e prazo razoável para correção antes de
            publicação (responsible disclosure).
          </LegalP>
        </LegalSection>

        <LegalSection id="6-retencao" title="6. Retenção de dados">
          <LegalP>
            <strong>6.1.</strong> Dados de conta são retidos enquanto a conta
            existir. Sessões expiram conforme configurado. Logs de segurança e
            auditoria são retidos pelo período necessário à proteção da
            Plataforma e a obrigações legais (art. 15, §1º, do Marco Civil),
            com posterior eliminação ou anonimização. Registros de doações são
            mantidos pelo prazo de obrigações contábeis/fiscais aplicável.
          </LegalP>
          <LegalP>
            <strong>6.2.</strong> Ao final do tratamento, os dados são
            eliminados ou anonimizados (art. 16 da LGPD), respeitadas retenções
            legais. Os blocos cifrados de vault, sem conhecimento da chave, são
            matematicamente inúteis e eliminados junto com os projetos
            (Cláusula 8).
          </LegalP>
        </LegalSection>

        <LegalSection id="7-direitos" title="7. Direitos do titular (art. 18 da LGPD)">
          <LegalP>
            Você pode solicitar, a qualquer momento: confirmação da existência
            de tratamento; acesso aos dados; correção de dados incompletos,
            inexatos ou desatualizados; anonimização, bloqueio ou eliminação de
            dados desnecessários, excessivos ou tratados em desconformidade;
            portabilidade; informação sobre compartilhamentos; revogação de
            consentimento; e oposição a tratamentos baseados em legítimo
            interesse.
          </LegalP>
          <LegalP>
            <strong>7.1. Como exercer.</strong> (i){" "}
            <strong>Correção de perfil e exclusão de avatar</strong>:
            diretamente no Dashboard (Configurações da conta), sem
            intermediários; (ii){" "}
            <strong>exclusão da conta e dados</strong>: autoatendimento na
            própria conta (Cláusula 8); (iii){" "}
            <strong>demais solicitações</strong>: e-mail ao Encarregado (
            <span className="font-mono text-sm">support@criptenv.dev</span>) a
            partir do endereço cadastrado. Respostas em até{" "}
            <strong>15 (quinze) dias</strong>, prorrogáveis uma vez por igual
            período com justificativa comunicada, conforme orientação da ANPD.
          </LegalP>
          <LegalP>
            <strong>7.2.</strong> Você pode também peticionar diretamente à
            ANPD ou recorrer ao Poder Judiciário.
          </LegalP>
        </LegalSection>

        <LegalSection id="8-exclusao" title="8. Exclusão definitiva da conta">
          <LegalP>
            <strong>8.1. Como excluir.</strong> No Dashboard, em{" "}
            <strong>
              Configurações da conta → Excluir conta
            </strong>{" "}
            (com confirmação por digitação de segurança), ou por solicitação ao
            Encarregado a partir do e-mail registrado.
          </LegalP>
          <LegalP>
            <strong>8.2. O que é removido.</strong> A exclusão produz{" "}
            <strong>eliminação definitiva</strong> de: dados de login (e-mail,
            nome, avatar); vínculos OAuth (Google/GitHub/Discord); sessões
            ativas e dispositivos confiáveis; tokens de API/CI; participações em
            equipes; e{" "}
            <strong>
              os blocos de dados criptografados dos projetos de sua titularidade
            </strong>
            , incluindo os vaults cifrados de todos os ambientes.
          </LegalP>
          <LegalAlert variant="warning" title="Antes de excluir — efeitos sobre equipes">
            <LegalP>
              Projetos <strong>de sua titularidade</strong> são excluídos em
              cascata e{" "}
              <strong>membros convidados perdem o acesso</strong>. Para apenas
              sair de uma equipe sem destruir o projeto, transfira a titularidade
              ou peça a remoção da sua participação.{" "}
              <strong>
                Exporte previamente os .env que desejar conservar
              </strong>
              : após a exclusão, nada pode ser recuperado (arquitetura
              Zero-Knowledge).
            </LegalP>
          </LegalAlert>
          <LegalP>
            <strong>8.3. Backups residuais.</strong> Cópias de segurança
            rotineiras podem persistir por ciclo limitado, sendo eliminadas com
            a rotação; encerrado o ciclo, nenhuma cópia identificável permanece.
            Podem ser conservados apenas dados anonimizados/estatísticos
            irrelacionáveis a você e registros obrigatórios por lei (ex.:
            doações).
          </LegalP>
        </LegalSection>

        <LegalSection id="9-menores" title="9. Titulares menores">
          <LegalP>
            O Serviço não é direcionado a menores de 16 (dezesseis) anos, e o
            tratamento de dados de crianças e adolescentes (art. 14 da LGPD) não
            faz parte de seu escopo. Contas suspeitas de pertencer a menores
            podem ser suspensas, com eliminação dos dados.
          </LegalP>
        </LegalSection>

        <LegalSection id="10-encarregado" title="10. Encarregado (DPO), contato e alterações">
          <LegalP>
            <strong>10.1.</strong> O Encarregado de Proteção de Dados do
            CriptEnv atende pelo canal{" "}
            <span className="font-mono text-sm">support@criptenv.dev</span>,
            para exercício de direitos, comunicação de incidentes, reporte de
            vulnerabilidades e questões sobre esta Política. Em caso de resposta
            insatisfatória, cabe reclamação à ANPD.
          </LegalP>
          <LegalP>
            <strong>10.2. Alterações.</strong> Esta Política pode ser alterada a
            qualquer momento (inclusive por mudanças de legislação ou
            orientações da ANPD), vigorando imediatamente na publicação;
            alterações materialmente relevantes serão comunicadas, quando
            factível, por e-mail ou aviso no Dashboard. A versão e a data vigentes
            constam sempre do topo desta página.
          </LegalP>
        </LegalSection>

        <LegalSection id="anexo-a" title="Anexo A — O que o servidor vê e o que nunca vê">
          <DataTable
            rows={[
              {
                label: "O servidor VÊ",
                value:
                  "Blocos cifrados AES-256-GCM (ciphertext, IV, auth tag, checksum); salt PBKDF2 e wrapped DEK; vault proof; metadados de projetos/ambientes; logs de auditoria (sem valores); IP e user-agent de sessão.",
              },
              {
                label: "O servidor NUNCA VÊ",
                value:
                  "Senha da conta em texto claro (apenas hash); senha do vault do projeto e chaves derivadas; conteúdo de variáveis, secrets, chaves e tokens; chaves em localStorage (nunca persistidas); exports .env do usuário; dados de navegação para publicidade (não coletamos).",
              },
            ]}
          />
          <LegalP>
            Documento redigido com base em auditoria técnica do código-fonte do
            CriptEnv (criptografia, autenticação, OAuth, doações, gestão de
            equipes e fluxos de exclusão de conta), visando à precisão entre o
            texto jurídico e a implementação real (art. 6º, VI — transparência,
            LGPD).
          </LegalP>
        </LegalSection>
      </LegalDocument>
      <Footer />
    </>
  );
}
