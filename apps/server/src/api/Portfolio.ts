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
import { AccountBalances } from "../portfolio/AccountBalances.ts"
import { readSnapshots } from "../portfolio/Snapshots.ts"
import { valueHoldings } from "../portfolio/Valuation.ts"

const currentPortfolio = Effect.gen(function*() {
  const user = yield* CurrentUser
  const balances = yield* AccountBalances
  const market = yield* MarketPrices

  const holdings = yield* balances.of(user.account as Address).pipe(
    Effect.catchTag("ChainError", () => Effect.fail(new Unavailable({ dependency: "chain", retryAfterSeconds: 5 })))
  )
  return valueHoldings(holdings, yield* market.prices, yield* DateTime.now)
})

export const PortfolioHandlers = HttpApiBuilder.group(BluechipApi, "portfolio", (handlers) =>
  handlers
    .handle("portfolio", () => currentPortfolio)
    .handle("history", () =>
      Effect.gen(function*() {
        const user = yield* CurrentUser
        const snapshots = yield* readSnapshots(user.id)
        // The chart ends at the value now; if the chain can't be read, it ends at the last snapshot.
        const now = yield* currentPortfolio.pipe(Effect.option)

        return Option.match(now, {
          onNone: () => snapshots,
          onSome: (portfolio) => [...snapshots, new PortfolioPoint({ at: portfolio.asOf, value: portfolio.value })]
        })
      })))
