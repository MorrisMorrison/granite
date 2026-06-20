# ADR-0002 — Mobile app = SvelteKit + Capacitor

**Status:** Accepted · 2026-06-20

## Context
Mobile-first product, web version wanted next, built by a developer comfortable with **web/Svelte** but
not with native mobile (or React/Dart). The app itself is forms, lists, a timer, and charts — not
graphically demanding. The biggest project risk is a steep mobile learning curve stalling momentum.

## Decision
Build one **SvelteKit** app (static SPA) and wrap it with **Capacitor** for iOS/Android. The same
static build is embedded in the Go binary to serve the web app. Ship a **PWA first**, add the native
wrappers later.

## Alternatives considered
- **React Native (Expo).** Most "native" feel, best Health/Watch path. But requires learning React +
  RN, and the web version becomes a partly-separate build (RN-Web is compromised). Bigger investment
  for a non-mobile, non-React dev.
- **Flutter.** Excellent native UX, but Dart is a whole new ecosystem with no synergy with web skills,
  and Flutter-Web is heavy. Highest learning cost.
- **Pure PWA (no Capacitor).** Cheapest, but iOS PWA limits (background, notifications, storage
  eviction) and no app-store presence make it weak as the *final* form. We keep PWA as the **first**
  step, not the end state.

## Consequences
- ✅ Stays in familiar web/Svelte territory; tiny mobile-specific surface (a few plugins).
- ✅ **One codebase → mobile + web.** No duplicate frontends.
- ✅ Offline-first is natural: native SQLite + the same data layer on web.
- ✅ PWA-first → a real, installable, on-phone testable app with zero app-store friction early.
- ➖ Webview is marginally less "native" in gestures/animation — negligible for this app class.
- ➖ **Apple Watch / Wear OS / deep HealthKit are harder** than in RN/Flutter → deliberately post-MVP.
  If those ever become core, the Go API + data model are reusable and only the client would change.
