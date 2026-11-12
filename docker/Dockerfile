FROM node:26-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.npm --mount=type=cache,target=/pnpm-store \
    npm install -g "$(node -p 'require("./package.json").packageManager')" && \
    pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY frontend ./
RUN --mount=type=secret,id=env,target=/src/.env pnpm build

FROM golang:1.27-alpine AS go
WORKDIR /src/backend
RUN --mount=type=bind,source=backend,target=. \
    --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /tira .

FROM scratch
COPY --from=go /tira /tira
COPY --from=web /src/backend/pb_public /pb_public
