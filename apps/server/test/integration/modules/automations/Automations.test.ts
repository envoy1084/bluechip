import { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { type PortfolioLevelConfig, stepPortfolioLevel } from "@bluechip/domain/automations/triggers/PortfolioLevel"
import { RequestId } from "@bluechip/domain/Ids"
import { Usdc } from "@bluechip/domain/market/Units"
import { assert, describe, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { randomUUID } from "node:crypto"
import { Automations } from "../../../../src/modules/automations/Automations.ts"
import { AROUND_THE_CLOCK } from "../../../fixtures/Automations.ts"
import { TestUsers } from "../../../utils/TestUsers.ts"

const cashUnder10: PortfolioLevelConfig = { measure: "cash", symbol: null, direction: "below", bps: 1000 }

// The server runs on the real clock (see `TestServer`).
layer(TestUsers.layer, { excludeTestServices: true })("Automations", (it) => {
  describe("advance", () => {
    it.effect("two portfolio checks seeing one crossing at once fire it once", () =>
      Effect.gen(function*() {
        const user = yield* (yield* TestUsers).signUp
        const saved = yield* user.api.automations.create({
          payload: {
            requestId: RequestId.make(randomUUID()),
            draft: new AutomationDraft({
              name: "Low on cash",
              agentId: null,
              trigger: { type: "portfolio", config: cashUnder10 },
              conditions: [],
              action: { type: "sell", config: { symbol: "NVDA", amount: Usdc.make(10_000_000n) } },
              settings: { ...DEFAULT_SETTINGS, ...AROUND_THE_CLOCK }
            })
          }
        })
        // $50 of cash in $1,000: 5%, under the 10% it watches.
        const portfolio = { value: Usdc.make(1_000_000_000n), cash: Usdc.make(50_000_000n), holdings: [] }
        const automations = yield* Automations

        // Each check names its own time, so each would fire under its own window.
        const fires = yield* Effect.all(
          [
            automations.advance(
              saved.id,
              (state) => stepPortfolioLevel(cashUnder10, state, portfolio, "2026-11-30T15:00:00.000Z")
            ),
            automations.advance(
              saved.id,
              (state) => stepPortfolioLevel(cashUnder10, state, portfolio, "2026-11-30T15:00:00.250Z")
            )
          ],
          { concurrency: "unbounded" }
        )

        assert.strictEqual(fires.filter((fire) => fire !== null).length, 1)
      }))
  })
})
