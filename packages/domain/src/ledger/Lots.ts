/**
 * Cost basis, first in, first out: the lots one stock's shares were bought in, what each sale closed, and the profit
 * or loss it realised, replayed from the fills and adjustments in the order they happened.
 *
 * @since 0.0.0
 */
import { type Price, Shares, type Usdc, valueOf } from "../market/Units.ts"

const zero = BigInt(0)

/**
 * Something that changed how many shares of one stock you hold: a buy (or a transfer in) opens a lot at what it
 * cost; a sale (or a transfer out) closes shares for what it brought. `source` is the trade or adjustment it came
 * from; `agentId` the agent that traded (`null` for you or an outside transfer); `flagged` marks what bluechip
 * didn't trade itself (an opening balance, a transfer valued at the market price).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type LotEntry =
  | {
    readonly _tag: "Open"
    readonly source: string
    readonly agentId: string | null
    readonly shares: Shares
    readonly cost: Usdc
    readonly at: number
    readonly flagged: boolean
  }
  | {
    readonly _tag: "Close"
    readonly source: string
    readonly agentId: string | null
    readonly shares: Shares
    readonly proceeds: Usdc
    readonly at: number
    readonly flagged: boolean
  }

/**
 * A lot: shares bought together, what they cost, and how much of both is still held.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Lot {
  readonly source: string
  readonly agentId: string | null
  readonly shares: bigint
  readonly cost: bigint
  readonly remaining: bigint
  readonly remainingCost: bigint
  readonly openedAt: number
  /** When its last share was sold; `null` while any is held. */
  readonly closedAt: number | null
  readonly flagged: boolean
}

/**
 * What one sale took from one lot (or, with `lot: null`, shares sold that no lot held, at no cost and flagged):
 * the shares, their cost, their part of the proceeds and the difference.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface Closing {
  /** The lot's `source`; `null` for shares no lot held. */
  readonly lot: string | null
  /** The sale's `source`. */
  readonly source: string
  /** The agent that sold. */
  readonly agentId: string | null
  /** The agent that bought the lot. */
  readonly openedBy: string | null
  readonly shares: bigint
  readonly cost: bigint
  readonly proceeds: bigint
  /** Proceeds less cost (negative for a loss). */
  readonly realised: bigint
  readonly at: number
  readonly flagged: boolean
}

/**
 * The lots and closings after `entries`, taken in order. A sale closes the oldest shares first; a lot sold in part
 * keeps the rest of its cost exactly (the part sold is rounded down), and a sale across several lots splits its
 * proceeds by shares (rounded down, the last lot taking what's left), so costs and proceeds always add up.
 *
 * **Example** (A buy, then half of it sold)
 *
 * ```ts import.meta.vitest
 * import { replay } from "@bluechip/domain/ledger/Lots"
 * import { Shares, Usdc } from "@bluechip/domain/market/Units"
 *
 * const { closings, lots } = replay([
 *   { _tag: "Open", source: "buy", agentId: null, shares: Shares.make(100n), cost: Usdc.make(1_000n), at: 1, flagged: false },
 *   { _tag: "Close", source: "sell", agentId: null, shares: Shares.make(50n), proceeds: Usdc.make(600n), at: 2, flagged: false }
 * ])
 * lots[0]?.remainingCost // => 500n
 * closings[0]?.realised // => 100n
 * ```
 *
 * @stability unstable
 * @category replay
 * @since 0.0.0
 */
export const replay = (
  entries: ReadonlyArray<LotEntry>
): { readonly lots: ReadonlyArray<Lot>; readonly closings: ReadonlyArray<Closing> } => {
  const lots: Array<Lot> = []
  const closings: Array<Closing> = []

  for (const entry of entries) {
    if (entry._tag === "Open") {
      lots.push({
        source: entry.source,
        agentId: entry.agentId,
        shares: entry.shares,
        cost: entry.cost,
        remaining: entry.shares,
        remainingCost: entry.cost,
        openedAt: entry.at,
        closedAt: entry.shares === zero ? entry.at : null,
        flagged: entry.flagged
      })
      continue
    }

    let left: bigint = entry.shares
    let proceedsLeft: bigint = entry.proceeds
    for (let index = 0; index < lots.length && left > zero; index++) {
      const lot = lots[index]!
      if (lot.remaining === zero) continue

      const take = left < lot.remaining ? left : lot.remaining
      const cost = take === lot.remaining ? lot.remainingCost : (lot.remainingCost * take) / lot.remaining
      left -= take
      const proceeds = left === zero ? proceedsLeft : (entry.proceeds * take) / entry.shares
      proceedsLeft -= proceeds

      const remaining = lot.remaining - take
      lots[index] = {
        ...lot,
        remaining,
        remainingCost: lot.remainingCost - cost,
        closedAt: remaining === zero ? entry.at : null
      }
      closings.push({
        lot: lot.source,
        source: entry.source,
        agentId: entry.agentId,
        openedBy: lot.agentId,
        shares: take,
        cost,
        proceeds,
        realised: proceeds - cost,
        at: entry.at,
        flagged: entry.flagged || lot.flagged
      })
    }

    if (left > zero) {
      closings.push({
        lot: null,
        source: entry.source,
        agentId: entry.agentId,
        openedBy: null,
        shares: left,
        cost: zero,
        proceeds: proceedsLeft,
        realised: proceedsLeft,
        at: entry.at,
        flagged: true
      })
    }
  }

  return { lots, closings }
}

/**
 * What the shares still held in `lots` would gain or lose if sold at `price`: their value, rounded down, less what
 * they cost.
 *
 * **Example** (A lot bought at $10 a share, now $12)
 *
 * ```ts import.meta.vitest
 * import { unrealised } from "@bluechip/domain/ledger/Lots"
 * import { Price, Shares, Usdc } from "@bluechip/domain/market/Units"
 *
 * unrealised([{ remaining: Shares.make(100_000_000n), remainingCost: Usdc.make(10_000_000n) }], Price.make(1_200_000_000n))
 * // => 2_000_000n
 * ```
 *
 * @stability unstable
 * @category replay
 * @since 0.0.0
 */
export const unrealised = (
  lots: ReadonlyArray<Pick<Lot, "remaining" | "remainingCost">>,
  price: Price
): bigint => lots.reduce((sum, lot) => sum + valueOf(Shares.make(lot.remaining), price) - lot.remainingCost, zero)
