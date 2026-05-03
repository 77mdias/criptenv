#!/usr/bin/env bash
# =============================================================================
# CriptEnv Unified Deploy Script
# =============================================================================
# Usage: ./scripts/deploy.sh [web|api|cli|all]
#
# Prerequisites:
#   - Web (Cloudflare):  wrangler authenticated (npx wrangler login)
#   - API (Render):      git remote configured, render.yaml in apps/api/
#   - API (Railway):     railway CLI installed & authenticated
#   - CLI (PyPI):        twine installed, PYPI_API_TOKEN set
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[DEPLOY]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Web Deploy — Cloudflare Pages + Workers
# ---------------------------------------------------------------------------
deploy_web() {
    log "=== Deploying Web to Cloudflare ==="
    cd "$PROJECT_ROOT/apps/web"

    if ! npx wrangler whoami &>/dev/null; then
        err "Wrangler not authenticated. Run: cd apps/web && npx wrangler login"
        return 1
    fi

    log "Building web app..."
    npm run build

    log "Deploying to Cloudflare..."
    npx wrangler deploy

    ok "Web deployed successfully!"
}

# ---------------------------------------------------------------------------
# API Deploy — Render (via Blueprint) or Railway
# ---------------------------------------------------------------------------
deploy_api_render() {
    log "=== Deploying API to Render ==="
    cd "$PROJECT_ROOT/apps/api"

    if ! command -v render &>/dev/null; then
        warn "Render CLI not found. Install: curl -fsSL https://render.com/install-render-cli | bash"
        warn "Alternatively, push to GitHub and use Render's auto-deploy from blueprint."
        return 1
    fi

    render blueprint apply render.yaml
    ok "API deploy initiated on Render!"
}

deploy_api_railway() {
    log "=== Deploying API to Railway ==="
    cd "$PROJECT_ROOT/apps/api"

    if ! command -v railway &>/dev/null; then
        warn "Railway CLI not found. Install: npm install -g @railway/cli"
        warn "Then run: railway login"
        return 1
    fi

    if ! railway whoami &>/dev/null; then
        err "Railway CLI not authenticated. Run: railway login"
        return 1
    fi

    railway up
    ok "API deployed successfully to Railway!"
}

# ---------------------------------------------------------------------------
# CLI Deploy — PyPI
# ---------------------------------------------------------------------------
deploy_cli() {
    log "=== Deploying CLI to PyPI ==="
    cd "$PROJECT_ROOT/apps/cli"

    if [ -z "${PYPI_API_TOKEN:-}" ]; then
        err "PYPI_API_TOKEN not set. Get one at https://pypi.org/manage/account/token/"
        return 1
    fi

    log "Building CLI package..."
    rm -rf dist/
    python -m build

    log "Uploading to PyPI..."
    python -m twine upload dist/* --username __token__ --password "$PYPI_API_TOKEN"

    ok "CLI deployed to PyPI successfully!"
    log "Install with: pip install criptenv"
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight() {
    log "Running pre-flight checks..."

    # Web build check
    cd "$PROJECT_ROOT/apps/web"
    if ! npm run check:vinext &>/dev/null && ! npm run build &>/dev/null; then
        warn "Web build may have issues. Check manually."
    else
        ok "Web build check passed"
    fi

    # API import check
    cd "$PROJECT_ROOT/apps/api"
    if ! python -c "import main" 2>/dev/null; then
        err "API main:app cannot be imported. Fix before deploying."
        return 1
    fi
    ok "API import check passed"

    # CLI build check
    cd "$PROJECT_ROOT/apps/cli"
    if ! python -m build --version &>/dev/null; then
        err "python build module not installed. Run: pip install build twine"
        return 1
    fi
    ok "CLI build tools check passed"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    local target="${1:-all}"

    case "$target" in
        web)
            deploy_web
            ;;
        api-render)
            deploy_api_render
            ;;
        api-railway)
            deploy_api_railway
            ;;
        api)
            warn "Please specify: api-render or api-railway"
            exit 1
            ;;
        cli)
            deploy_cli
            ;;
        all)
            preflight
            deploy_web
            deploy_api_railway || deploy_api_render || true
            deploy_cli
            ;;
        *)
            echo "Usage: $0 [web|api-render|api-railway|cli|all]"
            exit 1
            ;;
    esac
}

main "$@"
