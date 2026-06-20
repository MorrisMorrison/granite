# Spec — Granite monorepo scaffold

**Date:** 2026-06-20 · **Status:** Approved (brainstorm) → implementing
**Scope:** Runnable skeleton + green CI + image pipeline. No business logic.

## Goal
A runnable, CI-green monorepo skeleton that is a clean foundation for Phase 1, plus the
build-in-public image pipeline (GHCR) so a test instance can auto-deploy.

## Layout
```
granite/
├─ package.json              # root: pnpm workspace, scripts, packageManager pin
├─ pnpm-workspace.yaml       # apps/mobile + packages/*
├─ Makefile                  # project commands
├─ .editorconfig  .nvmrc
├─ Dockerfile                # multi-stage (web build → Go build → alpine), serves the API
├─ deploy/docker-compose.yml # self-host: pulls the GHCR image, SQLite volume, env
├─ apps/
│  ├─ api/                   # Go module (own go.mod, go 1.25), outside the JS workspace
│  │  ├─ cmd/granite/main.go
│  │  └─ internal/server/{server.go, server_test.go}   # /healthz, /readyz, placeholder /
│  └─ mobile/               # SvelteKit (latest), adapter-static (SPA), placeholder + smoke test
├─ packages/
│  └─ shared/               # TS package: placeholder export + unit test
└─ .github/workflows/
   ├─ ci.yml                # build+test: api (Go) + web (pnpm)
   └─ docker-publish.yml    # build+push image → GHCR on push to main
```

## Key decisions
- **Go 1.25** (`go.mod` `go 1.25`); local builds use `GOTOOLCHAIN=auto` (portable Go 1.23 self-fetches 1.25).
- **API:** pure Go std `net/http` (1.22+ method mux) for `/healthz`, `/readyz`, and a placeholder `/`.
  No router dep yet — chi-vs-Gin deferred to Phase 1 (YAGNI).
- **Mobile:** latest **SvelteKit** via the `sv` CLI, `adapter-static` (SPA, `ssr=false`). **Capacitor
  deferred** (PWA-first; packaging step).
- **Web↔binary embedding deferred:** the scaffold image runs the Go API only (serves a placeholder
  page). Bundling the SvelteKit build into the binary is Phase 2 work.
- **pnpm via corepack**, pinned in root `packageManager`. Go app is its own module outside the workspace.
- **Tests (TDD):** `/healthz` test first → implement; trivial unit tests for `shared`; a SvelteKit smoke test.
- **CI:** `ubuntu-latest` (public repo → GitHub-hosted, never self-hosted). `ci.yml` = build+test both
  stacks on push/PR. `docker-publish.yml` = push `:latest` + `sha` tag to GHCR on `main` (deployer auto-pulls).

## Deploy (test instance)
GitHub Actions builds + pushes `ghcr.io/morrismorrison/granite:latest` on `main`; a self-hosted container
orchestrator auto-deploys the new image. Single container + a volume for the SQLite file. Env:
`GRANITE_DB_PATH`, `GRANITE_JWT_SECRET`, `GRANITE_BASE_URL`, `GRANITE_ALLOW_REGISTRATION`, `PORT`.
Deployment-host specifics (domain, orchestrator config, reverse proxy, DNS) are kept out of this public repo.

## Verification (before "done")
Local: `GOTOOLCHAIN=auto go vet ./... && go test ./...` (in apps/api); `pnpm -r build && pnpm -r test`.
Then push the branch, open a PR, and confirm the `ci` Actions run is green.

## Out of scope (Phase 1+)
DB schema, auth, real endpoints, OpenAPI→TS generator, web-in-binary embedding, Capacitor.

## Git flow
Branch `scaffold/monorepo` → PR (CI validates in the open) → merge → image publishes → deploy.
