import { ChainDeployment } from "@bluechip/chain/ChainDeployment"
import { formatPrice } from "@bluechip/domain/automations/Format"
import type { TriggerData } from "@bluechip/domain/automations/Run"
import type { PriceTick, Step } from "@bluechip/domain/automations/Trigger"
import { stepPriceCross } from "@bluechip/domain/automations/triggers/PriceCross"
import { stepPriceMove } from "@bluechip/domain/automations/triggers/PriceMove"
import type { UserId } from "@bluechip/domain/Ids"
import type { MarketPrice } from "@bluechip/domain/market/Market"
import * as Singleton from "effect/cluster/Singleton"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schedule from "effect/Schedule"
import * as Stream from "effect/Stream"
import * as WorkflowEngine from "effect/workflow/WorkflowEngine"
import { MarketPrices } from "../../market/MarketPrices.ts"
import { Automations } from "../Automations.ts"
import { FireAutomation } from "../FireAutomation.ts"

const NEW_YORK = DateTime.zoneMakeNamedUnsafe("America/New_York")

const newYorkDay = (at: DateTime.Utc) => {
  const { day, month, year } = DateTime.toParts(DateTime.setZone(at, NEW_YORK))
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/**
 * The watcher of `priceMove` and `priceCross` automations: one subscription to market prices serves them all. Each
 * change moves the automations on that stock (their extremes, the day's first price, the side of a level, kept in
 * their state) and starts a fire for each window crossed, once.
 */
export class PriceWatcher extends Context.Service<PriceWatcher, {
  /** Market prices that changed, for everyone's automations (or one user's). */
  readonly observe: (
    prices: ReadonlyArray<MarketPrice>,
    options?: { readonly userId?: UserId | undefined }
  ) => Effect.Effect<void>
}>()("@bluechip/server/PriceWatcher") {
  static readonly layer = Layer.effect(
    PriceWatcher,
    Effect.gen(function*() {
      const automations = yield* Automations
      const { stocks } = yield* ChainDeployment
      const engine = yield* WorkflowEngine.WorkflowEngine

      const observe = Effect.fn("PriceWatcher.observe")(function*(
        prices: ReadonlyArray<MarketPrice>,
        options: { readonly userId?: UserId | undefined } = {}
      ) {
        if (prices.length === 0) return
        for (const row of yield* automations.watched("price", options.userId)) {
          const config = row.trigger.config as { readonly symbol: string }
          const price = prices.find((candidate) => candidate.symbol === config.symbol)
          if (price === undefined) continue

          const tick: PriceTick = {
            price: price.price,
            previousClose: price.previousClose,
            day: newYorkDay(price.tradedAt),
            at: DateTime.formatIso(price.tradedAt)
          }
          const rule = row.trigger
          const fire = yield* automations.advance(row.id, (state): Step =>
            rule.type === "priceMove" ?
              stepPriceMove(rule.config, state, tick) :
              rule.type === "priceCross" ?
              stepPriceCross(rule.config, state, tick) :
              { state, fire: null })
          if (fire === null) continue

          const name = stocks.find((stock) => stock.symbol === price.symbol)?.name ?? price.symbol
          const trigger: TriggerData = {
            summary: `${name} is at ${formatPrice(price.price)}.`,
            symbol: price.symbol,
            price: price.price,
            newsItemId: null
          }
          yield* FireAutomation.execute({ automationId: row.id, windowKey: fire, trigger }, { discard: true })
            .pipe(Effect.provideService(WorkflowEngine.WorkflowEngine, engine))
        }
      })

      return PriceWatcher.of({ observe })
    })
  )

  /** Follows market prices on one runner of the cluster, again after a failure. */
  static readonly watch = Singleton.make(
    "automations.prices",
    Effect.gen(function*() {
      const watcher = yield* PriceWatcher
      const market = yield* MarketPrices
      yield* market.changes.pipe(
        Stream.runForEach((prices) =>
          watcher.observe(prices, {}).pipe(
            Effect.catchCause((cause) => Effect.logWarning("Price watcher failed on a tick", cause))
          )
        ),
        Effect.retry(Schedule.spaced("5 seconds"))
      )
    })
  )
}
