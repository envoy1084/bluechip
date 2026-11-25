import { ChainClient } from "@bluechip/chain/ChainClient"
import { DevChain } from "@bluechip/chain/DevChain"
import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import { Forbidden, Unavailable } from "@bluechip/domain/Errors"
import { LiveEvent } from "@bluechip/domain/Events"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import { parseEther, parseUnits } from "viem"
import { LiveEvents } from "../../platform/live/LiveEvents.ts"
import { AccountBalances } from "../portfolio/AccountBalances.ts"

export const DevHandlers = HttpApiBuilder.group(
  BluechipApi,
  "dev",
  Effect.fn(function*(handlers) {
    const chain = yield* ChainClient
    const dev = yield* DevChain
    const balances = yield* AccountBalances
    const live = yield* LiveEvents

    return handlers.handleAll({
      fund: Effect.fn(function*() {
        if (chain.network !== "local") return yield* new Forbidden()
        const user = yield* CurrentUser
        const account = user.account as `0x${string}`

        // ETH for gas (production sponsors it), then USDC as a real transfer, so it arrives like any deposit.
        yield* Effect.gen(function*() {
          yield* dev.setEthBalance(account, parseEther("0.05"))
          yield* dev.sendUsdc(account, parseUnits("1000", 6))
        }).pipe(
          Effect.catchTag(
            "ChainError",
            () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: null }))
          )
        )

        yield* balances.invalidate(account)
        yield* live.publish(LiveEvent.cases.PortfolioChanged.make({}), user.id)
      })
    })
  })
)
