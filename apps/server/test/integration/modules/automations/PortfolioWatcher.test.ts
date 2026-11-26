import { Devnet } from "@bluechip/devnet/Devnet"
import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { PortfolioWatcher } from "../../../../src/modules/automations/watchers/PortfolioWatcher.ts"
import { AROUND_THE_CLOCK } from "../../../fixtures/Automations.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("PortfolioWatcher", (it) => {
  describe("check", () => {
    it.effect("NVIDIA grown over 40% of the portfolio fires once, asking you to sell $10 of it", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).funded
        // $1,000 of cash and 10 NVIDIA shares at $100: half the portfolio.
        yield* (yield* Devnet).mintShares(user.account, "NVDA", 1_000_000_000n)
        const saved = yield* user.api.automations.create({
          payload: {
            requestId: RequestId.make(randomUUID()),
            draft: new AutomationDraft({
              name: "Trim NVIDIA",
              agentId: null,
              trigger: {
                type: "portfolio",
                config: { measure: "holding", symbol: "NVDA", direction: "above", bps: 4000 }
              },
              conditions: [],
              action: { type: "sell", config: { symbol: "NVDA", amount: Usdc.make(10_000_000n) } },
              settings: { ...DEFAULT_SETTINGS, ...AROUND_THE_CLOCK }
            })
          }
        })
        const watcher = yield* PortfolioWatcher

        yield* watcher.check({ userId: user.id })
        const { intent } = yield* user.events.next(
          "IntentChanged",
          ({ intent }) => intent.source === "automation" && intent.status === "needsApproval"
        )
        yield* watcher.check({ userId: user.id })
        const detail = yield* user.api.automations.automation({ params: { id: saved.id } })

        assert.deepStrictEqual(
          [detail.runs.length, detail.runs[0]?.outcome, intent.leg.side, intent.leg.symbol],
          [1, "asked", "sell", "NVDA"]
        )
        assert.match(detail.runs[0]!.windowKey, /^portfolio:\d{4}-\d\d-\d\dT/)
      }))
  })
})
