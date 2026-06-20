# ADR-0001 — Backend in Go

**Status:** Accepted · 2026-06-20

## Context
We need an API/sync backend for a self-hostable product. Top priorities: dead-simple to operate for
self-hosters, low resource use, and a small, fast, statically-compiled stack.

## Decision
Write the backend in **Go**.

## Alternatives considered
- **TypeScript (Node).** Tempting because the frontend is TS — one language, shared types for free.
  But it's heavier to self-host (runtime + node_modules), and we recover most of the type-safety
  benefit via OpenAPI codegen (see [02 — Architecture](../02-architecture.md)).
- **Python.** Best if we wanted heavy stats/ML server-side — but the stats run on the *client* (full
  local SQLite), and Python is the heaviest to self-host.

## Consequences
- ✅ Compiles to a **single static binary**; can **embed the web build** and use an embedded SQLite file
  → one tiny container, no separate database process.
- ✅ Low memory/CPU → runs on a Raspberry Pi / small VPS. Great fit for "own your data."
- ✅ A pure-Go SQLite driver keeps the binary CGO-free and easy to cross-compile.
- ➖ No automatic shared types with the TS client → mitigated by an **OpenAPI spec → generated TS client**.
- ➖ More boilerplate than a batteries-included framework; accepted.
