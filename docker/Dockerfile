FROM node:26-alpine AS pnpm
COPY frontend/package.json /tmp/
RUN --mount=type=cache,target=/root/.npm npm install -g "$(node -p 'require("/tmp/package.json").packageManager')"

FROM pnpm AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY frontend ./
RUN --mount=type=secret,id=env,target=/src/.env pnpm build

FROM pnpm AS iris
WORKDIR /src/iris
COPY iris/package.json iris/pnpm-lock.yaml iris/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY iris/parse.ts ./
RUN pnpm build

FROM golang:1.27-alpine AS go
WORKDIR /src/backend
COPY backend ./
COPY --from=iris /src/backend/parse.js ./
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /tira .

FROM scratch
COPY --from=go /tira /tira
COPY --from=web /src/backend/pb_public /pb_public
