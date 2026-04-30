# CriptEnv API

Backend FastAPI para o projeto CriptEnv.

## Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL (SQLAlchemy async)
- **Auth**: JWT-like session tokens with bcrypt
- **Server**: Uvicorn

## Setup

```bash
cd apps/api
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate no Windows
pip install -r requirements.txt

# Copiar e configurar ambiente
cp .env.example .env
# Editar .env com suas configurações

# Rodar
uvicorn main:app --reload
```

## Endpoints

### Authentication `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Criar nova conta |
| POST | `/api/auth/signin` | Login |
| POST | `/api/auth/signout` | Logout |
| GET | `/api/auth/session` | Obter usuário atual |
| GET | `/api/auth/sessions` | Listar sessões ativas |

### Projects `/api/v1/projects`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects` | Criar projeto |
| GET | `/api/v1/projects` | Listar projetos do usuário |
| GET | `/api/v1/projects/{id}` | Detalhes do projeto |
| PATCH | `/api/v1/projects/{id}` | Atualizar projeto |
| DELETE | `/api/v1/projects/{id}` | Deletar projeto |

### Environments `/api/v1/projects/{project_id}/environments`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/{project_id}/environments` | Criar ambiente |
| GET | `/api/v1/projects/{project_id}/environments` | Listar ambientes |
| GET | `/api/v1/projects/{project_id}/environments/{id}` | Detalhes |
| PATCH | `/api/v1/projects/{project_id}/environments/{id}` | Atualizar |
| DELETE | `/api/v1/projects/{project_id}/environments/{id}` | Deletar |

### Vault `/api/v1/projects/{project_id}/environments/{env_id}/vault`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/{project_id}/environments/{env_id}/vault/push` | Enviar secrets |
| GET | `/api/v1/projects/{project_id}/environments/{env_id}/vault/pull` | Baixar secrets |
| GET | `/api/v1/projects/{project_id}/environments/{env_id}/vault/version` | Versão do vault |

### Members `/api/v1/projects/{project_id}/members`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/{project_id}/members` | Adicionar membro |
| GET | `/api/v1/projects/{project_id}/members` | Listar membros |
| PATCH | `/api/v1/projects/{project_id}/members/{id}` | Atualizar role |
| DELETE | `/api/v1/projects/{project_id}/members/{id}` | Remover membro |

### Invites `/api/v1/projects/{project_id}/invites`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/{project_id}/invites` | Criar convite |
| GET | `/api/v1/projects/{project_id}/invites` | Listar convites |
| POST | `/api/v1/projects/{project_id}/invites/{id}/accept` | Aceitar convite |
| POST | `/api/v1/projects/{project_id}/invites/{id}/revoke` | Revogar convite |

### Tokens `/api/v1/projects/{project_id}/tokens`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/projects/{project_id}/tokens` | Criar token CI |
| GET | `/api/v1/projects/{project_id}/tokens` | Listar tokens |
| DELETE | `/api/v1/projects/{project_id}/tokens/{id}` | Deletar token |

### Audit `/api/v1/projects/{project_id}/audit`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/projects/{project_id}/audit` | Listar logs (paginado) |

## Autenticação

A API usa Bearer tokens no header `Authorization`:

```
Authorization: Bearer <session_token>
```

Alternativamente, o token pode ser passado via cookie `session_token`.

## Response Format

Sucesso:
```json
{
  "user": { ... },
  "session_token": "..."
}
```

Erro:
```json
{
  "detail": "Mensagem de erro"
}
```

## Development

```bash
# Testar importações
python test_import.py

# API docs (Swagger)
# http://localhost:8000/docs

# ReDoc
# http://localhost:8000/redoc
```
