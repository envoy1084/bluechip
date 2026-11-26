import type { CheckContext } from "@bluechip/domain/automations/Entry"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"

/** What the editor's fields read besides their own values. */
export interface EditorContext {
  /** The stocks it may be about: the agent's, or every stock for your own. */
  readonly stocks: ReadonlyArray<Stock>
  readonly nameOf: (symbol: StockSymbol) => string
  /** The viewer's time zone, offered beside the market's. */
  readonly zone: string
  /** What decides which triggers, conditions and actions can run for it. */
  readonly check: CheckContext
}
