/**
 * The `fairPrice` policy: how far a fill may be from Chainlink's price, and whether the agent trades while prices are
 * paused (weekends and holidays), with half the collar then. Enforced by `FairPriceRule` and `TradeGuard`'s price ages.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { trade } from "./Trade.ts"

/**
 * The collar in basis points, and whether it trades while prices are paused.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const FairPriceConfig = Schema.Struct({
  collarBps: Schema.Int,
  tradeWhilePaused: Schema.Boolean
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type FairPriceConfig = typeof FairPriceConfig.Type

/**
 * Prices up to this old are live: Chainlink's stock feeds update on a 0.5% move or every 24 hours, plus slack.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const LIVE_PRICE_SECONDS = 26 * 60 * 60

/**
 * Prices up to this old are paused rather than broken: the longest weekend with a holiday, plus slack. Older prices
 * are stale and nothing trades on them.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const PAUSED_PRICE_SECONDS = 80 * 60 * 60

/**
 * The collar while prices are paused: half the live one.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const pausedCollar = (config: FairPriceConfig): number => Math.floor(config.collarBps / 2)

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const fairPrice = Policy.make({
  id: "fairPrice",
  kind: "rule",
  title: "Fair price",
  summary: "How far from Chainlink's price a trade may fill, and whether it trades on weekends and holidays.",
  aliases: ["price protection", "slippage limit", "collar", "weekend trading", "paused prices"],
  examples: ["Never pay more than 0.5% over the market price", "Don't trade on weekends"],
  config: FairPriceConfig,
  fields: {
    collarBps: new Policy.Field({ label: "Price protection", unit: "bps", min: 10, max: 500, choices: [50, 100, 200] }),
    tradeWhilePaused: new Policy.Field({ label: "Trade while prices are paused", unit: "toggle" })
  },
  required: true,
  hidden: false,
  defaults: { collarBps: 100, tradeWhilePaused: true },
  validate: (config, policies) =>
    config.tradeWhilePaused && Policy.configOf(policies, trade)?.direction === "rebalance" ?
      [{ field: "tradeWhilePaused", message: "A Rebalancer only trades while prices are live." }] :
      [],
  describe: (config) => ({
    can: config.tradeWhilePaused ? ["Trade on weekends and holidays, with a tighter price limit"] : [],
    never: [
      `Trade more than ${formatPercent(config.collarBps)} away from Chainlink's price`,
      ...(config.tradeWhilePaused ? [] : ["Trade while prices are paused"])
    ]
  }),
  compare: (before, after) =>
    Policy.combine([
      Policy.compareNumbers(before.collarBps, after.collarBps, "lower"),
      Policy.compareNumbers(Number(before.tradeWhilePaused), Number(after.tradeWhilePaused), "lower")
    ])
})
