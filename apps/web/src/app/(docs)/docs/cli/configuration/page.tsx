'use client';

import {
  CodeBlock,
  InlineCode,
  Callout,
  Breadcrumb,
} from '@/components/docs';

export default function CliConfigurationPage() {
  return (
    <div className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'CLI', href: '/docs/cli' },
          { label: 'Configuração', href: '/docs/cli/configuration' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-4 mb-2">Configuração do CLI</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Entenda como o CriptEnv organiza seus dados localmente, como funciona a
        senha mestra e como personalizar o comportamento via variáveis de
        ambiente.
      </p>

      {/* ── DIRECTORY STRUCTURE ─────────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Estrutura do Diretório
      </h2>
      <p className="mb-4">
        O CriptEnv armazena todos os dados locais em{' '}
        <InlineCode>~/.criptenv/</InlineCode>. Após executar{' '}
        <InlineCode>criptenv init</InlineCode>, a estrutura é a seguinte:
      </p>
      <CodeBlock
        language="text"
        code={`~/.criptenv/
└── vault.db          # Banco de dados SQLite com segredos criptografados`}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">vault.db</h3>
      <p className="mb-4">
        O coração do CriptEnv. Um banco de dados SQLite que armazena todos os
        segredos criptografados localmente com AES-256-GCM. Cada segredo é
        versionado, permitindo rotação sem perder o histórico.
      </p>
      <Callout type="warning">
        Nunca compartilhe ou faça backup do <InlineCode>vault.db</InlineCode>{' '}
        para locais inseguros. O arquivo contém dados criptografados, mas a
        segurança depende da força da sua senha mestra.
      </Callout>

      <p className="mb-4">Tabelas internas do banco:</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Tabela</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">secrets</td>
              <td className="px-4 py-3">Segredos criptografados com metadados (chave, IV, auth_tag, versão, ambiente, projeto)</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">environments</td>
              <td className="px-4 py-3">Ambientes registrados (dev, staging, production, etc.)</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">projects</td>
              <td className="px-4 py-3">Projetos e suas configurações locais</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">ci_sessions</td>
              <td className="px-4 py-3">Sessões de CI/CD criptografadas</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── MASTER PASSWORD ─────────────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">Senha Mestra</h2>
      <p className="mb-4">
        A senha mestra é usada para derivar a chave de criptografia do vault
        usando PBKDF2-HMAC-SHA256 com <strong>100.000 iterações</strong>. Ela nunca é armazenada em disco —
        é solicitada interativamente a cada operação que acessa o vault.
      </p>

      <CodeBlock
        language="bash"
        code={`# A senha é solicitada automaticamente ao usar comandos que precisam do vault
criptenv get DATABASE_URL
> Vault password:`}
      />

      <Callout type="info">
        Para automação em CI/CD, use a variável{' '}
        <InlineCode>CRIPTENV_VAULT_PASSWORD</InlineCode> para evitar prompts interativos.
      </Callout>

      {/* ── ENVIRONMENT VARIABLES ───────────────────────────── */}
      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Variáveis de Ambiente
      </h2>
      <p className="mb-4">
        O CLI suporta as seguintes variáveis de ambiente:
      </p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Variável</th>
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_API_URL</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">URL da API (padrão: https://criptenv-api.77mdevseven.tech)</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_VAULT_PASSWORD</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">Senha do vault para uso não-interativo (CI/CD)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        language="bash"
        code={`# Exemplo: usar em um script com senha via variável de ambiente
export CRIPTENV_VAULT_PASSWORD="sua-senha-segura"
export CRIPTENV_API_URL="https://criptenv-api.77mdevseven.tech"

criptenv get DATABASE_URL`}
      />

      <Callout type="warning">
        Evite definir <InlineCode>CRIPTENV_VAULT_PASSWORD</InlineCode> em
        variáveis de ambiente em servidores compartilhados. Prefira a leitura
        interativa da senha quando possível.
      </Callout>

      <Callout type="info">
        Use <InlineCode>criptenv doctor</InlineCode> para verificar a configuração
        efetiva e o estado do CLI.
      </Callout>
    </div>
  );
}
