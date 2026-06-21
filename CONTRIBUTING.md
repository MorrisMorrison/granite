# Contributing to Granite

Thanks for your interest! Granite is built in the open and contributions — issues, ideas, and PRs — are
welcome.

## Ground rules

- **Scope.** Granite is a focused, offline-first gym logger you self-host. It deliberately has **no
  social features, nutrition, or cardio/GPS** (see [Vision · non-goals](docs/00-vision.md)). Features
  that fit the in-gym logging + own-your-data mission are in scope; please open an issue to discuss
  larger changes before building.
- **Offline-first is the backbone.** Every core action must work with the network off. Sync is
  last-write-wins and well-tested — treat it carefully.
- **Public repo.** Never commit secrets, credentials, or personal infrastructure details.

## Getting started

Local setup, the repo layout, and how to build/test are in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.
The design docs live in **[docs/](docs/README.md)**.

## Workflow

1. Branch off `main` (or fork). Keep each PR **focused** on one change.
2. Use clear, conventional commit messages: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`.
3. **Add tests** for new behavior. Sync/offline logic is TDD-critical (convergence + idempotency).
4. If you change the API, run `make gen-client` to regenerate the OpenAPI spec + TS client (CI fails on drift).
5. Run `make verify` (fmt + lint + test) before pushing. All CI checks — Go, Web, Docker image, OpenAPI,
   and the Playwright e2e — must be green.
6. Open a PR against `main`, fill in the template, and link any related issue.

## Code style

Match the surrounding code (naming, comments, idioms). Formatting + linting run via `make fmt` /
`make lint` (Go: `gofmt`/`go vet`; Web: Prettier/ESLint where configured).

## Reporting bugs & proposing features

Use the **issue templates** (Bug report / Feature request). For anything security-sensitive, follow
[SECURITY.md](.github/SECURITY.md) — please don't open a public issue.

## License

By contributing, you agree that your contributions are licensed under the project's
[AGPL-3.0](LICENSE) license.
