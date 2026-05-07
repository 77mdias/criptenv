# Docker - CriptEnv

> Guia completo de containers Docker para desenvolvimento e produção.

---

## Visão Geral

O CriptEnv usa Docker para gerenciar os serviços de desenvolvimento e criar imagens para deploy.

| Serviço | Tecnologia | Porta | Imagem | Tamanho |
|---------|-----------|-------|--------|---------|
| API | FastAPI (Python 3.11) | 8000 | `77mdias/criptenv-api` | ~280MB |
| Web | Vinext (Vite + React, Node 22) | 3000 | `77mdias/criptenv-web` | ~2GB |
| Database | Supabase (serverless) | — | Não precisa container | — |

> **Nota**: A imagem Web é maior devido às dependências 3D (Three.js, React Three Fiber, GSAP).

### Arquitetura de Arquivos

```
criptenv/
├── docker-compose.yml          # Produção (build de imagens)
├── docker-compose.dev.yml      # Desenvolvimento (hot-reload)
├── .dockerignore               # Exclusões do build context
├── apps/
│   ├── api/
│   │   └── Dockerfile          # Multi-stage: deps → runtime
│   └── web/
│       └── Dockerfile          # Multi-stage: deps → builder → runner
├── scripts/
│   └── docker.sh               # Script de build/push
└── deploy/
    └── vps/
        └── docker-compose.yml  # Deploy VPS (NÃO MODIFICAR)
```

---

## Desenvolvimento (Hot-Reload)

O `docker-compose.dev.yml` monta o código-fonte como volume, permitindo hot-reload durante o desenvolvimento.

### Iniciar

```bash
# Subir todos os serviços
make docker-dev

# Ou diretamente:
docker compose -f docker-compose.dev.yml up --build

# Em background:
docker compose -f docker-compose.dev.yml up -d --build
```

### Parar

```bash
make docker-dev-down

# Ou:
docker compose -f docker-compose.dev.yml down
```

### Logs

```bash
make docker-dev-logs

# Logs de um serviço específico:
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f web
```

### Acessos

| Serviço | URL |
|---------|-----|
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Web | http://localhost:3000 |

### Variáveis de Ambiente (Desenvolvimento)

O `docker-compose.dev.yml` carrega automaticamente os arquivos `.env` existentes:

- **API**: `apps/api/.env`
- **Web**: `apps/web/.env.local`

O banco de dados é Supabase (serverless), não precisa de container.

---

## Produção (Build de Imagens)

O `docker-compose.yml` na raiz é usado para build e push de imagens para Docker Hub.

### Build

```bash
# Build todas as imagens
make docker-build

# Build individual
make docker-build-api
make docker-build-web

# Com versão específica
make docker-build CRIPTENV_VERSION=1.0.0
```

### Push para Docker Hub

```bash
# Login no Docker Hub
docker login

# Push todas as imagens
make docker-push

# Push individual
make docker-push-api
make docker-push-web

# Com versão
make docker-push CRIPTENV_VERSION=1.0.0
```

### Build + Push (tudo)

```bash
make docker-build-push
make docker-build-push CRIPTENV_VERSION=1.0.0
```

### Executar Produção Localmente

```bash
make docker-up
make docker-down
```

### Variáveis de Ambiente (Produção)

| Variável | Default | Descrição |
|----------|---------|-----------|
| `DOCKER_REGISTRY` | `77mdias` | Usuário/org do Docker Hub |
| `CRIPTENV_VERSION` | `latest` | Tag da imagem |
| `API_PORT` | `8000` | Porta da API no host |
| `WEB_PORT` | `3000` | Porta do Web no host |
| `WEB_CONCURRENCY` | `3` | Workers do gunicorn |

---

## Script Docker (`scripts/docker.sh`)

Script auxiliar para build e push de imagens.

```bash
# Build
./scripts/docker.sh build          # Todas
./scripts/docker.sh build api      # API apenas
./scripts/docker.sh build web      # Web apenas

# Push
./scripts/docker.sh push           # Todas
./scripts/docker.sh push api       # API apenas

# Build + Push
./scripts/docker.sh build-push

# Tag com versão
./scripts/docker.sh tag v1.0.0

# Limpar imagens locais
./scripts/docker.sh clean
```

---

## Comandos Makefile

```bash
# Desenvolvimento
make docker-dev           # Subir dev com hot-reload
make docker-dev-down      # Parar dev
make docker-dev-logs      # Ver logs
make docker-dev-build     # Apenas build (sem start)

# Produção - Imagens
make docker-build         # Build imagens
make docker-build-api     # Build API
make docker-build-web     # Build Web
make docker-push          # Push para Hub
make docker-push-api      # Push API
make docker-push-web      # Push Web
make docker-build-push    # Build + Push

# Produção - Containers
make docker-up            # Subir containers
make docker-down          # Parar containers
make docker-clean         # Remover imagens locais
```

---

## Dockerfiles

### API (`apps/api/Dockerfile`)

Multi-stage build com dois targets:

- **`deps`**: Instala dependências Python
- **`runtime`**: Imagem final de produção (usa gunicorn)

```bash
# Build manual
docker build -f apps/api/Dockerfile -t criptenv-api --target runtime .

# Run
docker run -p 8000:8000 --env-file apps/api/.env criptenv-api
```

### Web (`apps/web/Dockerfile`)

Multi-stage build com três stages (Node 22 Alpine):

- **`deps`**: Instala node_modules
- **`builder`**: Build da aplicação Vinext
- **`runner`**: Imagem final de produção com limpeza de caches

> **Requisito**: Vinext requer Node.js >= 22 (usa `fs/promises.glob`).

```bash
# Build manual
docker build -f apps/web/Dockerfile -t criptenv-web --target runner .

# Run
docker run -p 3000:3000 criptenv-web
```

---

## Troubleshooting

### API não conecta ao Supabase

Verifique se o `DATABASE_URL` em `apps/api/.env` está correto e acessível de dentro do container.

```bash
# Testar conectividade
docker compose -f docker-compose.dev.yml exec api curl -s https://your-project.supabase.co
```

### Web não encontra a API

O `docker-compose.dev.yml` configura o proxy do Vite para `http://localhost:8000`. Se a API estiver em outro host, ajuste `NEXT_PUBLIC_API_URL` em `apps/web/.env.local`.

### Cache do Docker

```bash
# Limpar cache de build
docker builder prune

# Limpar tudo (cuidado!)
docker system prune -a
```

### Permissões de volume

Se houver problemas de permissão com volumes montados:

```bash
# Corrigir ownership
sudo chown -R $(id -u):$(id -g) apps/api apps/web
```

---

## Não Modificar

O arquivo `deploy/vps/docker-compose.yml` é o compose de produção para VPS com nginx-proxy-manager, Redis e DuckDNS. **Não deve ser alterado** neste contexto.

---

**Última atualização**: 2026-05-07
