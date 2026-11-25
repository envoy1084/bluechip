// Trades as intents carry them.
import type { Leg } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"

/** A buy of `dollars` of `symbol`. */
export const buy = (symbol: StockSymbol, dollars: number): Leg => ({
  symbol,
  side: "buy",
  amount: { usdc: Usdc.make(BigInt(dollars * 1_000_000)) }
})
