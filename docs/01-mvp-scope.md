# 01 — MVP scope

The MVP is the smallest thing that's **good enough to be someone's daily workout logger**, self-hosted.
Everything is judged against that.

## In scope (MVP)

> **Status:** the MVP cut below has **shipped** (roadmap Phases 1–5 — see [08-roadmap](08-roadmap.md)).
> The boxes are checked to reflect that; the list is kept as the record of what "MVP" meant.

### Exercises
- [x] Built-in exercise library (a seed set of common exercises with muscle groups + equipment).
- [x] Create / edit / delete **custom exercises**.
- [x] Exercise types: weight × reps, reps only, duration, (distance later).

### Routines
- [x] Create / edit / delete routines (a planned workout: ordered exercises, planned sets/targets).
- [x] Reorder exercises and sets; supersets (grouping).
- [x] Organize routines into folders.

### Logging a workout
- [x] Start a workout from a routine **or** empty/freestyle.
- [x] Log sets fast: weight, reps, set type (warmup/normal/drop/failure), mark complete.
- [x] "Previous" values shown inline (what you did last time) for quick entry.
- [x] **Rest timer** with a notification when rest ends (works with screen locked).
- [x] Edit/finish a workout; per-exercise and per-workout notes.
- [x] Full **offline** logging — no network required at any point.

### History & stats (minimal but real)
- [x] Workout history list; open a past workout.
- [x] Per-exercise history + a simple progress chart (e.g. estimated 1RM / top set over time).
- [x] Basic personal records (PRs) per exercise.

### Sync & accounts
- [x] Single-server **account** (email + password) — see ADR-0006.
- [x] **Offline-first sync**: the device-local store is the source of truth on-device (SQLite on the
      server, IndexedDB in the web/PWA client — see [ADR-0010](decisions/0010-web-local-store-indexeddb.md));
      changes sync to the server and pull down on other devices. Conflict policy = last-write-wins per record.
- [x] Data **export** (JSON) — no lock-in, on day one.

### Self-hosting
- [x] One container (Go binary serving API + embedded web app + SQLite file); config via env vars.
- [x] `docker-compose.yml` + a short setup doc.

## Out of scope for MVP (but planned — see roadmap)

> Most of these have since shipped post-MVP (MCP server, web/API polish, in-app calculators,
> bodyweight tracking, import from other trackers, advanced analytics). See the roadmap for current
> status; the list below reflects the original MVP cut.

- Web app polish (the web build exists from day one but mobile is the priority surface).
- Public REST API hardening + docs for third parties, and the **MCP server**.
- Body measurements & bodyweight tracking.
- Plate calculator, warmup-set calculator, 1RM calculator surfaced in UI.
- Apple Health / Google Fit integration; Apple Watch / Wear OS apps.
- OIDC / passkey auth; multi-user niceties (invites).
- Import from other trackers (CSV).
- Advanced analytics (volume per muscle group over time, etc.).

## Explicitly never (see Vision non-goals)

Social feed, followers, likes, marketplace, nutrition tracking, cardio/GPS, multi-tenant SaaS.

## MVP success criteria

1. A user can log a full real session **offline** on a phone, including rest timers, without friction.
2. That session syncs to the self-hosted server and appears correctly after a fresh reinstall / on a
   second device.
3. The whole thing runs from `docker-compose up` with one config file.
4. `Export` produces a complete, re-importable JSON of all the user's data.
