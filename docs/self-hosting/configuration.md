# Configuration

Granite is configured with environment variables. With Docker Compose, you set them in the `.env` file next to `docker-compose.yml`, then apply changes with `docker compose up -d`.

## Required

| Variable | Description |
|---|---|
| `GRANITE_JWT_SECRET` | Signs login tokens. Must be at least 32 bytes, or the server won't start. Generate one with `openssl rand -base64 48`. |

## Server

| Variable | Default | Description |
|---|---|---|
| `GRANITE_BASE_URL` | `http://localhost:8080` | The public address of your instance, with no trailing slash. |
| `GRANITE_PORT` | `8080` | The host port. Compose only. |
| `GRANITE_DB_PATH` | `/data/granite.db` in the image | Where the SQLite file lives. Keep it on a volume. |
| `GRANITE_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error`. |

## Accounts

| Variable | Default | Description |
|---|---|---|
| `GRANITE_ALLOW_REGISTRATION` | `false` | Set to `true` to let anyone with the address create an account. |

With registration off, the first account can still be created, so a personal instance needs no extra setup.

## Reverse proxy and rate limits

| Variable | Default | Description |
|---|---|---|
| `GRANITE_TRUSTED_PROXY` | `false` | Set to `true` behind a [reverse proxy](reverse-proxy.md) that overwrites the client IP headers. |
| `GRANITE_AUTH_RATE_LIMIT` | `30` | Requests per minute, per IP, on login and registration. |
| `GRANITE_API_RATE_LIMIT` | `600` | Requests per minute, per IP, on the rest of the API. |

The rate limit defaults suit normal use, so you shouldn't need to change them. The two rate limit variables aren't passed through by the default Compose file. To change one, add it under `environment:` in `docker-compose.yml`.

## Development only

| Variable | Default | Description |
|---|---|---|
| `GRANITE_ENV` | `prod` | `dev` creates a demo account with a known password. Never use it on a real instance. |
