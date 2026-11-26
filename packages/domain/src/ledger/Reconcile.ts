/**
 * Reconciliation: what the chain holds against what the ledger expects, and how each difference is explained (cash
 * that arrived), recorded (an account's opening balance) or flagged (anything else).
 *
 * @since 0.0.0
 */

/**
 * Why a balance was adjusted: an account's first check (`opening`, silent), a stock that arrived or left outside
 * bluechip (`transferIn`, `transferOut`, valued at the market price), or cash nothing explains (`unexplained`).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type AdjustmentReason = "opening" | "transferIn" | "transferOut" | "unexplained"

/**
 * One difference to record: `amount` of `asset` (`USDC` or a stock), signed, and why.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Adjustment {
  readonly asset: string
  readonly amount: bigint
  readonly reason: AdjustmentReason
}

/**
 * Balances by asset (`USDC` and each stock), in base units.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Balances = ReadonlyMap<string, bigint>

const zero = BigInt(0)

/**
 * How the chain's balances (`onchain`) differ from the ledger's (`expected`), explained. On an account's first check
 * (`opening`), every difference is its opening balance. Otherwise USDC sent to the account from outside since the
 * last check (`deposits`, from the chain's transfer logs) is a deposit, and whatever USDC is left over is unexplained;
 * a stock's difference is a transfer in or out. Assets with no difference make no adjustment.
 *
 * **Example** (A $500 deposit, and a share of Nvidia from nowhere)
 *
 * ```ts import.meta.vitest
 * import { reconcile } from "@bluechip/domain/ledger/Reconcile"
 *
 * reconcile({
 *   opening: false,
 *   expected: new Map([["USDC", 100n], ["NVDA", 0n]]),
 *   onchain: new Map([["USDC", 600n], ["NVDA", 1n]]),
 *   deposits: [500n]
 * })
 * // => { deposits: [500n], adjustments: [{ asset: "NVDA", amount: 1n, reason: "transferIn" }] }
 * ```
 *
 * @stability unstable
 * @category reconciliation
 * @since 0.0.0
 */
export const reconcile = <D extends bigint | { readonly amount: bigint }>(input: {
  readonly opening: boolean
  readonly expected: Balances
  readonly onchain: Balances
  readonly deposits: ReadonlyArray<D>
}): { readonly deposits: ReadonlyArray<D>; readonly adjustments: ReadonlyArray<Adjustment> } => {
  const assets = [...new Set([...input.onchain.keys(), ...input.expected.keys()])]
  const differenceOf = (asset: string) => (input.onchain.get(asset) ?? zero) - (input.expected.get(asset) ?? zero)

  if (input.opening) {
    return {
      deposits: [],
      adjustments: assets.flatMap((asset) => {
        const amount = differenceOf(asset)
        return amount === zero ? [] : [{ asset, amount, reason: "opening" as const }]
      })
    }
  }

  const deposited = input.deposits.reduce(
    (sum, deposit) => sum + (typeof deposit === "bigint" ? deposit : deposit.amount),
    zero
  )
  return {
    deposits: input.deposits,
    adjustments: assets.flatMap((asset): Array<Adjustment> => {
      const amount = differenceOf(asset) - (asset === "USDC" ? deposited : zero)
      if (amount === zero) return []
      if (asset === "USDC") return [{ asset, amount, reason: "unexplained" }]
      return [{ asset, amount, reason: amount > zero ? "transferIn" : "transferOut" }]
    })
  }
}
