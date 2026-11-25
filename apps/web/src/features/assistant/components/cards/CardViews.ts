import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { ComponentType } from "react"

/** What another feature draws inside cards: a trade followed live (from the intents feature, passed in by the route). */
export interface CardViews {
  readonly Trade: ComponentType<{ intent: Intent; nameOf: (symbol: StockSymbol) => string }>
  readonly nameOf: (symbol: StockSymbol) => string
}
