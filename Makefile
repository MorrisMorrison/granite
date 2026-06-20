# Granite — project commands.
# Go API (apps/api) + SvelteKit client (apps/mobile) + shared TS (packages/shared, via pnpm).
.PHONY: help install build build-api build-web test test-api test-web run-api run-web \
	fmt fmt-api fmt-web lint lint-api lint-web check verify clean docker-build \
	gen-openapi gen-client

# Local Go is portable 1.23 but go.mod targets 1.25 → let the toolchain self-fetch.
export GOTOOLCHAIN ?= auto
API_DIR := apps/api
# pnpm is invoked via corepack so it works without a global install.
PNPM := corepack pnpm

help:
	@echo "Granite targets:"
	@echo "  install       install JS deps (pnpm via corepack)"
	@echo "  build         build api + web + shared"
	@echo "  test          test api + web + shared"
	@echo "  run-api       run the Go API locally (PORT=8080)"
	@echo "  run-web       run the SvelteKit dev server"
	@echo "  verify        fmt + lint + test (pre-push gate)"
	@echo "  docker-build  build the production image"

install:
	$(PNPM) install

build: build-api build-web

build-api:
	cd $(API_DIR) && go build ./...

build-web:
	$(PNPM) -r build

test: test-api test-web

test-api:
	cd $(API_DIR) && go test ./...

test-web:
	$(PNPM) -r test

run-api:
	cd $(API_DIR) && go run ./cmd/granite

run-web:
	$(PNPM) --filter mobile dev

fmt: fmt-api fmt-web

fmt-api:
	cd $(API_DIR) && go fmt ./...

fmt-web:
	$(PNPM) -r --if-present format

lint: lint-api lint-web

lint-api:
	cd $(API_DIR) && go vet ./...

lint-web:
	$(PNPM) -r --if-present lint

check:
	$(PNPM) -r --if-present check

# Regenerate the OpenAPI spec from the Go code (source of truth).
gen-openapi:
	cd $(API_DIR) && go run ./cmd/gen-openapi > openapi.yaml

# Regenerate the OpenAPI spec + the typed TS client. Run after API changes.
gen-client: gen-openapi
	$(PNPM) --filter @granite/shared exec openapi-typescript ../../apps/api/openapi.yaml -o src/api/schema.d.ts

verify: fmt lint test

clean:
	cd $(API_DIR) && go clean
	rm -rf apps/mobile/build apps/mobile/.svelte-kit packages/shared/dist

docker-build:
	docker build -t granite:latest .
