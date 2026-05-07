# ===========================================
# CriptEnv Web - Dockerfile (Vinext / Vite)
# ===========================================
# Multi-stage build for production images.
# Build context: repository root (.)
#
# Build:
#   docker build -f apps/web/Dockerfile -t criptenv-web --target runner .
#
# Development uses docker-compose.dev.yml with source mounts.

# ---------- Stage 1: Dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files from apps/web/
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci && npm cache clean --force

# ---------- Stage 2: Build ----------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy source code from apps/web/
COPY apps/web/ .

# Build-time env vars (injected via docker build --build-arg)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_COOKIE_NAME=criptenv_session
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_COOKIE_NAME=$NEXT_PUBLIC_COOKIE_NAME
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# ---------- Stage 3: Runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy node_modules (vinext is needed for `npm start` / `vinext start`)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Clean up unnecessary files to reduce image size
RUN rm -rf node_modules/.cache \
    && find node_modules -name "*.md" -delete 2>/dev/null || true \
    && find node_modules -name "*.txt" -delete 2>/dev/null || true \
    && find node_modules -name "CHANGELOG*" -delete 2>/dev/null || true \
    && find node_modules -name "LICENSE*" -delete 2>/dev/null || true \
    && find node_modules -name ".github" -type d -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -name "test" -type d -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true \
    && find node_modules -name "__tests__" -type d -exec rm -rf {} + 2>/dev/null || true

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["npm", "start"]
