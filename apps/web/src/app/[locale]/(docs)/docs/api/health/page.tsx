'use client';

import {
  Breadcrumb,
  CodeBlock,
  EndpointBadge,
  ResponseBlock,
  Callout,
} from '@/components/docs';

export default function HealthPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'API Reference', href: '/docs/api' },
          { label: 'Health' },
        ]}
      />

      <h1 className="text-4xl font-bold mt-6 mb-2">Health Checks</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Endpoints públicos para verificar a disponibilidade da API. Úteis para
        monitoramento, load balancers e verificações de integração.
      </p>

      <Callout type="info">
        Estes endpoints não requerem autenticação e retornam rapidamente para
        uso em health checks de infraestrutura.
      </Callout>

      {/* GET /health */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Status da API
        </h2>
        <p className="text-muted-foreground mb-4">
          Retorna o status geral da API e a versão atual. Este endpoint sempre
          responde 200 se o servidor estiver ativo.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/health`}
        />

        <ResponseBlock
          code={`{
  "status": "ok",
  "version": "1.4.2",
  "uptime": "72h14m30s"
}`}
        />
      </section>

      {/* GET /health/ready */}
      <section className="mt-10">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <EndpointBadge method="get" /> Prontidão
        </h2>
        <p className="text-muted-foreground mb-4">
          Verifica se a API está pronta para receber requisições, incluindo a
          conectividade com o banco de dados. Retorna 200 se tudo estiver
          operacional, ou 503 se houver problemas.
        </p>

        <CodeBlock
          language="bash"
          code={`curl https://criptenv-api.77mdevseven.tech/health/ready`}
        />

        <ResponseBlock
          code={`{
  "status": "ready",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}`}
        />
      </section>
    </div>
  );
}
