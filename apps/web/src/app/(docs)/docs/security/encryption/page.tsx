'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  ParamTable,
  Tabs,
  Tab,
} from '@/components/docs';

export default function EncryptionPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Segurança', href: '/docs/security' },
          { label: 'Criptografia', href: '/docs/security/encryption' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Protocolo de Criptografia</h1>

      <p className="text-muted-foreground mb-6">
        O CriptEnv utiliza uma cadeia de derivação de chaves em múltiplas camadas para
        garantir que cada ambiente tenha uma chave criptográfica única e isolada. Todo
        o processo acontece no navegador do usuário — o servidor nunca tem acesso às
        chaves ou aos dados em texto claro.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Fluxo de Derivação de Chaves</h2>

      <p className="text-muted-foreground mb-4">
        O processo completo de derivação segue estas etapas:
      </p>

      <CodeBlock
        language="text"
        code={`┌─────────────────────────────────────────────────────────┐
│  1. SENHA MESTRA (input do usuário)                     │
│     Exemplo: "minha-senha-segura-123"                   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  2. PBKDF2-HMAC-SHA256                                  │
│     Iterações: 100.000                                  │
│     Salt: 32 bytes aleatórios (gerado no registro)      │
│     Output: 256-bit Master Key                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  3. HKDF-SHA256 (por ambiente)                          │
│     IKM: Master Key                                     │
│     Salt: environment_id (UUID do ambiente)             │
│     Info: "criptenv-vault-v1"                           │
│     Output: 256-bit Environment Key                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  4. AES-256-GCM                                         │
│     Key: 256-bit Environment Key                        │
│     IV: 12 bytes aleatórios (por operação)              │
│     Auth Tag: 128 bits                                  │
│     Output: ciphertext + IV + auth_tag                  │
└─────────────────────────────────────────────────────────┘`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">Parâmetros Criptográficos</h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">PBKDF2 (Derivação da Chave Mestra)</h3>

      <ParamTable
        params={[
          {
            name: 'Algoritmo',
            type: 'string',
            description: 'HMAC-SHA256 — Função pseudo-aleatória baseada em hash',
          },
          {
            name: 'Iterações',
            type: 'number',
            description: '100.000 iterações — proteção contra força bruta',
          },
          {
            name: 'Tamanho do Salt',
            type: 'number',
            description: '32 bytes (256 bits) — gerado aleatoriamente no momento do registro',
          },
          {
            name: 'Tamanho da Chave',
            type: 'number',
            description: '32 bytes (256 bits) — chave mestra de saída',
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">HKDF (Derivação por Ambiente)</h3>

      <ParamTable
        params={[
          {
            name: 'Algoritmo',
            type: 'string',
            description: 'SHA-256 — Função de hash subjacente',
          },
          {
            name: 'IKM (Input Key Material)',
            type: 'string',
            description: 'Chave mestra de 256 bits derivada do PBKDF2',
          },
          {
            name: 'Salt',
            type: 'string',
            description: 'ID do ambiente (UUID) — garante chave única por ambiente',
          },
          {
            name: 'Info',
            type: 'string',
            description: '"criptenv-vault-v1" — contexto do domíneo de aplicação',
          },
          {
            name: 'Tamanho da Chave',
            type: 'number',
            description: '32 bytes (256 bits) — chave do ambiente de saída',
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">AES-256-GCM (Criptografia dos Dados)</h3>

      <ParamTable
        params={[
          {
            name: 'Algoritmo',
            type: 'string',
            description: 'AES-256-GCM — Criptografia autenticada com Galois/Counter Mode',
          },
          {
            name: 'Tamanho da Chave',
            type: 'number',
            description: '32 bytes (256 bits) — chave do ambiente derivada via HKDF',
          },
          {
            name: 'IV (Nonce)',
            type: 'number',
            description: '12 bytes (96 bits) — gerado aleatoriamente para cada operação de criptografia',
          },
          {
            name: 'Auth Tag',
            type: 'number',
            description: '16 bytes (128 bits) — tag de autenticação para verificação de integridade',
          },
        ]}
      />

      <Callout type="warning">
        O IV (vetor de inicialização) é gerado aleatoriamente para cada operação de
        criptografia. Nunca reutilize um IV com a mesma chave — isso comprometeria
        a segurança do GCM.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Derivação do Vault Proof</h2>

      <p className="text-muted-foreground mb-4">
        Além da chave de criptografia, o CriptEnv deriva uma chave de prova separada
        usada para autorização na API. Isso permite autenticar o usuário sem revelar
        a chave mestra ou a chave de criptografia.
      </p>

      <CodeBlock
        language="text"
        code={`┌─────────────────────────────────────────────────────────┐
│  PBKDF2-HMAC-SHA256                                     │
│     Password: Senha Mestra                              │
│     Salt: "proof_salt" (constante do sistema)           │
│     Iterações: 100.000                                  │
│     Output: Vault Proof (256-bit)                       │
└─────────────────────────────────────────────────────────┘

O Vault Proof é enviado ao servidor para verificação.
O servidor armazena apenas o hash do proof para comparação.
A chave de criptografia real nunca é transmitida.`}
      />

      <h2 className="text-2xl font-semibold mt-10 mb-4">Cofre Local vs. Nuvem</h2>

      <Tabs defaultValue="local">
        <Tab value="local" label="Cofre Local">
          <div className="mt-4">
            <p className="text-muted-foreground mb-4">
              O cofre local é armazenado em SQLite no diretório do usuário:
            </p>

            <CodeBlock
              language="text"
              code={`Localização: ~/.criptenv/vault.db

Estrutura do banco de dados:
├── sessions     → Sessões autenticadas (criptografadas)
├── environments → Ambientes com chaves derivadas
└── secrets      → Variáveis de ambiente (criptografadas)

Recursos de segurança:
• Banco de dados com permissões restritivas (0600)
• Sessões com expiração automática
• Chaves de sessão não persistidas em disco
• Cleanup automático de sessões expiradas`}
            />

            <Callout type="info">
              O cofre local permite uso offline completo. Todos os segredos necessários
              para descriptografar seus ambientes estão disponíveis localmente após a
              autenticação inicial.
            </Callout>
          </div>
        </Tab>

        <Tab value="cloud" label="Cofre na Nuvem">
          <div className="mt-4">
            <p className="text-muted-foreground mb-4">
              O cofre na nuvem armazena apenas dados já criptografados:
            </p>

            <CodeBlock
              language="text"
              code={`O que é armazenado no servidor:
┌─────────────────────────────────────────────────────┐
│ • Vault Proof (hash derivado da senha)              │
│ • Salt do PBKDF2 (32 bytes, público)                │
│ • Dados criptografados (ciphertext + IV + auth_tag) │
│ • IDs de ambientes e projetos (não-secretos)        │
└─────────────────────────────────────────────────────┘

O que NÃO é armazenado:
┌─────────────────────────────────────────────────────┐
│ ✗ Senha mestra                                      │
│ ✗ Chave mestra derivada                             │
│ ✗ Chaves de ambiente                                │
│ ✗ Dados em texto claro                              │
│ ✗ Chaves de sessão                                  │
└─────────────────────────────────────────────────────┘`}
            />
          </div>
        </Tab>
      </Tabs>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Implementação</h2>

      <p className="text-muted-foreground mb-4">
        Exemplo simplificado do fluxo de criptografia usando a Web Crypto API:
      </p>

      <CodeBlock
        language="typescript"
        code={`// 1. Derivação da chave mestra via PBKDF2
const masterKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(password),
  'PBKDF2',
  false,
  ['deriveBits', 'deriveKey']
);

const derivedKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: salt,           // 32 bytes aleatórios
    iterations: 100_000,
    hash: 'SHA-256',
  },
  masterKey,
  { name: 'HKDF' },
  true,
  ['deriveKey']
);

// 2. Derivação da chave do ambiente via HKDF
const envKey = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    salt: new TextEncoder().encode(envId),  // UUID do ambiente
    info: new TextEncoder().encode('criptenv-vault-v1'),
    hash: 'SHA-256',
  },
  derivedKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt', 'decrypt']
);

// 3. Criptografia com AES-256-GCM
const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv, tagLength: 128 },
  envKey,
  plaintext
);

// Resultado: ciphertext + IV (12 bytes) + auth_tag (16 bytes)`}
      />
    </div>
  );
}
