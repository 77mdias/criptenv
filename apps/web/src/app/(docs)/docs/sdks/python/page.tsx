'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
  ParamTable,
} from '@/components/docs';

export default function PythonSDKPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'SDKs', href: '/docs/sdks' },
          { label: 'Python', href: '/docs/sdks/python' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">SDK Python</h1>
      <p className="text-muted-foreground mb-8">
        O SDK oficial do CriptEnv para Python. Compatível com Python 3.8+ e
        frameworks como Django, Flask e FastAPI. Suporte completo a type hints.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Instalação</h2>

      <CodeBlock language="bash" title="pip">
{`pip install criptenv`}
      </CodeBlock>

      <CodeBlock language="bash" title="poetry">
{`poetry add criptenv`}
      </CodeBlock>

      <CodeBlock language="bash" title="uv">
{`uv add criptenv`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Inicialização</h2>

      <Steps>
        <Step title="Importe o SDK">
          <CodeBlock language="python" title="Importação">
{`from criptenv import CriptEnv`}
          </CodeBlock>
        </Step>

        <Step title="Crie uma instância">
          <CodeBlock language="python" title="Inicialização">
{`import os

env = CriptEnv(
    token=os.environ["CRIPTENV_TOKEN"],
    project_id="seu-project-id",
    environment="production",  # opcional, padrão: "production"
)`}
          </CodeBlock>
        </Step>

        <Step title="Descriptografe suas variáveis">
          <CodeBlock language="python" title="Uso básico">
{`# Carrega todas as variáveis
variables = env.load()

print(variables["DATABASE_URL"])
print(variables["API_SECRET"])

# Ou injeta no os.environ
env.load_to_process()`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">Referência da API</h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">Construtor</h3>
      <ParamTable
        params={[
          {
            name: 'token',
            type: 'str',
            required: true,
            description: 'Token de API do CriptEnv.',
          },
          {
            name: 'project_id',
            type: 'str',
            required: true,
            description: 'ID do projeto no CriptEnv.',
          },
          {
            name: 'environment',
            type: 'str',
            required: false,
            description: 'Ambiente alvo. Padrão: "production".',
          },
          {
            name: 'cache',
            type: 'bool',
            required: false,
            description: 'Habilitar cache local. Padrão: True.',
          },
          {
            name: 'cache_ttl',
            type: 'int',
            required: false,
            description: 'Tempo de vida do cache em segundos. Padrão: 300.',
          },
        ]}
      />

      <h3 className="text-xl font-semibold mt-8 mb-3">Métodos</h3>

      <CodeBlock language="python" title="env.load()">
{`# Retorna todas as variáveis como dicionário
variables: dict[str, str] = env.load()`}
      </CodeBlock>

      <CodeBlock language="python" title="env.get(key)">
{`# Retorna uma variável específica
db_url: str = env.get("DATABASE_URL")`}
      </CodeBlock>

      <CodeBlock language="python" title="env.load_to_process()">
{`# Injeta todas as variáveis no os.environ
env.load_to_process()
# Agora os.environ["DATABASE_URL"] está disponível`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Exemplos Práticos
      </h2>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Com FastAPI
      </h3>
      <CodeBlock language="python" title="main.py">
{`import os
from fastapi import FastAPI
from criptenv import CriptEnv

# Carrega variáveis antes de criar a aplicação
criptenv = CriptEnv(
    token=os.environ["CRIPTENV_TOKEN"],
    project_id="seu-project-id",
)
criptenv.load_to_process()

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/health")
async def health():
    db_url = os.environ.get("DATABASE_URL", "não configurada")
    return {"status": "ok", "db": bool(db_url)}`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Com Django
      </h3>
      <CodeBlock language="python" title="settings.py">
{`import os
from criptenv import CriptEnv

# Carrega variáveis do CriptEnv
criptenv = CriptEnv(
    token=os.environ["CRIPTENV_TOKEN"],
    project_id="seu-project-id",
    environment=os.environ.get("DJANGO_ENV", "production"),
)
criptenv.load_to_process()

# Agora as variáveis estão disponíveis
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DATABASE_URL = os.environ["DATABASE_URL"]
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Com Flask
      </h3>
      <CodeBlock language="python" title="app.py">
{`import os
from flask import Flask
from criptenv import CriptEnv

criptenv = CriptEnv(
    token=os.environ["CRIPTENV_TOKEN"],
    project_id="seu-project-id",
)
criptenv.load_to_process()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
app.config["DATABASE_URI"] = os.environ["DATABASE_URL"]`}
      </CodeBlock>

      <h3 className="text-xl font-semibold mt-8 mb-3">
        Usando async/await
      </h3>
      <CodeBlock language="python" title="async_usage.py">
{`import asyncio
from criptenv import CriptEnv

async def main():
    env = CriptEnv(
        token="seu-token",
        project_id="seu-project-id",
    )

    # Carrega variáveis de forma assíncrona
    variables = await env.load_async()
    print(variables)

asyncio.run(main())`}
      </CodeBlock>

      <Callout type="tip">
        Recomendamos criar o arquivo <code>.env.local</code> apenas com o
        <code>CRIPTENV_TOKEN</code> e deixar todos os outros secrets no
        CriptEnv. Isso mantém seu repositório seguro.
      </Callout>
    </div>
  );
}
