# apps/mobile — SvelteKit + Capacitor app

The client: a **SvelteKit** app built static (`adapter-static`, SPA), wrapped by **Capacitor** for
iOS/Android. The same build is embedded in the Go binary to serve the web app / PWA. On-device data
lives in **SQLite**; a sync client reconciles with the server.

> Not scaffolded yet — see [`/docs`](../../docs/) for the design. Scaffolding lands in Phase 2.

See [docs/06 — Mobile app](../../docs/06-mobile-app.md) for structure, screens, plugins, and the
PWA-first strategy.
