import { BluechipApi } from "@bluechip/domain/Api"
import { CurrentUser } from "@bluechip/domain/Auth"
import { Unavailable } from "@bluechip/domain/Errors"
import { PortfolioPoint } from "@bluechip/domain/portfolio/Portfolio"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Option from "effect/Option"
import type { Address } from "viem"
import { MarketPrices } from "../market/MarketPrices.ts"
import { AccountBalances } from "./AccountBalances.ts"
import { PortfolioSnapshots } from "./PortfolioSnapshots.ts"
import { valueHoldings } from "./Valuation.ts"

export const PortfolioHandlers = HttpApiBuilder.group(
  BluechipApi,
  "portfolio",
  Effect.fn(function*(handlers) {
    const balances = yield* AccountBalances
    const market = yield* MarketPrices
    const snapshots = yield* PortfolioSnapshots

    const current = Effect.gen(function*() {
      const user = yield* CurrentUser
      const holdings = yield* balances.of(user.account as Address).pipe(
        Effect.catchTag("ChainError", () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 })))
      )
      return valueHoldings(holdings, yield* market.prices, yield* DateTime.now)
    })

    return handlers.handleAll({
      portfolio: () => current,
      history: Effect.fn(function*() {
        const user = yield* CurrentUser
        const history = yield* snapshots.history(user.id)
        // The chart ends at the value now; if the chain can't be read, it ends at the last snapshot.
        const now = yield* current.pipe(Effect.option)

        return Option.match(now, {
          onNone: () => history,
          onSome: (portfolio) => [...history, new PortfolioPoint({ at: portfolio.asOf, value: portfolio.value })]
        })
      })
    })
  })
)
