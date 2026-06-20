# Granite

> Open-source, self-hostable, **offline-first** workout tracker. Own your training data.
> A clean gym logger you run yourself — **without** a social network.

**Status:** 🟡 Planning / pre-MVP. No code yet — this repo currently holds the design and plans, and is
developed **in the open**. See [`docs/`](docs/).

---

## What it is

Granite lets you build routines, log workouts at the gym (even with no signal), and see your
progress — and lets you **run the whole thing on your own server** so your data is yours.
Mobile-first, with a web app, a public REST API, and an MCP server to follow.

It deliberately leaves out the social network (feeds, followers, likes). It's a tool for *you* and
your training, not a platform.

## Locked decisions

| Area | Choice | Rationale |
|---|---|---|
| **Backend / API** | **Go** | Single static binary → trivial, low-resource self-hosting. |
| **Mobile app** | **SvelteKit + Capacitor** | Reuse web/Svelte skills; one codebase → mobile **and** web. Native SQLite + notifications. |
| **Data model** | **Offline-first + sync** | App fully works offline; syncs to your server when online. The product's backbone. |
| **Storage** | **SQLite** (device **and** server) | Full local copy per device drives instant offline reads/stats; the server is a single SQLite file. Postgres optional later. |
| **License** | **AGPL-3.0** | Keeps the project genuinely open, even when run as a service. |
| **Auth** | **Email + password + JWT** _(proposed)_ | Simple, works offline-first & multi-user. OIDC/passkeys later. See ADR-0006. |

Full reasoning lives in the [Architecture Decision Records](docs/decisions/).

## Planned repo layout (monorepo)

```
granite/
├─ apps/
│  ├─ api/         # Go backend — REST API, sync engine, MCP server, SQLite, embeds the web build
│  └─ mobile/      # SvelteKit app (static SPA) wrapped by Capacitor → iOS/Android + web/PWA
├─ packages/
│  └─ shared/      # TS: generated API client (from OpenAPI), shared types, sync logic
├─ docs/           # all design & planning docs (you are here)
└─ deploy/         # docker-compose + self-hosting assets (later)
```

The whole backend is **one Go binary + a SQLite file**. One SvelteKit **static build** is the single
source of truth for the UI: Capacitor wraps it for the app stores, and the Go binary embeds it to serve
the self-hosted web app.

## Documentation

| Doc | What's in it |
|---|---|
| [00 — Vision](docs/00-vision.md) | What & why, principles, non-goals |
| [01 — MVP scope](docs/01-mvp-scope.md) | What's in / out of the first release |
| [02 — Architecture](docs/02-architecture.md) | Components, stack, data flow, the OpenAPI contract |
| [03 — Data model](docs/03-data-model.md) | Entities, ER diagram, schema |
| [04 — API design](docs/04-api-design.md) | REST conventions, endpoints, errors, auth, MCP |
| [05 — Sync & offline](docs/05-sync-and-offline.md) | The offline-first sync engine (the hard part) |
| [06 — Mobile app](docs/06-mobile-app.md) | SvelteKit + Capacitor structure, screens, local DB |
| [07 — Self-hosting](docs/07-self-hosting.md) | Deployment model, config, backups |
| [08 — Roadmap](docs/08-roadmap.md) | Phases & milestones |
| [Decisions (ADRs)](docs/decisions/) | The reasoning behind each locked choice |

## Contributing

Granite is built in the open. It's early (planning stage) — issues and discussion are welcome. A
contribution guide will land once the codebase is scaffolded.

## License

[AGPL-3.0](LICENSE).
