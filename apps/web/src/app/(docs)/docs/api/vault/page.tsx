'use client';

import {
  Breadcrumb,
  Callout,
  CodeBlock,
  EndpointBadge,
  InlineCode,
  ParamTable,
  ResponseBlock,
} from '@/components/docs';

export default function ApiVaultPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Vault', href: '/docs/api/vault' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Vault</h1>

      <p className="text-muted-foreground mb-6">
        O Vault é o coração do CriptEnv — ele gerencia o armazenamento e a sincronização
        de segredos criptografados. Todos os dados trafegam já criptografados; o servidor
        nunca tem acesso aos valores em texto claro (arquitetura zero-knowledge).
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Fluxo Zero-Knowledge</h2>

      <p className="text-muted-foreground mb-4">
        Antes de usar os endpoints do Vault, é importante entender o fluxo de
        criptografia. Toda a criptografia e descriptografia acontece no cliente:
      </p>

      <div className="bg-muted rounded-lg p-4 font-mono text-sm mb-8">
        <p className="text-emerald-500">Push (enviar segredos):</p>
        <p className="ml-4">1. Cliente obtém a Vault password do projeto</p>
        <p className="ml-4">2. Deriva chave do vault via PBKDF2 (100k iterações)</p>
        <p className="ml-4">3. Deriva chave do ambiente via HKDF (salt = env_id)</p>
        <p className="ml-4">4. Criptografa cada segredo com AES-256-GCM</p>
        <p className="ml-4">5. Envia ciphertext + nonce + tag ao servidor</p>
        <p className="mt-4 text-emerald-500">Pull (receber segredos):</p>
        <p className="ml-4">1. Cliente recebe ciphertext + nonce + tag do servidor</p>
        <p className="ml-4">2. Deriva chaves (mesmo processo do push)</p>
        <p className="ml-4">3. Descriptografa localmente com AES-256-GCM</p>
      </div>

      <Callout type="info">
        O servidor armazena apenas dados opacos (ciphertext). Sem a Vault password
        do projeto, é impossível recuperar os valores originais — nem o CriptEnv, nem
        qualquer pessoa com acesso ao banco de dados, consegue ler os segredos.
      </Callout>

      <CodeBlock language="text">
        {`https://criptenv-api.77mdevseven.tech/v1/vault`}
      </CodeBlock>

      {/* ─── POST /vault/push ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="POST" /> Push Segredos
      </h2>

      <p className="text-muted-foreground mb-4">
        Envia segredos criptografados para um ambiente. Suporta detecção de conflitos
        via versionamento otimista — se os segredos foram alterados por outro usuário
        desde a última sincronização, a API retorna um conflito.
      </p>

      <CodeBlock language="text">
        {`POST /v1/vault/push`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'environment_id', type: 'string', required: true, description: 'ID do ambiente destino' },
          { name: 'key_id', type: 'string', required: true, description: 'ID da chave de criptografia usada' },
          { name: 'secrets', type: 'object[]', required: true, description: 'Array de segredos criptografados' },
          { name: 'secrets[].name', type: 'string', required: true, description: 'Nome do segredo (ex: DATABASE_URL)' },
          { name: 'secrets[].ciphertext', type: 'string', required: true, description: 'Valor criptografado em base64' },
          { name: 'secrets[].nonce', type: 'string', required: true, description: 'Nonce do AES-GCM em base64' },
          { name: 'secrets[].tag', type: 'string', required: true, description: 'Auth tag do AES-GCM em base64' },
          { name: 'base_version', type: 'integer', description: 'Versão base para detecção de conflitos (omitir para forçar overwrite)' },
          { name: 'strategy', type: 'string', default: 'merge', description: 'Estratégia de merge: merge (padrão) ou replace (substitui todos)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Push de segredos">
        {`curl -X POST "https://criptenv-api.77mdevseven.tech/v1/vault/push" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6" \\
  -H "Content-Type: application/json" \\
  -d '{
    "environment_id": "env_a1b2c3",
    "key_id": "key_m2n4p6q8",
    "base_version": 5,
    "strategy": "merge",
    "secrets": [
      {
        "name": "DATABASE_URL",
        "ciphertext": "YWJjZGVmZ2hpamtsbW5vcA==",
        "nonce": "MTIzNDU2Nzg5MDEy",
        "tag": "QUJDREVGR0hJSktMTU5P"
      },
      {
        "name": "REDIS_URL",
        "ciphertext": "cXJzdHV2d3h5ejAxMjM0",
        "nonce": "OTg3NjU0MzIxMDk4",
        "tag": "UEhJR0pLTE1OT1FSU1RV"
      }
    ]
  }'`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "environment_id": "env_a1b2c3",
    "version": 6,
    "secrets_pushed": 2,
    "secrets_total": 14,
    "pushed_at": "2025-01-20T14:30:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <h3 className="text-lg font-semibold mt-6 mb-3">Detecção de Conflitos</h3>

      <p className="text-muted-foreground mb-4">
        Se outro membro modificou os segredos desde a última sincronização, a API retorna
        um conflito com os detalhes:
      </p>

      <ResponseBlock status={409} statusText="Conflict">
        <CodeBlock language="json">
          {`{
  "error": {
    "code": "version_conflict",
    "message": "Os segredos foram modificados por outro usuário desde sua última sincronização.",
    "details": {
      "your_base_version": 5,
      "current_version": 7,
      "conflicting_keys": ["DATABASE_URL"],
      "modified_by": "usr_x9y8z7w6",
      "modified_at": "2025-01-20T14:25:00Z"
    }
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <Callout type="warning">
        Em caso de conflito, faça um <InlineCode>pull</InlineCode> para obter a versão
        mais recente, resolva o conflito manualmente e tente novamente o <InlineCode>push</InlineCode>.
      </Callout>

      {/* ─── GET /vault/pull ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Pull Segredos
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna todos os segredos criptografados de um ambiente. Os dados retornados
        devem ser descriptografados no cliente usando a chave derivada da Vault password.
      </p>

      <CodeBlock language="text">
        {`GET /v1/vault/pull`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'environment_id', type: 'string', required: true, description: 'ID do ambiente para puxar segredos' },
          { name: 'format', type: 'string', default: 'json', description: 'Formato de saída: json ou env' },
          { name: 'names_only', type: 'boolean', default: 'false', description: 'Se true, retorna apenas os nomes dos segredos (sem ciphertext)' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Pull de segredos">
        {`curl -X GET "https://criptenv-api.77mdevseven.tech/v1/vault/pull?environment_id=env_a1b2c3" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "environment_id": "env_a1b2c3",
    "version": 6,
    "key_id": "key_m2n4p6q8",
    "secrets": [
      {
        "name": "DATABASE_URL",
        "ciphertext": "YWJjZGVmZ2hpamtsbW5vcA==",
        "nonce": "MTIzNDU2Nzg5MDEy",
        "tag": "QUJDREVGR0hJSktMTU5P"
      },
      {
        "name": "REDIS_URL",
        "ciphertext": "cXJzdHV2d3h5ejAxMjM0",
        "nonce": "OTg3NjU0MzIxMDk4",
        "tag": "UEhJR0pLTE1OT1FSU1RV"
      }
    ],
    "pulled_at": "2025-01-20T14:35:00Z"
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <CodeBlock language="bash" title="Pull com names_only (para diff)">
        {`curl -X GET "https://criptenv-api.77mdevseven.tech/v1/vault/pull?environment_id=env_a1b2c3&names_only=true" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "environment_id": "env_a1b2c3",
    "version": 6,
    "secret_names": [
      "DATABASE_URL",
      "REDIS_URL",
      "JWT_SECRET",
      "STRIPE_API_KEY"
    ],
    "total": 14
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      {/* ─── GET /vault/version ─── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4 flex items-center gap-3">
        <EndpointBadge method="GET" /> Versão do Vault
      </h2>

      <p className="text-muted-foreground mb-4">
        Retorna a versão atual do vault de um ambiente, útil para verificar se houve
        alterações desde a última sincronização sem precisar baixar todos os segredos.
      </p>

      <CodeBlock language="text">
        {`GET /v1/vault/version`}
      </CodeBlock>

      <ParamTable
        params={[
          { name: 'environment_id', type: 'string', required: true, description: 'ID do ambiente' },
        ]}
      />

      <CodeBlock language="bash" title="Exemplo — Verificar versão">
        {`curl -X GET "https://criptenv-api.77mdevseven.tech/v1/vault/version?environment_id=env_a1b2c3" \\
  -H "Authorization: Bearer cek_a1b2c3d4e5f6"`}
      </CodeBlock>

      <ResponseBlock status={200} statusText="OK">
        <CodeBlock language="json">
          {`{
  "data": {
    "environment_id": "env_a1b2c3",
    "version": 6,
    "last_modified_at": "2025-01-20T14:30:00Z",
    "last_modified_by": "usr_a1b2c3d4",
    "secret_count": 14
  }
}`}
        </CodeBlock>
      </ResponseBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Exemplo Completo — Fluxo de Deploy</h2>

      <p className="text-muted-foreground mb-4">
        Veja como usar os endpoints do Vault em um fluxo típico de CI/CD:
      </p>

      <CodeBlock language="bash" title="Fluxo completo: verificar → pull → decrypt → deploy">
        {`# 1. Verificar versão atual (evita pull desnecessário)
VERSION=$(curl -s "https://criptenv-api.77mdevseven.tech/v1/vault/version?environment_id=env_a1b2c3" \\
  -H "Authorization: Bearer $CI_TOKEN" | jq -r '.data.version')

# 2. Pull dos segredos criptografados
curl -s "https://criptenv-api.77mdevseven.tech/v1/vault/pull?environment_id=env_a1b2c3" \\
  -H "Authorization: Bearer $CI_TOKEN" \\
  -o encrypted-secrets.json

# 3. Descriptografar localmente (usando CLI do CriptEnv)
criptenv decrypt --input encrypted-secrets.json --output .env --password "$MASTER_PASSWORD"

# 4. Deploy com segredos descriptografados
docker compose up -d`}
      </CodeBlock>
    </div>
  );
}
