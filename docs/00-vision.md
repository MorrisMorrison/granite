# 00 — Vision

## One line

A workout tracker you can **self-host** so you truly own your training data — offline-first,
open source, no social network.

## The problem

The popular gym-logging apps are genuinely good, but:

- Your training history lives on someone else's servers, behind a subscription and a privacy policy.
- They're closed source — you can't run them yourself, extend them, or fully trust what happens to
  your data.
- They tend to bundle a social network (feeds, followers, likes) that many lifters simply don't want.

## What Granite is

- **A focused logging tool.** Build routines, run a session at the gym, log sets fast, review progress.
- **Offline-first.** The gym has bad signal. The app is fully usable with zero connectivity; it syncs
  when it can. Logging a set never depends on the network.
- **Self-hostable.** One small Go service with an embedded database file. Run it on a Raspberry Pi, a
  NAS, or a small VPS. Your data stays on hardware you control.
- **Yours to read and script.** A clean REST API and an MCP server, so you (and your AI tools) can
  query and automate your own data.

## Principles

1. **Own your data.** Self-hosting is a first-class path, not an afterthought. Easy export, no lock-in.
2. **Offline is the default, not a fallback.** Every core action works with the network off.
3. **Fast logging beats features.** The in-gym path (find exercise → log set → rest timer) must be
   ruthlessly quick. Everything else is secondary.
4. **Small and boring to operate.** A self-hoster should need one container and a data file, not a
   distributed system. Minimal moving parts, minimal config.
5. **Open and inspectable.** AGPL-3.0; the API and data model are documented and stable.
6. **One UI, everywhere.** A single SvelteKit build serves mobile (via Capacitor) and the web app.

## Non-goals (explicitly out of scope)

- ❌ **Social features** — no feed, followers, likes, comments, public profiles, sharing-as-a-product.
- ❌ **Coaching marketplace / paid programs / monetization.**
- ❌ **Nutrition / macro tracking** as a core feature — out of scope here.
- ❌ **Being a generic "fitness" app** — Granite is for **resistance training / gym logging**. Running,
  cycling, GPS, etc. are not targets.
- ❌ **Multi-tenant SaaS.** Each instance is for one person or a small trusted group (e.g. a household).
  No org/team/billing machinery.

## Who it's for

- Lifters who want a clean, fast logger and care about owning their data.
- Self-hosters / homelab folks who'd rather run it themselves.
- Developers who want a hackable, open base to build on.

## How we'll know it's working

Someone can log real gym sessions with it day-to-day, offline, without friction — and the data
round-trips reliably to their self-hosted server. See [01 — MVP scope](01-mvp-scope.md).
