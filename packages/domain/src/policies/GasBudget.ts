/**
 * The `gasBudget` policy: the most gas the agent may spend per UTC day, sponsored operations included. Enforced by
 * Namera's gas policy; you set it like any limit, and bluechip starts it from the trades its preset expects.
 *
 * Namera charges each operation its maximum cost (gas limits × the most it offers per gas), not what it paid, so a
 * trade counts several times its real fee, more again when fees spike. The default leaves room for that and still caps
 * what a leaked session key can burn, or what bluechip's paymaster spends on the agent under sponsorship.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { formatEther } from "./Format.ts"
import * as Policy from "./Policy.ts"
import { tradesPerDay } from "./TradesPerDay.ts"

/**
 * Wei per UTC day.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const GasBudgetConfig = Schema.Struct({ weiPerDay: Schema.BigInt })

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type GasBudgetConfig = typeof GasBudgetConfig.Type

/**
 * The gas one trade's operation is charged for: its call, verification and pre-verification gas limits as bluechip
 * sends a one-stock trade, measured on the devnet (about 1.85 million), rounded up for Base's larger pre-verification gas.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const TRADE_GAS = BigInt(2_500_000)

/**
 * The most per gas the budget is sized for: 0.2 gwei. Base's base fee is usually a few thousandths of a gwei and an
 * agent offers twice it, so this leaves room for a spike of fifty times.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const SIZING_FEE_PER_GAS = BigInt(200_000_000)

/**
 * How many times the expected trades' gas the budget leaves: room for retries, batches and fee spikes.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const GAS_ROOM = 3

/**
 * The least a day's budget starts at, however few trades are expected: 0.005 ETH.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const MIN_GAS_PER_DAY = BigInt(5_000_000_000_000_000)

const MILLI_ETHER = BigInt(1_000_000_000_000_000)

/**
 * The gas budget for `trades` a day: each trade's gas at the sizing fee, `GAS_ROOM` times over, rounded up to a
 * thousandth of an ether, and never under `MIN_GAS_PER_DAY`.
 *
 * **Example** (A balanced agent's 25 trades)
 *
 * ```ts import.meta.vitest
 * import { gasPerDay } from "@bluechip/domain/policies/GasBudget"
 *
 * gasPerDay(25) // => 38000000000000000n
 * gasPerDay(1) // => 5000000000000000n
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const gasPerDay = (trades: number): bigint => {
  const wei = BigInt(Math.max(0, Math.ceil(trades))) * TRADE_GAS * SIZING_FEE_PER_GAS * BigInt(GAS_ROOM)
  const rounded = (wei + MILLI_ETHER - BigInt(1)) / MILLI_ETHER * MILLI_ETHER
  return rounded > MIN_GAS_PER_DAY ? rounded : MIN_GAS_PER_DAY
}

/**
 * The trades a day a budget is sized for when nothing says otherwise: a balanced preset's.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_GAS_TRADES = 25

/**
 * @stability unstable
 * @category policies
 * @since 0.0.0
 */
export const gasBudget = Policy.make({
  id: "gasBudget",
  kind: "namera",
  title: "Gas a day",
  summary: "The most network fees it may use a day, counted at their highest: room for fee spikes, a cap if its key " +
    "leaked.",
  aliases: ["gas", "network fees", "fees", "gas limit"],
  examples: ["Let it spend at most 0.01 ETH on gas a day", "Give it more room for gas"],
  config: GasBudgetConfig,
  fields: {
    weiPerDay: new Policy.Field({
      label: "Gas it may spend a day",
      unit: "wei",
      min: 1e15,
      max: 1e18,
      sliderMax: 2e17,
      step: 1e15
    })
  },
  required: true,
  hidden: false,
  defaults: { weiPerDay: gasPerDay(DEFAULT_GAS_TRADES) },
  // A spec that leaves it out gets the budget for its trade count, up to a balanced agent's.
  fallback: (policies) => ({
    weiPerDay: gasPerDay(Math.min(Policy.configOf(policies, tradesPerDay)?.count ?? Infinity, DEFAULT_GAS_TRADES))
  }),
  describe: (config) => ({ can: [`Spend up to ${formatEther(config.weiPerDay)} on gas a day`], never: [] }),
  compare: (before, after) => Policy.compareNumbers(before.weiPerDay, after.weiPerDay, "lower")
})
