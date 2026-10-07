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
        Entenda como o CriptEnv CLI funciona como terminal remoto, quais dados
        ficam localmente e como usar variáveis de ambiente em automações.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Terminal Remoto
      </h2>
      <p className="mb-4">
        Os comandos principais operam diretamente no vault remoto do projeto.
        O CLI baixa blobs criptografados, descriptografa em memória quando
        necessário, recriptografa no próprio processo e envia apenas ciphertext
        para a API.
      </p>
      <Callout type="info">
        O backend nunca recebe secrets em texto claro e a Vault password do
        projeto nunca é enviada ao servidor.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Estrutura Local
      </h2>
      <p className="mb-4">
        O diretório <InlineCode>~/.criptenv/</InlineCode> guarda apenas
        metadata leve e credenciais locais de sessão:
      </p>
      <CodeBlock
        language="text"
        code={`~/.criptenv/
├── auth.key          # chave local para criptografar tokens de sessão
└── vault.db          # SQLite com sessão, projeto atual e metadata`}
      />

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] my-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--background-muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 text-left font-semibold">Arquivo</th>
              <th className="px-4 py-3 text-left font-semibold">Descrição</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">auth.key</td>
              <td className="px-4 py-3">Chave local usada para proteger tokens de sessão da CLI e do CI.</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">vault.db</td>
              <td className="px-4 py-3">Banco SQLite com sessão, projeto atual, cache de metadata e tabelas de compatibilidade.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout type="warning">
        O fluxo normal do CLI não grava uma cópia local dos secrets. Backups de
        <InlineCode>~/.criptenv/</InlineCode> ainda devem ser protegidos porque
        contêm credenciais de sessão.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Vault Password
      </h2>
      <p className="mb-4">
        A Vault password pertence ao projeto. Ela deriva as chaves de
        criptografia client-side e é solicitada apenas quando um comando precisa
        descriptografar ou alterar secrets.
      </p>

      <CodeBlock
        language="bash"
        code={`criptenv get DATABASE_URL -p <project-id>
> Vault password:`}
      />

      <Callout type="info">
        Para automação, defina <InlineCode>CRIPTENV_VAULT_PASSWORD</InlineCode>.
        O CLI usa essa variável no lugar do prompt interativo.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Variáveis de Ambiente
      </h2>
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
              <td className="px-4 py-3">URL da API. Padrão: https://criptenv-api.77mdevseven.tech</td>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--background-subtle)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_PROJECT</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">Projeto padrão para comandos que aceitam <InlineCode>--project</InlineCode>.</td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-3 font-mono text-emerald-500">CRIPTENV_VAULT_PASSWORD</td>
              <td className="px-4 py-3">string</td>
              <td className="px-4 py-3">Vault password do projeto para uso não interativo.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <CodeBlock
        language="bash"
        code={`export CRIPTENV_PROJECT="<project-id>"
export CRIPTENV_VAULT_PASSWORD="project-vault-password"

criptenv export -e production -o .env.production`}
      />

      <Callout type="warning">
        Evite expor <InlineCode>CRIPTENV_VAULT_PASSWORD</InlineCode> em logs,
        shells compartilhados ou históricos persistentes. Em CI, use o mecanismo
        de secrets do provedor.
      </Callout>

      <Callout type="info">
        Use <InlineCode>criptenv doctor</InlineCode> para verificar sessão,
        projeto atual, metadata local e conectividade com a API.
      </Callout>
    </div>
  );
}
