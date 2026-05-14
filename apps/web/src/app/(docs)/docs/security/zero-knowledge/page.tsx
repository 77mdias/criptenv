'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Tabs,
  Tab,
} from '@/components/docs';

export default function ZeroKnowledgePage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Segurança', href: '/docs/security' },
          { label: 'Zero-Knowledge', href: '/docs/security/zero-knowledge' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Arquitetura Zero-Knowledge</h1>

      <p className="text-muted-foreground mb-6">
        A arquitetura de conhecimento zero do CriptEnv garante que o servidor
        <strong> nunca tenha acesso</strong> aos seus segredos em texto claro.
        Toda criptografia e descriptografia acontece exclusivamente no cliente
        do usuário, usando a Vault password do projeto que nunca é transmitida.
      </p>

      <Callout type="info">
        Em termos simples: mesmo que o servidor seja completamente comprometido,
        os atacantes só teriam acesso a dados criptografados que são inúteis sem
        a Vault password do projeto.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">O Que É Conhecimento Zero?</h2>

      <p className="text-muted-foreground mb-4">
        No contexto do CriptEnv, &quot;conhecimento zero&quot; significa que o servidor
        pode confirmar que você tem a senha correta (através do vault proof) sem
        jamais saber qual é essa senha ou ter acesso às chaves derivadas dela.
      </p>

      <p className="text-muted-foreground mb-4">
        Isso é diferente de sistemas tradicionais onde o servidor armazena hashes
        de senha <em>e</em> os dados — no CriptEnv, os dados criptografados são
        inúteis mesmo para quem controla o servidor.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Como Funciona a Criptografia do Lado do Cliente</h2>

      <p className="text-muted-foreground mb-4">
        Todo o processo de criptografia acontece no navegador usando a Web Crypto API:
      </p>

      <CodeBlock
        language="text"
        code={`┌──────────────────────────────────────────────────────────────┐
│                    NAVEGADOR DO USUÁRIO                       │
│                                                              │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │   Vault     │───▶│   PBKDF2     │───▶│  Chave Vault   │  │
│  │  Password   │    │  (100k iter) │    │   (256-bit)    │  │
│  └─────────────┘    └──────────────┘    └───────┬────────┘  │
│                                                  │           │
│  ┌─────────────┐    ┌──────────────┐            │           │
│  │  Segredo    │───▶│  AES-256-GCM │◀───────────┘           │
│  │  (plaintext)│    │              │    + HKDF(env_id)       │
│  └─────────────┘    └──────┬───────┘                        │
│                            │                                 │
│                     Ciphertext                               │
│                  (IV + data + tag)                           │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼  Apenas ciphertext é enviado
┌──────────────────────────────────────────────────────────────┐
│                    SERVIDOR                                  │
│                                                              │
│   Armazena: ciphertext (inútil sem a chave)                 │
│   Recebe: vault proof (para verificação)                    │
│   Nunca vê: senha, chaves, plaintext                        │
└──────────────────────────────────────────────────────────────┘`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">O Que o Servidor Vê vs. Não Vê</h2>

      <Tabs defaultValue="sees">
        <Tab value="sees" label="O Servidor Vê">
          <div className="mt-4">
            <CodeBlock
              language="text"
              code={`✓ Ciphertext (dados criptografados em AES-256-GCM)
✓ IVs (vetores de inicialização — não são secretos)
✓ Auth Tags (tags de autenticação GCM)
✓ Salt do PBKDF2 (gerado no registro, público por design)
✓ Vault Proof (hash derivado para autenticação)
✓ IDs de ambientes e projetos (metadados não-secretos)
✓ Timestamps de criação e modificação
✓ Estrutura organizacional (projetos, ambientes)`}
            />
          </div>
        </Tab>

        <Tab value="not_sees" label="O Servidor NÃO Vê">
          <div className="mt-4">
            <CodeBlock
              language="text"
              code={`✗ Vault password do projeto
✗ Chave do vault derivada (PBKDF2 output)
✗ Chaves de ambiente (HKDF output)
✗ Valores das variáveis de ambiente em texto claro
✗ Nomes das variáveis (se criptografados)
✗ Qualquer dado em texto claro
✗ Chaves de sessão (efêmeras, não persistidas)
✗ Capacidade de descriptografar qualquer dado`}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Mecanismo do Vault Proof</h2>

      <p className="text-muted-foreground mb-4">
        O vault proof permite que o servidor verifique se o usuário conhece a senha
        correta sem que a senha ou as chaves de criptografia sejam transmitidas.
      </p>

      <CodeBlock
        language="text"
        code={`Geração do Vault Proof:
━━━━━━━━━━━━━━━━━━━━━

Vault Password + "proof_salt" (constante)
         │
         ▼
   PBKDF2-HMAC-SHA256 (100.000 iterações)
         │
         ▼
   Vault Proof (256-bit hash)
         │
         ▼
   Enviado ao servidor para verificação

O servidor armazena apenas o hash do proof.
Na autenticação, compara o proof enviado com o armazenado.
Se coincidir → acesso autorizado.
Se não coincidir → acesso negado.

        Importante: o vault proof é derivado da mesma Vault password,
        mas com salt diferente (&quot;proof_salt&quot;), garantindo que:
• O proof não pode ser usado para derivar a chave de criptografia
• A chave de criptografia não pode gerar o proof
• São dois caminhos criptográficos independentes`}
      />

      <Callout type="warning">
        O vault proof usa um salt constante (&quot;proof_salt&quot;) porque seu propósito é
        autenticação, não proteção de dados. Isso é seguro porque o proof não pode
        ser revertido para obter a chave de criptografia.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Implicações Práticas</h2>

      <div className="space-y-4 mb-8">
        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🔑 Esqueceu a senha?</h3>
          <p className="text-sm text-muted-foreground">
            Não há mecanismo de recuperação. Como o servidor nunca teve acesso à sua
            senha ou chaves, não é possível recuperar dados sem ela. Isso é uma
            <strong> feature</strong>, não um bug — garante que ninguém além de você
            pode acessar seus segredos.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🏢 Segurança para Equipes</h3>
          <p className="text-sm text-muted-foreground">
            Em ambientes compartilhados, cada membro acessa apenas projetos
            autorizados e a descriptografia continua acontecendo no cliente,
            garantindo isolamento criptográfico completo.
          </p>
        </div>

        <div className="border rounded-lg p-5">
          <h3 className="font-semibold mb-2">🔍 Auditoria</h3>
          <p className="text-sm text-muted-foreground">
            O servidor pode registrar eventos de acesso (timestamps, IPs, IDs de
            ambiente) sem nunca ter acesso ao conteúdo dos segredos. Isso permite
            auditoria de segurança sem comprometer a arquitetura zero-knowledge.
          </p>
        </div>
      </div>
    </div>
  );
}
