FROM node:26-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.npm npm install -g "$(node -p 'require("./package.json").packageManager')"
RUN --mount=type=cache,target=/pnpm-store pnpm install --frozen-lockfile --store-dir /pnpm-store
COPY frontend ./
RUN --mount=type=secret,id=env,target=/src/.env pnpm build

FROM alpine AS pb
ARG PB_VERSION=0.40.6 TARGETARCH
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip pocketbase -d /

FROM scratch
COPY --from=pb /pocketbase /pocketbase
COPY --from=web /src/backend/pb_public /pb_public
