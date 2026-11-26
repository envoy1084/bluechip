# @bluechip/e2e

bluechip's browser end-to-end suite: the web app in Chromium (Playwright) against the real server and its own devnet.
Every Face ID step runs on a virtual WebAuthn authenticator (Chromium's CDP `WebAuthn` domain), so passkeys live in
the test's browser, never in a real profile. Not part of `pnpm check`: it takes about 10 minutes.

## Run it

```sh
pnpm test:e2e                                  # starts its own stack, runs everything, stops the stack
pnpm test:e2e specs/auth.spec.ts               # one file
pnpm --filter @bluechip/e2e stack              # keep a stack up while writing tests (Ctrl+C stops it), then:
BLUECHIP_E2E_STACK=running pnpm test:e2e specs/agents-new.spec.ts --project app
BLUECHIP_E2E_LIVE=1 pnpm test:e2e specs/assistant-live.spec.ts   # one test on Anthropic's real models (costs cents)
```

Needs Docker's Postgres (`docker compose up -d postgres`, started for you), Anvil on the `PATH` and Playwright's
Chromium (shared with Vitest's browser mode). No RPC, no network: stock logos are served locally.

Results, traces and the HTML report of each run go to `.data/runs/<time>/`; the stack's logs to `.data/*.log`.

## The stack (`stack/`)

| Part     | Where                                  | Notes                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres | `bluechip_e2e` on the compose Postgres | Dropped, recreated and migrated each run                                                                                                                                                                                                                          |
| Anvil    | 18545                                  | From `packages/devnet/state/devnet.state.gz`, a block every 2 s at the real clock; feeds marked fresh and pools aligned to their feeds at startup (fails fast if a pool is off)                                                                                   |
| Alto     | 14337                                  | Safe mode, as in the devnet                                                                                                                                                                                                                                       |
| Server   | 18080                                  | `apps/server/test/stack/main.ts`: the real server on market data priced from the devnet's feeds (`AlpacaFromChain`) and the recorded model; `POST /e2e/replies` records model replies, `POST /e2e/expire` runs the agent expiry cron for one user at a given time |
| Web      | 13000                                  | Vite dev server (own optimizer cache), `SERVER_ORIGIN` and `VITE_RPC_URL` pointed at the stack                                                                                                                                                                    |

Never on `pnpm dev`'s ports (3000, 8080, 8545, 4337). Tests tagged `@chain` change what every account shares (the base
fee) and run alone, after the rest (`--project chain`).

## Layout

- `fixtures/test.ts`: the suite's `test`: a virtual authenticator per page, `user` / `funded` (a new person per test),
  `replies` (the recorded model), `chain` (devnet controls); fails a test on any console error or warning, any 5xx,
  and any "·" in the final page's text.
- `utils/`: page helpers per area (`agents.ts`, `intents.ts`, `trading.ts`, `assistant.ts`).
- `specs/`: one file per area.

## Coverage

274 tests; 22 are `test.fixme` (reason on the line above each). Last full run (before the last stack fix, 4 workers):
260 passed, 18 failed (since fixed or marked fixme), 636 s.

| Area                                                                                                                                                                        | Spec                                                                 | Covered                         | Fixme / not covered                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Landing, legal, sign-up, eligibility, sign in/out, new device                                                                                                               | `auth`                                                               | all                             |                                                                                                      |
| Home: balance, latest activity, greeting, Ask bluechip (links to the chat page, no chat of its own)                                                                         | `home`                                                               | most                            | total with shares (pins prices, W8); 1 bug                                                           |
| Add cash, dev funding, withdraw (Face ID, validation, cancel)                                                                                                               | `funding`                                                            | all                             |                                                                                                      |
| Portfolio: holdings, sort, mix, cash card, "1 share"                                                                                                                        | `portfolio`                                                          | empty and cash states           | sorted holdings and mix (W8)                                                                         |
| Stocks list, search, not found, stock page, chart ranges                                                                                                                    | `market`                                                             | most                            | list and header prices (W8)                                                                          |
| Buy and sell yourself with Face ID, Max, quick amounts, shares/USDC, the $1 minimum                                                                                         | `trading`                                                            | quotes, validation              | fills, sells, cancelled Face ID (were blocked by the swap deadline bug, now fixed: re-check); W8     |
| Activity                                                                                                                                                                    | `activity`                                                           | list, details, empty states     |                                                                                                      |
| Settings: name, passkeys, memory link, danger zone                                                                                                                          | `settings`                                                           | all                             |                                                                                                      |
| Phone width, navigation, the sidebar folding to icons, the phone nav sheet                                                                                                  | `layout`                                                             | all                             |                                                                                                      |
| New agent: every template, scratch, presets, policy picker, every editor, review, lock, cancelled Face ID                                                                   | `agents-new`, `agents-editors`                                       | all                             |                                                                                                      |
| Agent page, edit (tighter/looser), renew, pause/resume, pause all, remove, expired, templates                                                                               | `agents-page`, `agents-edit`, `agents-lifecycle`, `agents-templates` | all                             | review problems the server catches first (unreachable from the UI)                                   |
| Trade through an agent: preview, fill, blocked                                                                                                                              | `agent-trading`                                                      | previews, fill                  | activity/usage after a fill, blocked line (not diagnosed)                                            |
| Waits: no ETH, cancel, gas price                                                                                                                                            | `agent-waits`                                                        | no ETH, cancel, ended wait line | gas price (`@chain`) never run yet                                                                   |
| Approvals page, sheet, badge, approve, decline                                                                                                                              | `approvals`                                                          | all but one                     | activity row's link to its approval                                                                  |
| Chat page (`/chat`, `/chat/:id`): send, stream, stop, retry, the chats sidebar, who trades (agent picker), tool rows, every card and its action, errors, ask about an agent | `assistant-*`                                                        | all                             | offline reconnect (Chromium's offline mode doesn't cut an open stream; a navigation cuts it instead) |

## Known issues

- **Chain clock.** The chain must stay on the real clock and UTC day: an agent's operation is bounded to its latest
  block's UTC day and Alto checks it against the real clock (`-32503`). The stack mines every 2 s at the real time, so
  on weekends and holidays prices read as paused, as on Base; agents that don't trade while paused wait then.
- **Prices.** The stack runs at the devnet's captured prices (NVDA about $152.80); some specs still pin $100 (W8).
- **Load.** Several runs at once on one stack slowed sign-up past 30 s; one run at a time with 4 workers is the norm.
- App issues found and not yet fixed (`research/backlog.md`): W8 price-pinned specs; the state pill and number morphs
  repeat their text in the DOM. W1 to W3, W5 to W7, W9 and W10 are fixed and their specs un-fixmed; W4 (dark mode) was
  dropped: bluechip stays light.
