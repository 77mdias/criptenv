# CriptEnv GitHub Action

A GitHub Action to pull secrets from CriptEnv and inject them as environment variables in your CI/CD workflows.

## Usage

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: criptenv/action@v1
        with:
          token: ${{ secrets.CRIPTENV_TOKEN }}
          project: ${{ secrets.CRIPTENV_PROJECT_ID }}
          environment: production
```

## Inputs

| Input            | Required | Default                    | Description                                      |
| ---------------- | -------- | -------------------------- | ------------------------------------------------ |
| `token`          | Yes      | —                          | CI token from CriptEnv (starts with `ci_`)       |
| `project`        | Yes      | —                          | Project ID from CriptEnv dashboard               |
| `environment`    | No       | `production`               | Environment name (e.g., `production`, `staging`) |
| `api-url`        | No       | `https://api.criptenv.com` | CriptEnv API URL                                 |
| `prefix`         | No       | `SECRET_`                  | Prefix for environment variables                 |
| `version-output` | No       | `version`                  | Output name for secrets version                  |

## Outputs

| Output          | Description                   |
| --------------- | ----------------------------- |
| `secrets-count` | Number of secrets loaded      |
| `version`       | Version of the secrets loaded |

## Example Workflow

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get secrets
        uses: criptenv/action@v1
        id: criptenv
        with:
          token: ${{ secrets.CRIPTENV_TOKEN }}
          project: ${{ secrets.CRIPTENV_PROJECT_ID }}
          environment: production
          prefix: ""

      - name: Deploy
        env:
          DATABASE_URL: ${{ env.SECRET_DATABASE_URL }}
        run: |
          echo "Deploying with secrets version ${{ steps.criptenv.outputs.version }}"
          ./deploy.sh
```

## Getting a CI Token

1. Go to your CriptEnv dashboard
2. Navigate to your project settings
3. Go to "CI Tokens" section
4. Click "Create Token"
5. Copy the token (shown only once)

## Security

- Secrets are injected as environment variables which are automatically masked in logs
- CI tokens are hashed before storage
- Sessions expire after 1 hour
- The action requires `contents: read` permission only

## License

MIT
