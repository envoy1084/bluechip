import { DevChain } from "@bluechip/chain/DevChain"
import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import { Forbidden, Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Option from "effect/Option"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { randomUUID } from "node:crypto"
import { parseEther, parseUnits } from "viem"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { Automations } from "../automations/Automations.ts"
import { FireAutomation } from "../automations/FireAutomation.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"

export const DevHandlers = HttpApiBuilder.group(
  BluechipApi,
  "dev",
  Effect.fn(function*(handlers) {
    const dev = yield* Effect.serviceOption(DevChain)
    const balances = yield* AccountBalances
    const live = yield* LiveEvents
    const automations = yield* Automations
    const engine = yield* WorkflowEngine.WorkflowEngine

    return handlers.handleAll({
      fund: Effect.fn(function*() {
        if (Option.isNone(dev)) return yield* new Forbidden()
        const user = yield* CurrentUser
        const account = user.account as `0x${string}`

        // ETH for gas (production sponsors it), then USDC as a real transfer, so it arrives like any deposit.
        yield* Effect.gen(function*() {
          yield* dev.value.setEthBalance(account, parseEther("0.05"))
          yield* dev.value.sendUsdc(account, parseUnits("1000", 6))
        }).pipe(
          Effect.catchTag(
            "ChainError",
            () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null }))
          )
        )

        yield* balances.invalidate(account)
        yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), user.id)
      }),

      fireAutomation: Effect.fn(function*({ params }) {
        if (Option.isNone(dev)) return yield* new Forbidden()
        const user = yield* CurrentUser
        yield* automations.detail(user, params.id)

        // A window of its own per call, so each one fires, as a trigger's next window would.
        yield* FireAutomation.execute({
          automationId: params.id,
          windowKey: `dev:${randomUUID()}`,
          trigger: { summary: "It was run by hand.", symbol: null, price: null, newsItemId: null }
        }).pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
      })
    })
  })
)
