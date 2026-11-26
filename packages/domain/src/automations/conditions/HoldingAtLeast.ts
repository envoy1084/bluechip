/**
 * The `holdingAtLeast` condition: the account still holds a stock, at least some number of shares (any at all for
 * zero).
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../../market/Market.ts"
import { Shares } from "../../market/Units.ts"
import { formatShareCount } from "../../policies/Format.ts"
import * as Condition from "../Condition.ts"
import { Field } from "../Entry.ts"

/**
 * The stock and the fewest shares (8-decimal units); zero means any.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const HoldingAtLeastConfig = Schema.Struct({ symbol: StockSymbol, shares: Shares })

const sharesText = (shares: bigint) => formatShareCount(Number(shares) / 1e8)

/**
 * @stability unstable
 * @category conditions
 * @since 0.0.0
 */
export const holdingAtLeast = Condition.make({
  type: "holdingAtLeast",
  title: "Still holding",
  summary: "Only while you hold a stock, or at least some shares of it.",
  aliases: ["if I still own", "if I hold", "position"],
  examples: ["Only if I still hold NVIDIA"],
  config: HoldingAtLeastConfig,
  fields: {
    symbol: new Field({ label: "Stock", unit: "stock" }),
    shares: new Field({ label: "At least (shares)", unit: "count", min: 0 })
  },
  defaults: { symbol: "NVDA", shares: Shares.make(BigInt(0)) },
  describe: (config, { name }) =>
    config.shares === BigInt(0) ?
      `if you still hold ${name(config.symbol)}` :
      `if you hold at least ${sharesText(config.shares)} of ${name(config.symbol)}`,
  evaluate: (config, facts) => {
    const held = facts.holdings.get(config.symbol) ?? BigInt(0)
    const pass = held > BigInt(0) && held >= config.shares
    return {
      pass,
      reason: held === BigInt(0) ?
        `You hold no ${config.symbol}.` :
        `You hold ${sharesText(held)} of ${config.symbol}.`
    }
  }
})
