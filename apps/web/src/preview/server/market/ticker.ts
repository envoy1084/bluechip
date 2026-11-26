// Prices that move while a preview tab is open, as the server's market feed would send them: a few stocks every five
// seconds, unless the panel stops them or prices are paused.
import type { LiveEvent } from "@bluechip/domain/Events"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { tickPrices } from "../../world/market/valuation.ts"
import { Preview } from "../Preview.ts"

export const PriceTicker = Layer.effectDiscard(
  Effect.gen(function*() {
    const preview = yield* Preview
    // Only in a browser tab: tests read a market that holds still.
    if (typeof document === "undefined") return

    const tick = Effect.sync(() => {
      if (!preview.world.market.ticking) return
      let events: ReadonlyArray<LiveEvent> = []
      preview.update((world) => {
        events = tickPrices(world.market, Date.now())
      })
      for (const event of events) preview.emit(event)
    })
    yield* Effect.forkScoped(Effect.forever(Effect.andThen(Effect.sleep("5 seconds"), tick)))
  })
)
