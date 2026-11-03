'use client';

import {
  Breadcrumb,
  CodeBlock,
  Callout,
  Steps,
  Step,
} from '@/components/docs';
import { useTranslations } from 'next-intl';

export default function CICDSetupPage() {
  const t = useTranslations('docs.guides.cicd');
  const tRoot = useTranslations('docs');
  const strong = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Breadcrumb
        items={[
          { label: tRoot('breadcrumb.docs'), href: '/docs' },
          { label: tRoot('guides.overview.title'), href: '/docs/guides' },
          { label: 'CI/CD', href: '/docs/guides/cicd-setup' },
        ]}
      />

      <h1 className="text-3xl font-bold mt-6 mb-4">
        {t('title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('description')}
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        GitHub Actions
      </h2>
      <p className="text-muted-foreground mb-4">
        {t('github.body')}
      </p>

      <Steps>
        <Step title={t('github.step1.title')}>
          <p className="text-muted-foreground">
            {t.rich('github.step1.body', { strong })}
          </p>
          <CodeBlock language="text" title={t('github.step1.codeTitle')}>
{`Name: CRIPTENV_TOKEN            Value: <your-ci-token>
Name: CRIPTENV_VAULT_PASSWORD   Value: <project vault password>`}
          </CodeBlock>
        </Step>

        <Step title={t('github.step2.title')}>
          <CodeBlock language="yaml" title=".github/workflows/ci.yml">
{`name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Load environment variables
        uses: 77mdias/criptenv/packages/github-action@github-action-v1
        with:
          token: \${{ secrets.CRIPTENV_TOKEN }}
          vault-password: \${{ secrets.CRIPTENV_VAULT_PASSWORD }}
          project: 'your-project-id'
          environment: staging

      - name: Install dependencies
        run: npm ci

      - name: Run tests
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

# Set in Settings → CI/CD → Variables (masked):
#   CRIPTENV_API_KEY        API key with read:secrets (cek_...)
#   CRIPTENV_VAULT_PASSWORD project vault password
variables:
  CRIPTENV_PROJECT: <project-id>

build:
  stage: build
  image: nikolaik/python-nodejs:python3.12-nodejs20
  # CRIPTENV_API_KEY authenticates the CLI directly; no login step needed.
  before_script:
    - pip install criptenv
  script:
    - npm ci
    - criptenv run -e production -- npm run build`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">CircleCI</h2>
      <CodeBlock language="yaml" title=".circleci/config.yml">
{`version: 2.1

# CRIPTENV_API_KEY and CRIPTENV_VAULT_PASSWORD live in the Context/Project Settings
jobs:
  build:
    docker:
      - image: cimg/python:3.12-node
    environment:
      CRIPTENV_PROJECT: <project-id>
    steps:
      - checkout
      - run:
          name: Install CriptEnv CLI
          command: pip install criptenv
      - run:
          name: Install dependencies
          command: npm ci
      - run:
          name: Run tests with the secrets
          command: criptenv run -e staging -- npm test

workflows:
  build-and-test:
    jobs:
      - build`}
      </CodeBlock>

      <h2 className="text-2xl font-semibold mt-10 mb-4">
        {t('practices.title')}
      </h2>

      <ul className="list-disc list-inside text-muted-foreground space-y-3 mb-6">
        <li>
          {t.rich('practices.environments', { strong })}
        </li>
        <li>
          {t.rich('practices.scope', { strong })}
        </li>
        <li>
          {t.rich('practices.logs', { strong })}
        </li>
        <li>
          {t.rich('practices.rotate', { strong })}
        </li>
      </ul>

      <Callout variant="warning">
        {t('commitWarning')}
      </Callout>
    </div>
  );
}
