# Contributing to bluechip

Thanks for helping improve bluechip. Bug fixes, features, tests and documentation are all welcome.

## Prerequisites

- Node.js 26 (pinned in `.node-version`; packages support Node.js 22.19 and later)
- pnpm 12 (pinned in `package.json`)

## Setup

```sh
pnpm install
```

`pnpm install` installs the Git hooks (lefthook) and patches TypeScript 7 with the
[Effect language service](https://github.com/Effect-TS/tsgo), so type checking reports Effect
diagnostics. In VS Code, install the recommended extensions (dprint, Oxc, Vitest and TypeScript
Native Preview).

## Repository structure

```text
packages/       Publishable packages
apps/           Runnable applications (private)
scripts/        Repository scripts
scratchpad/     Ad hoc probes (ignored by git)
```

Keep changes within the package that owns the behaviour.

## Checks

Run everything CI runs before opening a pull request:

```sh
pnpm check
```

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm format`    | Format with dprint                              |
| `pnpm lint:fix`  | Apply oxlint's automatic fixes                  |
| `pnpm typecheck` | Type-check with the Effect language service     |
| `pnpm test`      | Run the tests once (`pnpm test:watch` to watch) |
| `pnpm build`     | Build every package                             |

The Git hooks format and lint staged files on commit, check the commit message, and run lint, type
checking and tests before a push.

## Tests

Each package keeps its tests in `test/`, written with `@effect/vitest`. Packages export their
source during development, so tests need no build.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org) with an optional kebab-case scope:

```text
feat(core): add retries to the client
fix(web): keep the search query on reload
docs: explain the release workflow
```

Pull requests are squash-merged, so the PR title becomes the commit and must follow the same format
(checked by the `PR title` workflow). Keep each pull request to one change and fill in the template.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE).
