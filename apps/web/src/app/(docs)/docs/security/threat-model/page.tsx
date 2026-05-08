'use client';

import {
  Breadcrumb,
  Callout,
  CodeBlock,
  StatusTable,
} from '@/components/docs';

export default function ThreatModelPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Segurança', href: '/docs/security' },
          { label: 'Modelo de Ameaças', href: '/docs/security/threat-model' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Modelo de Ameaças</h1>

      <p className="text-muted-foreground mb-6">
        Esta página analisa os cenários de ataque mais relevantes para o CriptEnv,
        avaliando o nível de risco de cada um e as mitigações implementadas pela
        arquitetura de segurança do sistema.
      </p>

      <Callout type="info">
        O modelo de ameaças assume que o atacante pode ter acesso completo ao servidor,
        banco de dados e infraestrutura — mas não ao dispositivo do usuário.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Resumo de Ameaças</h2>

      <StatusTable
        columns={['Cenário', 'Risco', 'Impacto', 'Status']}
        rows={[
          [
            'Banco de dados comprometido',
            'Crítico',
            'Ciphertext exposto, mas indescritível sem chave mestra',
            'Mitigado',
          ],
          [
            'Administrador malicioso',
            'Alto',
            'Acesso a infraestrutura, mas não a dados em texto claro',
            'Mitigado',
          ],
          [
            'Man-in-the-Middle (MITM)',
            'Alto',
            'Interceptação de tráfego, mas apenas ciphertext visível',
            'Mitigado',
          ],
          [
            'Ataque XSS (Cross-Site Scripting)',
            'Alto',
            'Possível execução de código no contexto da aplicação',
            'Mitigado',
          ],
          [
            'Sequestro de sessão (Session Hijacking)',
            'Médio',
            'Acesso temporário à sessão autenticada',
            'Mitigado',
          ],
          [
            'Ataque de força bruta na senha',
            'Médio',
            'Tentativa de adivinhar a senha mestra',
            'Mitigado',
          ],
          [
            'Vazamento de memória do servidor',
            'Baixo',
            'Dados em memória podem conter fragmentos temporários',
            'Mitigado',
          ],
        ]}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">Análise Detalhada</h2>

      <div className="space-y-6">
        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Crítico
            </span>
            <h3 className="font-semibold">Banco de Dados Comprometido</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um atacante obtém acesso completo ao banco de dados
            do servidor, incluindo todos os registros de usuários, ambientes e segredos.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong> Todos os dados sensíveis são armazenados como
            ciphertext AES-256-GCM. O banco contém apenas:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>Ciphertext (indescritível sem chave de ambiente)</li>
            <li>Salt do PBKDF2 (público por design)</li>
            <li>IVs e Auth Tags (não-secretos, parte do formato GCM)</li>
            <li>Vault proof (hash para verificação, não a chave em si)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> Os dados roubados são inúteis. Sem a senha
            mestra do usuário (que nunca sai do navegador), é computacionalmente
            inviável derivar as chaves de criptografia.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Alto
            </span>
            <h3 className="font-semibold">Administrador Malicioso</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um administrador do servidor ou funcionário com
            acesso privilegiado tenta acessar os dados dos usuários.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong> A arquitetura zero-knowledge garante que mesmo
            administradores com acesso root ao servidor não podem:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>Descriptografar os segredos dos usuários</li>
            <li>Obter senhas mestras ou chaves derivadas</li>
            <li>Injetar código malicioso que capture chaves (CSP e auditoria de deploy)</li>
            <li>Modificar o código do cliente sem detecção (integridade de deploy)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> O administrador pode ver metadados (timestamps,
            IDs) mas não o conteúdo dos segredos.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Alto
            </span>
            <h3 className="font-semibold">Man-in-the-Middle (MITM)</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um atacante intercepta o tráfego de rede entre o
            navegador do usuário e o servidor.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>TLS obrigatório (HTTPS) para todas as comunicações</li>
            <li>HSTS habilitado para prevenir downgrade para HTTP</li>
            <li>Dados já criptografados antes do envio (double encryption)</li>
            <li>Senha mestra nunca é transmitida pela rede</li>
            <li>Chaves derivadas nunca saem do navegador</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> Mesmo com TLS comprometido, o atacante só
            veria ciphertext AES-256-GCM que não pode descriptografar.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Alto
            </span>
            <h3 className="font-semibold">Ataque XSS (Cross-Site Scripting)</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um atacante injeta scripts maliciosos na aplicação
            que executam no contexto do navegador do usuário.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>Content Security Policy (CSP) restritivo</li>
            <li>Sanitização de inputs em todos os campos</li>
            <li>Frameworks modernos com escaping automático (React)</li>
            <li>HttpOnly cookies para tokens de sessão</li>
            <li>Subresource Integrity (SRI) para recursos externos</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> Se um XSS for bem-sucedido apesar das mitigações,
            o atacante poderia acessar dados em memória durante a sessão ativa. As chaves
            de sessão não são persistidas, limitando a janela de ataque.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Médio
            </span>
            <h3 className="font-semibold">Sequestro de Sessão (Session Hijacking)</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um atacante rouba o token de sessão do usuário e
            se passa por ele no servidor.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>Sessões com expiração automática</li>
            <li>Chaves de sessão efêmeras (não persistidas em disco)</li>
            <li>Binding de sessão a IP/User-Agent</li>
            <li>Detecção de sessões concorrentes anômalas</li>
            <li>Revogação forçada de sessões suspeitas</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> O atacante pode acessar a API, mas os dados
            retornados já estão criptografados. Sem a senha mestra (que não está na
            sessão), não é possível descriptografar nada.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
              Risco Médio
            </span>
            <h3 className="font-semibold">Ataque de Força Bruta</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Cenário:</strong> Um atacante tenta adivinhar a senha mestra do
            usuário testando milhões de combinações.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>Mitigação:</strong>
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 mb-3">
            <li>PBKDF2 com 100.000 iterações (torna cada tentativa lenta)</li>
            <li>Salt único por usuário (impede ataques em massa / rainbow tables)</li>
            <li>Rate limiting no endpoint de autenticação</li>
            <li>Bloqueio temporário após múltiplas tentativas falhas</li>
            <li>AES-256-GCM com Auth Tag (falha imediata em senha errada)</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            <strong>Resultado:</strong> Com 100k iterações de PBKDF2-SHA256, cada tentativa
            leva ~100ms. Testar 1 bilhão de senhas levaria ~3.170 anos em hardware comum.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Resumo de Defesas em Profundidade</h2>

      <CodeBlock
        language="text"
        code={`Camada 1: Transporte
  └─ TLS 1.3 + HSTS + Certificate Pinning

Camada 2: Criptografia do Cliente
  └─ AES-256-GCM com chaves derivadas localmente

Camada 3: Derivação de Chaves
  └─ PBKDF2 (100k iter) + HKDF por ambiente

Camada 4: Autorização
  └─ Vault Proof (derivado independentemente)

Camada 5: Sessão
  └─ Tokens efêmeros + expiração automática

Camada 6: Infraestrutura
  └─ Rate limiting + WAF + monitoramento

Resultado: Mesmo com comprometimento total de uma camada,
as demais continuam protegendo os dados do usuário.`}
      />

      <Callout type="warning">
        <strong>Responsabilidade do Usuário:</strong> A segurança do sistema depende
        fundamentalmente da força da senha mestra. Use uma senha longa, única e
        gerada por um gerenciador de senhas. A arquitetura zero-knowledge não pode
        proteger contra uma senha fraca ou reutilizada.
      </Callout>
    </div>
  );
}
