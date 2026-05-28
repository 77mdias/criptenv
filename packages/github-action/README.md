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
| `api-url`        | No       | `https://criptenv-api.77mdevseven.tech/api/v1` | CriptEnv API URL, including the API version prefix |
| `prefix`         | No       | `SECRET_`                  | Prefix for environment variables                 |
| `version-output` | No       | `version`                  | Output name for secrets version                  |
| `vault-password` | No       | —                          | Project vault password. When provided, secrets are exported as plaintext. Without it, ciphertext is exported for backwards compatibility. |

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
    permissions:
      contents: read
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
          vault-password: ${{ secrets.CRIPTENV_VAULT_PASSWORD }}
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

Store these values as GitHub repository or organization secrets:

- `CRIPTENV_TOKEN`: the one-time CI token value that starts with `ci_`
- `CRIPTENV_PROJECT_ID`: the CriptEnv project ID
- `CRIPTENV_VAULT_PASSWORD`: optional project vault password for plaintext export

## Zero-Knowledge Limitation

CriptEnv stores secrets as encrypted vault blobs. If `vault-password` is not provided, this action preserves the legacy behavior and exports the encrypted blob payload returned by the API. If `vault-password` is provided, decryption happens locally inside the GitHub Actions runner using PBKDF2/HKDF/AES-256-GCM; the API still never receives plaintext secrets or the vault password.

## Publishing Checklist

1. Commit `action.yml`, `dist/index.js`, README, and license files.
2. Create a release tag, for example `v1.0.0`.
3. Move or create the major tag, for example `v1`, pointing at the same commit.
4. Complete the GitHub Marketplace publishing form from the repository's Releases page.

## Security

- Secrets are injected as environment variables which are automatically masked in logs
- CI tokens are hashed before storage
- Sessions expire after 1 hour
- Plaintext export requires `vault-password`; store it as a GitHub Secret
- The action requires `contents: read` permission only

## License

MIT
