FROM node:22-trixie AS node

FROM rust:1-trixie

ARG CARGO_NEAR_VERSION=0.23.0
ARG NEAR_CLI_VERSION=0.31.1
ARG PNPM_VERSION=12.18.0
ARG SUPABASE_CLI_VERSION=3.1.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl docker-cli jq libudev-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && pnpm --version

RUN rustup target add wasm32-unknown-unknown \
    && rustup component add rustfmt clippy

COPY docker/install-release.sh /usr/local/bin/install-release
RUN install-release near/cargo-near "cargo-near-v${CARGO_NEAR_VERSION}" cargo-near cargo-near \
    && install-release near/near-cli-rs "v${NEAR_CLI_VERSION}" near-cli-rs near

COPY docker/install-supabase.sh /usr/local/bin/install-supabase
RUN install-supabase "${SUPABASE_CLI_VERSION}"

WORKDIR /workspace
