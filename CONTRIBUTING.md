# Contributing to bluechip

Thanks for helping improve bluechip. Bug reports, fixes, features, tests and documentation are all welcome. For a
larger change, open an issue first so we can agree on the approach.

Read [AGENTS.md](./AGENTS.md) before changing anything: it is the guide to the codebase for people and coding agents
alike (workspace map, conventions, how to add a policy, an automation trigger, a notification or a chat platform). Its
coding skills install with `npx skills add envoy1084/skills`.

## Setup

- Node.js 26 (`.node-version`) and pnpm 12 (`packageManager` in `package.json`)
- Docker, for Postgres
- [Foundry](https://getfoundry.sh), for `contracts/` and for Anvil (the local chain and the chain tests)

```sh
pnpm install
```

`pnpm install` installs the Git hooks (lefthook) and patches TypeScript 7 with the
[Effect language service](https://github.com/Effect-TS/tsgo), so type checking reports Effect diagnostics. In VS
Code, install the recommended extensions (dprint, Oxc, Vitest and TypeScript Native Preview). To run the app, see
[Getting started](./README.md#getting-started) in the README.

## Checks

Run everything CI runs before you push or open a pull request:

```sh
pnpm check
```

It runs, in order: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm circular`, `pnpm contracts:test` and
`pnpm test`. While you work, use the narrowest check that covers the change:

| Change          | Validation                                                                   |
| --------------- | ---------------------------------------------------------------------------- |
| Source or tests | `pnpm lint:fix`, `pnpm format`, `pnpm test <file>`, `pnpm typecheck`         |
| Contracts       | `forge fmt` (in `contracts/`), `pnpm contracts:test`, `pnpm contracts:build` |
| Docs only       | `pnpm format`                                                                |

The Git hooks format and lint staged files on commit, check the commit message, and run lint, type checking and tests
before a push. CI runs on pushes to `main` and by hand (`workflow_dispatch`), not on pull requests, so run
`pnpm check` yourself and say in the pull request what you ran.

A change to a screen, a flow or the API the web app calls also needs the browser suite (`pnpm test:e2e`, about 10
minutes, Docker's Postgres and Anvil only), and a new page, action or card needs a test there (coverage table in
[apps/e2e/README.md](./apps/e2e/README.md)).

## Tests

Tests live in each package's `test/` folder, split by tier (`unit/`, `integration/`, `e2e/`, with `fixtures/` and
`utils/`), each mirroring `src/`. They are Effect code, written with `@effect/vitest` (`it.effect`, `assert`). In short
(the full rules are in [AGENTS.md](./AGENTS.md#tests)):

- Test at the fastest level that proves the behaviour: a pure function before a service, a service before the API,
  the API before the browser.
- One example per test, named for what it shows. Write the input and the expected value out as literals and compare
  the whole value; never derive the expected value with the code's own logic.
- No test doubles of our own code: real implementations, test layers, MSW at the network, the devnet for the chain.
- No fixed sleeps, polling races or retries: use `TestClock`, or await a signal.
- Each test makes its own data (a new user, account or id), so the suite passes shuffled and in parallel.
- A bug found while testing: pin today's behaviour, add the right one next to it as `it.skip("… (bug: …)")`, and
  report it.

## Commits and pull requests

Commits follow [Conventional Commits](https://www.conventionalcommits.org), checked by commitlint: a type, an optional
kebab-case scope, and a lowercase subject, with the header and every body or footer line at most 100 characters.

```text
feat(agents): a daily gas limit
fix(web): keep the search query on reload
docs: explain the release workflow
```

Pull requests are squash-merged, so the PR title becomes the commit and must follow the same format (checked by the
`PR title` workflow). Keep each pull request to one change, fill in the template, and never include credentials,
tokens or private keys in the diff or in logs.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](./LICENSE).
