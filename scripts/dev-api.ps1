# Local dev: run the Granite API with open registration + CORS for the Vite dev
# origin, and a throwaway SQLite DB. Needs Go on your PATH. LOCAL USE ONLY.
$ErrorActionPreference = "Stop"
$env:GRANITE_JWT_SECRET = "granite-local-dev-secret-0123456789abcdef"
$env:GRANITE_ALLOW_REGISTRATION = "true"
$env:GRANITE_BASE_URL = "http://localhost:5173"
$env:GRANITE_DB_PATH = "dev.db"
$env:GRANITE_ENV = "dev"   # auto-seeds the demo account (demo@granite.local / demodata)
$env:PORT = "8080"
$env:GOTOOLCHAIN = "auto"
Set-Location (Join-Path $PSScriptRoot "..\apps\api")
go run ./cmd/granite
