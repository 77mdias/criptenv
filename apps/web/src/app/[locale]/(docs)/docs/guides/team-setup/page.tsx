'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function TeamSetupPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Guias', href: '/docs/guides' },
          { label: 'Configuração de Equipe', href: '/docs/guides/team-setup' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Configuração de Equipe
      </h1>
      <p className="text-muted-foreground mb-8">
        Aprenda a convidar membros, definir permissões e organizar sua equipe
        no CriptEnv para colaborar no gerenciamento de secrets de forma segura.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Convidando membros</h2>

      <Steps>
        <Step title="Acesse as configurações da equipe">
          <p className="text-muted-foreground">
            No painel do CriptEnv, navegue até{' '}
            <strong>Configurações → Equipe</strong>. Aqui você pode ver todos
            os membros atuais e gerenciar convites.
          </p>
        </Step>

        <Step title="Envie um convite">
          <p className="text-muted-foreground">
            Clique em <strong>&quot;Convidar Membro&quot;</strong> e insira o
            email da pessoa que deseja adicionar. Selecione o papel (role) que
            ela terá na equipe.
          </p>
          <CodeBlock language="text" title="Exemplo de convite">
{`Email: dev@empresa.com
Papel: Developer
Projetos: meu-app, api-gateway`}
          </CodeBlock>
        </Step>

        <Step title="Aceite o convite">
          <p className="text-muted-ground">
            O membro receberá um email com o link para aceitar o convite. Após
            aceitar, ele terá acesso aos projetos conforme as permissões
            definidas.
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Papéis e Permissões</h2>
      <p className="text-muted-foreground mb-4">
        O CriptEnv oferece 4 níveis de permissão para membros da equipe:
      </p>

      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Papel</th>
              <th className="text-left p-3 font-medium">Ver secrets</th>
              <th className="text-left p-3 font-medium">Editar secrets</th>
              <th className="text-left p-3 font-medium">Gerenciar equipe</th>
              <th className="text-left p-3 font-medium">Configurações</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3 font-medium">Owner</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Admin</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Developer</td>
              <td className="p-3">✅</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
            </tr>
            <tr className="border-t">
              <td className="p-3 font-medium">Viewer</td>
              <td className="p-3">✅</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
              <td className="p-3">❌</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Permissões por Projeto
      </h2>
      <p className="text-muted-foreground mb-4">
        Você pode configurar permissões granulares por projeto. Um membro pode
        ser Admin em um projeto e Viewer em outro.
      </p>
      <CodeBlock language="text" title="Exemplo de permissões por projeto">
{`Membro: dev@empresa.com
├── meu-app         → Developer
├── api-gateway     → Developer
└── infra-secrets   → Viewer`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Gerenciando via CLI
      </h2>
      <CodeBlock language="bash" title="Comandos de equipe no CLI">
{`# Listar membros da equipe
criptenv team list

# Convidar um novo membro
criptenv team invite dev@empresa.com --role developer --project meu-app

# Alterar papel de um membro
criptenv team update dev@empresa.com --role admin

# Remover um membro
criptenv team remove dev@empresa.com`}
      </CodeBlock>

      <Callout type="tip">
        Recomendamos seguir o princípio do menor privilegio: conceda apenas as
        permissões necessárias para cada membro realizar suas tarefas.
      </Callout>

      <Callout type="warning">
        Membros com papel <strong>Owner</strong> têm acesso total à conta,
        incluindo cobrança e exclusão de projetos. Limite este papel a
        pessoas de extrema confiança.
      </Callout>
    </div>
  );
}
