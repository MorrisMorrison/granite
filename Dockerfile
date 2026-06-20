# Granite production image.
# Scaffold stage: builds the Go API only (serves /healthz, /readyz, a placeholder page).
# Bundling the SvelteKit build into the binary comes in a later phase — see docs/07-self-hosting.md.

# Stage 1 — build the Go binary (CGO-free static build)
FROM golang:1.25-alpine AS api-builder
WORKDIR /src
COPY apps/api/go.mod ./
RUN go mod download
COPY apps/api/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/granite ./cmd/granite

# Stage 2 — minimal runtime
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
