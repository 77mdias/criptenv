'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function MigrationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Guias', href: '/docs/guides' },
          { label: 'Migração de .env', href: '/docs/guides/migration' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">Migração de arquivos .env</h1>
      <p className="text-muted-foreground mb-8">
        Leve as variáveis de um <code>.env</code> existente para o cofre do
        CriptEnv e passe a injetá-las em memória, sem nenhum arquivo com
        valores no disco.
      </p>

      <Steps>
        <Step title="Crie o projeto e o ambiente">
          <p className="text-muted-foreground">
            A criação do projeto define a senha do cofre: guarde-a num
            gerenciador de senhas. Os comandos aceitam o ID ou o nome do projeto.
          </p>
          <CodeBlock language="bash" title="Projeto e ambiente">
{`criptenv projects create meu-app
criptenv env create development -p meu-app
criptenv use meu-app   # projeto padrão para os próximos comandos`}
          </CodeBlock>
        </Step>

        <Step title="Importe o arquivo">
          <p className="text-muted-foreground">
            Cada linha <code>CHAVE=valor</code> vira um secret cifrado no
            cliente. Chaves existentes são mantidas, a menos que você passe{' '}
            <code>--overwrite</code>.
          </p>
          <CodeBlock language="bash" title="Importar">
{`criptenv import .env -e development`}
          </CodeBlock>
        </Step>

        <Step title="Confira se nada ficou para trás">
          <p className="text-muted-foreground">
            O <code>diff</code> compara o arquivo com o cofre e sai com código 1
            se houver diferença (útil também como gate de CI).
          </p>
          <CodeBlock language="bash" title="Comparar">
{`criptenv diff .env -e development`}
          </CodeBlock>
        </Step>

        <Step title="Rode o app com os secrets em memória">
          <p className="text-muted-foreground">
            O <code>run</code> decifra os valores e executa o comando no lugar
            do próprio processo (sinais como <code>SIGTERM</code> chegam direto
            ao app). As credenciais do CriptEnv não são repassadas ao app.
          </p>
          <CodeBlock language="bash" title="Executar">
{`criptenv run -e development -- npm run dev`}
          </CodeBlock>
        </Step>

        <Step title="Apague o arquivo antigo">
          <p className="text-muted-foreground">
            Quando tudo estiver rodando pelo CriptEnv, remova o arquivo com
            valores e mantenha só um <code>.env.example</code> com os nomes.
          </p>
          <CodeBlock language="bash" title="Remover">
{`shred -u .env`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Em servidores e containers</h2>
      <p className="text-muted-foreground mb-4">
        Sem terminal, a CLI lê as credenciais do ambiente:{' '}
        <code>CRIPTENV_API_KEY</code> (API key <code>cek_...</code> com escopo{' '}
        <code>read:secrets</code>) autentica o processo sem gravar sessão em
        disco, e <code>CRIPTENV_VAULT_PASSWORD</code> abre o cofre. Se faltar
        alguma, o comando falha com erro em vez de esperar um prompt.
      </p>
      <CodeBlock language="bash" title="Container">
{`CRIPTENV_API_KEY=cek_... CRIPTENV_VAULT_PASSWORD=... \\
  criptenv run -p meu-app -e production -- node server.js`}
      </CodeBlock>

      <Callout variant="warning">
        <code>criptenv export</code> gera texto claro. Se precisar dele, prefira{' '}
        <code>--format json</code> lido direto pelo processo; no formato{' '}
        <code>env</code>, valores com espaço, <code>#</code>, aspas ou quebra de
        linha saem entre aspas.
      </Callout>
    </div>
  );
}
