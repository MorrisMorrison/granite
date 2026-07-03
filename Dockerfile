# Granite production image: one static Go binary that serves the JSON API *and*
# the embedded SvelteKit web app from a single origin, over a SQLite file.

# Stage 1 — build the SvelteKit SPA (pnpm workspace)
FROM node:24-alpine AS web-builder
RUN corepack enable
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile
COPY packages/ packages/
COPY apps/mobile/ apps/mobile/
# Build identity for the Settings "Version" line (no .git in the image).
ARG GIT_SHA=dev
ENV PUBLIC_GIT_SHA=$GIT_SHA
RUN pnpm --filter mobile build

# Stage 2 — build the Go binary with the web build embedded (CGO-free static)
FROM golang:1.26-alpine AS api-builder
WORKDIR /src
COPY apps/api/go.mod apps/api/go.sum ./
RUN go mod download
COPY apps/api/ ./
# Replace the committed placeholder with the real web build before embedding.
COPY --from=web-builder /src/apps/mobile/build/ ./internal/webui/dist/
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/granite ./cmd/granite

# Stage 3 — minimal runtime
FROM alpine:latest
RUN apk --no-cache add ca-certificates curl
WORKDIR /app
COPY --from=api-builder /out/granite ./granite

ENV PORT=8080
ENV GRANITE_DB_PATH=/data/granite.db
RUN mkdir -p /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
	CMD curl -fsS "http://localhost:${PORT}/healthz" || exit 1

CMD ["./granite"]
