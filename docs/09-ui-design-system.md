# 09 — UI design system

The app's visual language. Direction: **clean, modern, dark** — neutral grey surfaces with a single
**blue** accent used sparingly, **shadcn/ui-inspired** (hairline borders, consistent radius, quiet
buttons, crisp focus rings). Dark-only for now; light/system is a later option. Mobile-first.

## Tokens (`apps/mobile/src/app.css`)
Single source of truth as CSS custom properties.

| Group | Tokens |
|---|---|
| Surfaces | `--bg #0e1114` · `--surface #171b20` · `--elevated #1d222a` · `--border #272d36` · `--border-strong #323a45` |
| Text | `--text #e6e9ee` · `--muted #99a2ad` · `--faint #6b7480` |
| Accent | `--accent #2563eb` · `--accent-hover #1d4ed8` · `--accent-text #fff` · `--accent-subtle` |
| Semantic | `--danger` · `--success` · `--warning` (sparingly) |
| Radius | `--radius-sm 8` · `--radius-md 12` · `--radius-lg 16` · `--radius-pill` |
| Motion | `--dur-fast 120ms` · `--dur 200ms` · `--ease` |
| Layout | `--content-max 30rem` · `--tabbar-h 56px` |

Legacy aliases (`--surface-2`, `--radius`) exist only for screens not yet migrated; remove as each screen
adopts the components.

## Components (`apps/mobile/src/lib/components/ui/`)
Built **as they're first applied** to a screen (no unused code), shadcn-flavored. The current set:
`Icon` (inline SVG set) · `TabBar` (bottom nav) · `Button` (primary/secondary/outline/ghost/destructive,
sizes, block, loading, icon, href) · `ListRow` (tappable row: title/subtitle/trailing) · `Badge` ·
`PageHeader` · `EmptyState` · `BackLink` · `Sheet` (bottom sheet, e.g. the exercise picker).

## Navigation & structure
- **Bottom tab bar** — Today / Routines / History / Exercises (icons + blue active state).
- **Slim top app bar** — Granite mark + a logout/settings icon.
- **Focused flows hide the chrome** — the workout logger (`/log`) is full-screen (no tab bar / app bar) with
  its own sticky footer (Cancel · status/rest-timer · Finish).

## `data-testid` convention
Stable, semantic hooks for the upcoming UI e2e — never style/DOM-dependent. Pattern:
`nav-tab-{name}`, `btn-{action}` (e.g. `btn-start-workout`, `btn-finish-workout`, `btn-cancel-workout`),
`{entity}-row` (e.g. `routine-row`, `exercise-row`), `field-{name}` (e.g. `field-email`), `set-row`.

## Slicing
1. ✅ **Foundation** — tokens, icon set, bottom tab bar + top app bar, logger made full-screen. (this doc)
2. ✅ **Main screens** — Today, History, Exercises, Routines list — built with the components.
3. ✅ **Flows** — logger, routine form, login/register.
4. ✅ **Polish + new screens** — motion pass, routine folders, exercise create/edit, settings.

Each slice was verified offline against the `:8080` production build, with `data-testid`s in place. The
[Playwright UI e2e suite](../../apps/mobile/e2e/) (real binary + throwaway SQLite) now covers the key
flows — auth, routines + folders, logging a workout, and personal API tokens.
