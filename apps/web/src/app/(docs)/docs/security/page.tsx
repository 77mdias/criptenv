'use client';

import {
  Breadcrumb,
  Callout,
  CardGrid,
  DocCard,
} from '@/components/docs';

export default function SecurityOverviewPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Segurança', href: '/docs/security' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Segurança</h1>

      <p className="text-muted-foreground mb-6">
        O CriptEnv foi projetado com uma arquitetura de <strong>conhecimento zero</strong> (zero-knowledge),
        garantindo que seus segredos de ambiente nunca sejam expostos ao servidor.
        Toda criptografia acontece no lado do cliente — o servidor armazena apenas
        dados criptografados que não podem ser decifrados sem a Vault password
        do projeto.
      </p>

      <Callout type="info">
        A Vault password do projeto nunca é enviada ao servidor. Ela é usada
        localmente para derivar chaves criptográficas que nunca saem do seu
        dispositivo.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Princípios de Segurança</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🔒 Confidencialidade</h3>
          <p className="text-sm text-muted-foreground">
            Todos os segredos são criptografados com AES-256-GCM antes de qualquer
            armazenamento ou transmissão. O servidor nunca vê dados em texto claro.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🛡️ Integridade</h3>
          <p className="text-sm text-muted-foreground">
            O AES-GCM fornece autenticação integrada (GCM Auth Tag de 128 bits),
            garantindo que qualquer adulteração nos dados criptografados seja detectada
            imediatamente durante a descriptografia.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">🔄 Sigilo Perfeito (Forward Secrecy)</h3>
          <p className="text-sm text-muted-foreground">
            Chaves de sessão não são persistidas. Cada sessão gera chaves efêmeras que
            são descartadas ao final da sessão, garantindo que a comprometimento de uma
            sessão não afete dados anteriores ou futuros.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold text-lg mb-2">💪 Resistência a Força Bruta</h3>
          <p className="text-sm text-muted-foreground">
            A derivação de chaves utiliza PBKDF2 com 100.000 iterações de HMAC-SHA256,
            tornando ataques de força bruta computacionalmente inviáveis mesmo com
            hardware especializado.
          </p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Hierarquia de Chaves</h2>

      <p className="text-muted-foreground mb-4">
        O CriptEnv utiliza uma hierarquia de chaves bem definida para isolar ambientes
        e projetos:
      </p>

      <div className="bg-muted rounded-lg p-4 font-mono text-sm mb-8">
        <p>Vault Password</p>
        <p className="ml-4">↓ PBKDF2-HMAC-SHA256 (100k iterações)</p>
        <p className="ml-4">Chave do Vault (256-bit)</p>
        <p className="ml-8">↓ HKDF-SHA256 (salt=env_id)</p>
        <p className="ml-8">Chave do Ambiente (256-bit)</p>
        <p className="ml-12">↓ AES-256-GCM</p>
        <p className="ml-12">Segredos Criptografados</p>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Documentação de Segurança</h2>

      <CardGrid>
        <DocCard
          title="Protocolo de Criptografia"
          description="Detalhes técnicos sobre algoritmos, parâmetros e fluxo completo de derivação de chaves."
          href="/docs/security/encryption"
        />
        <DocCard
          title="Arquitetura Zero-Knowledge"
          description="Como o modelo de conhecimento zero protege seus dados e o que o servidor pode e não pode ver."
          href="/docs/security/zero-knowledge"
        />
        <DocCard
          title="Modelo de Ameaças"
          description="Análise de cenários de ataque, níveis de risco e mitigações implementadas."
          href="/docs/security/threat-model"
        />
      </CardGrid>
    </div>
  );
}
