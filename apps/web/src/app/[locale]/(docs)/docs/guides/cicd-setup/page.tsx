'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';

export default function CICDSetupPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: 'Docs', href: '/docs' },
          { label: 'Guias', href: '/docs/guides' },
          { label: 'CI/CD', href: '/docs/guides/cicd-setup' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        Configuração de CI/CD
      </h1>
      <p className="text-muted-foreground mb-8">
        Configure o CriptEnv no seu pipeline de CI/CD para carregar secrets de
        forma segura durante build, testes e deploy. Suporte para GitHub
        Actions e outras plataformas via CLI.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        GitHub Actions
      </h2>
      <p className="text-muted-foreground mb-4">
        A forma mais simples de integrar. Use a Action oficial do CriptEnv:
      </p>

      <Steps>
        <Step title="Adicione o token como secret">
          <p className="text-muted-foreground">
            No repositório GitHub, vá em{' '}
            <strong>Settings → Secrets and variables → Actions</strong> e
            adicione o token do CriptEnv como um novo secret.
          </p>
          <CodeBlock language="text" title="Configuração do secret">
{`Nome: CRIPTENV_TOKEN
Valor: <seu-token-de-ci>`}
          </CodeBlock>
        </Step>

        <Step title="Configure o workflow">
          <CodeBlock language="yaml" title=".github/workflows/ci.yml">
{`name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Carregar variáveis de ambiente
        uses: criptenv/action@v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          project: 'seu-project-id'
          environment: staging

      - name: Instalar dependências
        run: npm ci

      - name: Executar testes
        run: npm test`}
          </CodeBlock>
        </Step>
      </Steps>

      <h2 className="text-2xl font-semibold mt-10 mb-4">GitLab CI</h2>

      <CodeBlock language="yaml" title=".gitlab-ci.yml">
{`stages:
  - build
  - test
  - deploy

variables:
  CRIPTENV_TOKEN: $CRIPTENV_TOKEN_SECRET

build:
  stage: build
  image: python:3.12
  before_script:
    - pip install criptenv
    - criptenv ci login --token $CRIPTENV_TOKEN
  script:
    - criptenv ci deploy -p <project-id> -e production
    - npm ci
    - npm run build`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">CircleCI</h2>
      <CodeBlock language="yaml" title=".circleci/config.yml">
{`version: 2.1

jobs:
  build:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Instalar CriptEnv CLI
          command: |
            pip install criptenv
            criptenv ci login --token $CRIPTENV_TOKEN
      - run:
          name: Deploy secrets
          command: criptenv ci deploy -p <project-id>
      - run:
          name: Instalar dependências
          command: npm ci
      - run:
          name: Executar testes
          command: npm test

workflows:
  build-and-test:
    jobs:
      - build`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        Boas Práticas para CI/CD
      </h2>

      <ul className="list-disc list-inside text-muted-foreground space-y-3 mb-6">
        <li>
          <strong>Use ambientes separados:</strong> configure secrets diferentes
          para staging e production
        </li>
        <li>
          <strong>Token com escopo mínimo:</strong> crie tokens específicos
          para CI/CD com apenas permissão de leitura
        </li>
        <li>
          <strong>Nunca logue secrets:</strong> evite imprimir variáveis de
          ambiente nos logs do CI
        </li>
        <li>
          <strong>Rotacione tokens:</strong> atualize os tokens do CriptEnv
          periodicamente
        </li>
      </ul>

      <Callout type="warning">
        Nunca commite tokens do CriptEnv diretamente no código. Use sempre
        variáveis de ambiente ou secrets nativos da plataforma de CI/CD.
      </Callout>
    </div>
  );
}
