# ADR-0007 — huma for the API layer (code-first OpenAPI)

**Status:** Accepted · 2026-06-21

## Context
The architecture calls for **OpenAPI as the contract** that generates the TypeScript client (mobile +
web), with no drift between code and spec. Slice 1 used plain `chi` handlers + the `apperr` taxonomy.

## Decision
Adopt **huma (v2)**, mounted on the existing `chi` router via the `humachi` adapter. API endpoints are
huma **operations** (typed input/output structs) — huma generates **OpenAPI 3.1** and request validation
from the Go code, so the spec can't drift. Health/root and the middleware stack stay plain chi. The
`apperr` taxonomy maps to huma error responses. The TS client is generated from huma's OpenAPI via
**openapi-typescript** (+ openapi-fetch).

## Alternatives considered
- **Hand-written OpenAPI + openapi-typescript.** Keeps the plain chi handlers, but the spec is
  maintained by hand → drift risk, which defeats the "source of truth" goal.
- **ogen (spec-first).** Authoritative spec and generated Go, but the heaviest restructure of routing
  and handlers.

## Consequences
- ✅ Spec always matches code; free request validation + interactive docs.
- ✅ One OpenAPI document covers the whole API → one generated TS client.
- ➖ One framework dependency; slice-1 auth/`me` handlers are converted to huma operations.
- ➖ Errors flow through huma's model — `apperr` is mapped to huma errors via a small adapter.
