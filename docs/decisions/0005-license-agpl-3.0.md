# ADR-0005 — AGPL-3.0 license

**Status:** Accepted · 2026-06-20

## Context
Granite is an open-source alternative to a commercial product, with self-hosting as a headline value.
We want it to *stay* open — including when someone runs it as a network service.

## Decision
License under **AGPL-3.0**.

## Alternatives considered
- **MIT / Apache-2.0.** Maximize adoption and allow closed forks. But they permit a company to take
  Granite, run it as a closed SaaS, and contribute nothing back — the exact dynamic we're reacting to.
- **GPL-3.0.** Copyleft on distribution, but has the "SaaS loophole": running modified code as a
  network service isn't "distribution," so changes needn't be shared.

## Consequences
- ✅ Strongest guarantee the project stays open: anyone offering Granite over a network must offer
  their source, including modifications (AGPL §13).
- ✅ Aligns with the self-host / own-your-data ethos and the project's spirit.
- ➖ Some companies avoid AGPL dependencies — fine; Granite is an application, not a library meant for
  embedding, so this rarely matters.
- ➖ If we ever want a managed offering, the copyright holder(s) can still relicense/dual-license; AGPL
  doesn't bind them.
