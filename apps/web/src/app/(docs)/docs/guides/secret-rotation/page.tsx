'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
} from '@/components/docs';

export default function SecretRotationPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Guias', href: '/docs/guides' },
          { label: 'Rotação de Secrets', href: '/docs/guides/secret-rotation' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Rotação de Secrets
      </h1>
      <p className="text-muted-foreground mb-8">
        A rotação regular de secrets é uma prática essencial de segurança.
        Aprenda a configurar e automatizar a rotação de variáveis de ambiente
        usando o CriptEnv.
      </p>

      <Callout type="info">
        A rotação de secrets reduz a janela de exposição caso uma credencial
        seja comprometida. Recomendamos rodar a cada 30-90 dias, dependendo
        do nível de sensibilidade.
      </Callout>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Por que rotacionar?
      </h2>
      <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-6">
        <li>Reduz o impacto de vazamentos e comprometimentos</li>
        <li>Atende a requisitos de compliance (SOC2, ISO 27001, LGPD)</li>
        <li>Remove acessos de funcionários que saíram da empresa</li>
        <li>Mantém boas práticas de higiene de segurança</li>
      </ul>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Rotação Manual
      </h2>

      <Steps>
        <Step title="Gere o novo secret">
          <p className="text-muted-foreground">
            Gere o novo secret no serviço correspondente (banco de dados, API,
            etc.). Certifique-se de que o novo secret está funcionando antes de
            atualizar no CriptEnv.
          </p>
        </Step>

        <Step title="Atualize no CriptEnv">
          <p className="text-muted-foreground">
            Use o CLI para atualizar a variável com o novo valor:
          </p>
          <CodeBlock language="bash" title="Atualizar variável">
{`# Atualizar uma variável específica
criptenv set DATABASE_URL "nova-url-do-banco" --project meu-app

# Atualizar interativamente
criptenv set --interactive --project meu-app`}
          </CodeBlock>
        </Step>

        <Step title="Sincronize com as integrações">
          <p className="text-muted-foreground">
            Se você tem integrações configuradas (Vercel, Railway, etc.), a
            sincronização automática propagará a mudança. Caso contrário,
            sincronize manualmente:
          </p>
          <CodeBlock language="bash" title="Sincronizar integrações">
{`# Sincronizar todas as integrações
criptenv sync --project meu-app

# Sincronizar uma integração específica
criptenv sync --provider vercel --project meu-app`}
          </CodeBlock>
        </Step>

        <Step title="Verifique a aplicação">
          <p className="text-muted-foreground">
            Confirme que a aplicação está funcionando corretamente com o novo
            secret. Monitore logs e métricas por alguns minutos.
          </p>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Rotação Automatizada
      </h2>
      <p className="text-muted-foreground mb-4">
        Configure a rotação automática usando o GitHub Actions ou seu sistema
        de CI/CD preferido.
      </p>

      <CodeBlock language="yaml" title="Rotação automática com GitHub Actions">
{`name: Secret Rotation

on:
  schedule:
    # Executa todo dia 1 do mês às 3h UTC
    - cron: '0 3 1 * *'
  workflow_dispatch:  # Permite execução manual

jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Gerar novo secret
        id: generate
        run: |
          NEW_SECRET=$(openssl rand -hex 32)
          echo "secret=$NEW_SECRET" >> $GITHUB_OUTPUT

      - name: Atualizar no CriptEnv
        env:
          CRIPTENV_TOKEN: \${{ secrets.CRIPTENV_TOKEN }}
        run: |
          npm install -g @criptenv/cli
          criptenv set API_KEY "\${{ steps.generate.outputs.secret }}" \\
            --project meu-app \\
            --environment production

      - name: Sincronizar com Vercel
        run: |
          criptenv sync --provider vercel --project meu-app

      - name: Notificar equipe
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {"text": "✅ API Key rotacionada com sucesso no projeto meu-app"}
        env:
          SLACK_WEBHOOK_URL: \${{ secrets.SLACK_WEBHOOK }}`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Políticas de Rotação
      </h2>
      <p className="text-muted-foreground mb-4">
        Defina políticas de rotação por tipo de secret:
      </p>

      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Tipo de Secret</th>
              <th className="text-left p-3 font-medium">Frequência Recomendada</th>
              <th className="text-left p-3 font-medium">Prioridade</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="p-3">API Keys</td>
              <td className="p-3">A cada 30 dias</td>
              <td className="p-3">Alta</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Database credentials</td>
              <td className="p-3">A cada 90 dias</td>
              <td className="p-3">Alta</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">JWT secrets</td>
              <td className="p-3">A cada 30 dias</td>
              <td className="p-3">Alta</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Third-party tokens</td>
              <td className="p-3">A cada 90 dias</td>
              <td className="p-3">Média</td>
            </tr>
            <tr className="border-t">
              <td className="p-3">Encryption keys</td>
              <td className="p-3">A cada 180 dias</td>
              <td className="p-3">Crítica</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Rotação via SDK
      </h2>
      <Tabs defaultValue="js">
        <Tab value="js" label="JavaScript">
          <CodeBlock language="typescript" title="rotate.ts">
{`import { CriptEnv } from '@criptenv/sdk';
import crypto from 'crypto';

const criptenv = new CriptEnv({
  token: process.env.CRIPTENV_TOKEN!,
  projectId: 'seu-project-id',
});

async function rotateSecret(keyName: string) {
  // Gera um novo valor
  const newValue = crypto.randomBytes(32).toString('hex');

  // Atualiza no CriptEnv
  await criptenv.set(keyName, newValue);

  console.log(\`Secret \${keyName} rotacionado com sucesso\`);
  return newValue;
}

// Rotacionar múltiplos secrets
async function rotateAll() {
  const keys = ['API_KEY', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  for (const key of keys) {
    await rotateSecret(key);
  }
  // Sincroniza com integrações
  await criptenv.sync();
}

rotateAll();`}
          </CodeBlock>
        </Tab>
        <Tab value="py" label="Python">
          <CodeBlock language="python" title="rotate.py">
{`import secrets
from criptenv import CriptEnv

env = CriptEnv(
    token=os.environ["CRIPTENV_TOKEN"],
    project_id="seu-project-id",
)

def rotate_secret(key_name: str) -> str:
    """Gera e atualiza um secret no CriptEnv."""
    new_value = secrets.token_hex(32)
    env.set(key_name, new_value)
    print(f"Secret {key_name} rotacionado com sucesso")
    return new_value

def rotate_all():
    """Rotaciona todos os secrets definidos."""
    keys = ["API_KEY", "JWT_SECRET", "ENCRYPTION_KEY"]
    for key in keys:
        rotate_secret(key)
    # Sincroniza com integrações
    env.sync()

if __name__ == "__main__":
    rotate_all()`}
          </CodeBlock>
        </Tab>
      </Tabs>

      <Callout type="warning">
        Ao rotacionar secrets em produção, certifique-se de que todos os
        serviços dependentes são atualizados simultaneamente para evitar
        downtime. Considere usar rotação com período de sobreposição (overlap)
        onde tanto o secret antigo quanto o novo são válidos por um período.
      </Callout>
    </div>
  );
}
