/**
 * The faucet: test USDC for an account on a network whose money is pretend (paper money on Base Sepolia, the local
 * chain), up to a daily allowance per account that resets at midnight UTC.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { TxHash } from "../Ids.ts"
import { Usdc } from "../market/Units.ts"

/**
 * How much test USDC one account can get in a UTC day: $10,000.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DAILY_LIMIT: Usdc = Usdc.make(BigInt(10_000_000_000))

/**
 * What one tap of "Get test money" asks for when nothing else is chosen: $1,000.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_AMOUNT: Usdc = Usdc.make(BigInt(1_000_000_000))

/**
 * What an account can still get today, of the daily limit, and when the allowance is whole again.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class FaucetAllowance extends Schema.Class<FaucetAllowance>("@bluechip/domain/paper/Faucet/FaucetAllowance")({
  limit: Usdc,
  remaining: Usdc,
  resetsAt: Schema.DateTimeUtc
}) {}

/**
 * Test USDC that arrived: how much, the transaction that sent it, and the allowance left after it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class FaucetGrant extends Schema.Class<FaucetGrant>("@bluechip/domain/paper/Faucet/FaucetGrant")({
  amount: Usdc,
  txHash: Schema.NullOr(TxHash),
  allowance: FaucetAllowance
}) {}

/**
 * The allowance of an account that got `grantedToday` since midnight UTC, at `now`.
 *
 * **Example** (Halfway through the day's allowance)
 *
 * ```ts import.meta.vitest
 * import { allowanceAt } from "@bluechip/domain/paper/Faucet"
 * import { Usdc } from "@bluechip/domain/market/Units"
 * import * as DateTime from "effect/DateTime"
 *
 * const allowance = allowanceAt(Usdc.make(BigInt(5_000_000_000)), DateTime.makeUnsafe("2026-11-27T15:00:00Z"))
 * allowance.remaining // 5_000_000_000n
 * ```
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const allowanceAt = (grantedToday: Usdc, now: DateTime.Utc): FaucetAllowance =>
  new FaucetAllowance({
    limit: DAILY_LIMIT,
    remaining: Usdc.make(grantedToday >= DAILY_LIMIT ? BigInt(0) : DAILY_LIMIT - grantedToday),
    resetsAt: DateTime.add(DateTime.startOf(now, "day"), { days: 1 })
  })
