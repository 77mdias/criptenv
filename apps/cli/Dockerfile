# CriptEnv CLI as a single self-contained binary (no Python needed at runtime).
#
# Build context: repository root.
#   docker build -f apps/cli/Dockerfile -t criptenv-cli .
#
# Use it from another image (any glibc-based image: debian/ubuntu, node:*-slim, node:bookworm…):
#   COPY --from=ghcr.io/77mdias/criptenv-cli:latest /usr/local/bin/criptenv /usr/local/bin/criptenv
# Alpine (musl) images are not supported by this binary.

FROM python:3.12-slim-bookworm AS build
WORKDIR /src
# binutils: PyInstaller needs objdump to collect shared libraries
RUN apt-get update \
 && apt-get install -y --no-install-recommends binutils \
 && rm -rf /var/lib/apt/lists/*
COPY apps/cli/pyproject.toml apps/cli/README.md apps/cli/LICENSE ./
COPY apps/cli/src ./src
RUN pip install --no-cache-dir . pyinstaller==6.11.1 \
 && pyinstaller --onefile --name criptenv --collect-submodules criptenv \
      --distpath /out src/criptenv/cli.py \
 && /out/criptenv --version

# Just the binary, for `docker build --target binary --output type=local,dest=…`.
FROM scratch AS binary
COPY --from=build /out/criptenv /criptenv

FROM debian:bookworm-slim AS runtime
COPY --from=build /out/criptenv /usr/local/bin/criptenv
# onefile binaries unpack to $TMPDIR at start; keep HOME writable for ~/.criptenv
RUN useradd --create-home --uid 10001 criptenv
USER criptenv
ENTRYPOINT ["criptenv"]
CMD ["--help"]
