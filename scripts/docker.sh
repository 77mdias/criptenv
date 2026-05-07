#!/usr/bin/env bash
# ===========================================
# CriptEnv - Docker Build & Push Script
# ===========================================
# Build and push Docker images to Docker Hub.
#
# Usage:
#   ./scripts/docker.sh build          # Build all images
#   ./scripts/docker.sh build api      # Build API image only
#   ./scripts/docker.sh build web      # Build Web image only
#   ./scripts/docker.sh push           # Push all images
#   ./scripts/docker.sh push api       # Push API image only
#   ./scripts/docker.sh push web       # Push Web image only
#   ./scripts/docker.sh build-push     # Build and push all
#   ./scripts/docker.sh tag v1.0.0     # Tag images with version
#   ./scripts/docker.sh clean          # Remove local images
#
# Environment variables:
#   DOCKER_REGISTRY   - Docker Hub username/org (default: jeandias)
#   CRIPTENV_VERSION  - Image tag (default: latest)
# ===========================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="${DOCKER_REGISTRY:-77mdias}"
VERSION="${CRIPTENV_VERSION:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Image names
API_IMAGE="${REGISTRY}/criptenv-api"
WEB_IMAGE="${REGISTRY}/criptenv-web"

# -------------------------------------------
# Helper functions
# -------------------------------------------
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não encontrado. Instale o Docker primeiro."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon não está rodando. Inicie o Docker primeiro."
        exit 1
    fi
}

# -------------------------------------------
# Build functions
# -------------------------------------------
build_api() {
    log_info "Building API image: ${API_IMAGE}:${VERSION}"
    docker build \
        -f "${ROOT_DIR}/apps/api/Dockerfile" \
        -t "${API_IMAGE}:${VERSION}" \
        -t "${API_IMAGE}:latest" \
        --target runtime \
        "${ROOT_DIR}"
    log_success "API image built: ${API_IMAGE}:${VERSION}"
}

build_web() {
    log_info "Building Web image: ${WEB_IMAGE}:${VERSION}"
    docker build \
        -f "${ROOT_DIR}/apps/web/Dockerfile" \
        -t "${WEB_IMAGE}:${VERSION}" \
        -t "${WEB_IMAGE}:latest" \
        --target runner \
        --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8000}" \
        --build-arg NEXT_PUBLIC_COOKIE_NAME="${NEXT_PUBLIC_COOKIE_NAME:-criptenv_session}" \
        --build-arg NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}" \
        "${ROOT_DIR}"
    log_success "Web image built: ${WEB_IMAGE}:${VERSION}"
}

build_all() {
    build_api
    build_web
}

# -------------------------------------------
# Push functions
# -------------------------------------------
push_api() {
    log_info "Pushing API image: ${API_IMAGE}:${VERSION}"
    docker push "${API_IMAGE}:${VERSION}"
    if [ "${VERSION}" != "latest" ]; then
        docker push "${API_IMAGE}:latest"
    fi
    log_success "API image pushed"
}

push_web() {
    log_info "Pushing Web image: ${WEB_IMAGE}:${VERSION}"
    docker push "${WEB_IMAGE}:${VERSION}"
    if [ "${VERSION}" != "latest" ]; then
        docker push "${WEB_IMAGE}:latest"
    fi
    log_success "Web image pushed"
}

push_all() {
    push_api
    push_web
}

# -------------------------------------------
# Tag function
# -------------------------------------------
tag_images() {
    local tag="$1"
    log_info "Tagging images with version: ${tag}"

    docker tag "${API_IMAGE}:latest" "${API_IMAGE}:${tag}"
    docker tag "${WEB_IMAGE}:latest" "${WEB_IMAGE}:${tag}"

    log_success "Images tagged with ${tag}"
    echo ""
    echo "  ${API_IMAGE}:${tag}"
    echo "  ${WEB_IMAGE}:${tag}"
}

# -------------------------------------------
# Clean function
# -------------------------------------------
clean_images() {
    log_warn "Removing local CriptEnv images..."

    docker rmi "${API_IMAGE}:${VERSION}" 2>/dev/null || true
    docker rmi "${API_IMAGE}:latest" 2>/dev/null || true
    docker rmi "${WEB_IMAGE}:${VERSION}" 2>/dev/null || true
    docker rmi "${WEB_IMAGE}:latest" 2>/dev/null || true

    log_success "Local images removed"
}

# -------------------------------------------
# Info function
# -------------------------------------------
show_info() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}       CriptEnv Docker Configuration      ${BLUE}║${NC}"
    echo -e "${BLUE}╠══════════════════════════════════════════╣${NC}"
    echo -e "${BLUE}║${NC} Registry:  ${REGISTRY}                      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} Version:   ${VERSION}                        ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} API Image: ${API_IMAGE}:${VERSION}  ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC} Web Image: ${WEB_IMAGE}:${VERSION}  ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

# -------------------------------------------
# Main
# -------------------------------------------
main() {
    check_docker

    local command="${1:-help}"

    case "${command}" in
        build)
            show_info
            if [ -n "${2:-}" ]; then
                case "$2" in
                    api) build_api ;;
                    web) build_web ;;
                    *) log_error "Serviço desconhecido: $2"; exit 1 ;;
                esac
            else
                build_all
            fi
            ;;
        push)
            show_info
            if [ -n "${2:-}" ]; then
                case "$2" in
                    api) push_api ;;
                    web) push_web ;;
                    *) log_error "Serviço desconhecido: $2"; exit 1 ;;
                esac
            else
                push_all
            fi
            ;;
        build-push)
            show_info
            build_all
            push_all
            ;;
        tag)
            if [ -z "${2:-}" ]; then
                log_error "Uso: $0 tag <version>"
                exit 1
            fi
            tag_images "$2"
            ;;
        clean)
            clean_images
            ;;
        help|*)
            echo ""
            echo "CriptEnv Docker Manager"
            echo ""
            echo "Uso: $0 <comando> [serviço]"
            echo ""
            echo "Comandos:"
            echo "  build [api|web]    Build imagens Docker"
            echo "  push  [api|web]    Push imagens para Docker Hub"
            echo "  build-push         Build e push todas as imagens"
            echo "  tag <version>      Tag imagens com versão"
            echo "  clean              Remove imagens locais"
            echo "  help               Mostra esta ajuda"
            echo ""
            echo "Variáveis de ambiente:"
            echo "  DOCKER_REGISTRY    Usuário/org do Docker Hub (default: jeandias)"
            echo "  CRIPTENV_VERSION   Tag da imagem (default: latest)"
            echo ""
            ;;
    esac
}

main "$@"
