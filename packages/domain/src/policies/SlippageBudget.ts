/**
 * The `slippageBudget` policy: the most an agent may lose to prices (fills against Chainlink's price) over seven days,
 * as a share of the portfolio. Enforced by `SlippageBudgetRule`, whose ledger decays linearly over the week so the
 * budget frees up gradually instead of all at once.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Usdc } from "../market/Units.ts"
import { formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"

/**
 * The budget, in basis points of the portfolio per seven days.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SlippageBudgetConfig = Schema.Struct({ weeklyBps: Schema.Int })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SlippageBudgetConfig = typeof SlippageBudgetConfig.Type

/**
 * Seven days, in seconds: the window the budget covers.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SLIPPAGE_WINDOW_SECONDS = 7 * 24 * 60 * 60

/**
 * What the ledger holds as of `now` (Unix seconds), from what it recorded at `updatedAt`: `used − used × elapsed /
 * 7 days`, rounded up as the contract does.
 *
 * **Example** (Half a week later)
 *
 * ```ts import.meta.vitest
 * import { slippageUsed } from "@bluechip/domain/policies/SlippageBudget"
 * import { Usdc } from "@bluechip/domain/market/Units"
 *
 * slippageUsed({ used: Usdc.make(2_000_000n), updatedAt: 0 }, 302_400) // => 1000000n
 * ```
 *
 * @stability unstable
 * @category slippage
 * @since 0.0.0
 */
export const slippageUsed = (ledger: { readonly used: Usdc; readonly updatedAt: number }, now: number): Usdc => {
  const elapsed = BigInt(Math.max(0, now - ledger.updatedAt))
  const window = BigInt(SLIPPAGE_WINDOW_SECONDS)
  if (elapsed >= window) return Usdc.make(BigInt(0))

  const remaining = ledger.used * (window - elapsed)
  return Usdc.make((remaining + window - BigInt(1)) / window)
}

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const slippageBudget = Policy.make({
  id: "slippageBudget",
  kind: "rule",
  title: "Weekly slippage",
  summary: "The most it may lose to prices in a week, as a share of your money.",
  aliases: ["slippage budget", "loss limit", "weekly loss"],
  examples: ["Don't lose more than 0.5% a week to bad fills"],
  config: SlippageBudgetConfig,
  fields: {
    weeklyBps: new Policy.Field({ label: "Weekly slippage", unit: "bps", min: 10, max: 500, choices: [50, 100, 200] })
  },
  required: false,
  hidden: false,
  defaults: { weeklyBps: 100 },
  describe: (config) => ({
    can: [],
    never: [`Lose more than ${formatPercent(config.weeklyBps)} of your money to prices in a week`]
  }),
  compare: (before, after) => Policy.compareNumbers(before.weeklyBps, after.weeklyBps, "lower")
})
