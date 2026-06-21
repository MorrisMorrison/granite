#!/usr/bin/env bash
# Local dev: run the Granite API with open registration + CORS for the Vite dev
# origin, and a throwaway SQLite DB. Needs Go on your PATH. LOCAL USE ONLY.
set -euo pipefail
export GRANITE_JWT_SECRET="granite-local-dev-secret-0123456789abcdef"
export GRANITE_ALLOW_REGISTRATION=true
export GRANITE_BASE_URL="http://localhost:5173"
export GRANITE_DB_PATH="dev.db"
export PORT=8080
export GOTOOLCHAIN=auto
cd "$(dirname "$0")/../apps/api"
exec go run ./cmd/granite
