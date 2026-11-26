/**
 * The `portfolio` trigger: cash falls under, or a holding grows over, a share of the portfolio. It fires on
 * crossing the threshold, and again only after the portfolio came back to the other side.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import type { Portfolio } from "../../portfolio/Portfolio.ts"
import { stockProblems } from "../AgentLimits.ts"
import { Field } from "../Entry.ts"
import { formatBps } from "../Format.ts"
import * as Trigger from "../Trigger.ts"

/**
 * What is measured (cash, or one holding), which side of the threshold fires, and the threshold in basis points of
 * the portfolio.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const PortfolioLevelConfig = Schema.Struct({
  measure: Schema.Literals(["cash", "holding"]),
  /** The holding measured; `null` for cash. */
  symbol: Schema.NullOr(StockSymbol),
  direction: Schema.Literals(["below", "above"]),
  bps: Schema.Int
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PortfolioLevelConfig = typeof PortfolioLevelConfig.Type

/**
 * @stability unstable
 * @category triggers
 * @since 0.0.0
 */
export const portfolioLevel = Trigger.make({
  type: "portfolio",
  watcher: "portfolio",
  marketHours: true,
  asks: false,
  title: "Portfolio level",
  summary: "When cash falls under, or a stock grows over, a share of your portfolio.",
  aliases: ["cash low", "too much in one stock", "overweight", "position size", "cash reserve"],
  examples: ["When cash falls under 10%, sell $100 of Apple", "If NVIDIA grows over 40% of my money, sell 10% of it"],
  config: PortfolioLevelConfig,
  fields: {
    measure: new Field({ label: "Measure", unit: "choice" }),
    symbol: new Field({ label: "Stock", unit: "stock" }),
    direction: new Field({ label: "Goes", unit: "choice" }),
    bps: new Field({ label: "Share of your portfolio", unit: "bps", min: 100, max: 9900, step: 100 })
  },
  defaults: { measure: "cash", symbol: null, direction: "below", bps: 1000 },
  check: (config, context) => {
    if (config.measure === "cash") {
      return config.symbol === null ? [] : [{ field: "symbol", message: "Cash has no stock." }]
    }
    if (config.symbol === null) return [{ field: "symbol", message: "Pick the stock to measure." }]
    return stockProblems("symbol", [config.symbol], context)
  },
  describe: (config, { name }) => {
    const what = config.measure === "cash" || config.symbol === null ? "cash" : name(config.symbol)
    const way = config.direction === "below" ? "falls under" : "grows over"
    return `when ${what} ${way} ${formatBps(config.bps)} of your portfolio`
  }
})

const BPS = BigInt(10_000)

/**
 * What a portfolio change does to a `portfolio` automation: crossing to the chosen side fires once; the other side
 * arms it again.
 *
 * @stability unstable
 * @category watching
 * @since 0.0.0
 */
export const stepPortfolioLevel = (
  config: PortfolioLevelConfig,
  state: Trigger.WatchState,
  portfolio: Pick<Portfolio, "value" | "cash" | "holdings">,
  at: string
): Trigger.Step => {
  if (portfolio.value === BigInt(0)) return { state, fire: null }
  const part = config.measure === "cash" ?
    portfolio.cash :
    portfolio.holdings.find((holding) => holding.symbol === config.symbol)?.value ?? BigInt(0)
  const share = Number((part * BPS) / portfolio.value)
  const crossed = config.direction === "below" ? share < config.bps : share > config.bps
  const side = crossed === (config.direction === "above") ? "above" : "below"
  if (!crossed) return { state: { ...state, side }, fire: null }
  if (state.side === side) return { state, fire: null }
  return Trigger.fireOnce({ ...state, side }, `portfolio:${at}`)
}
