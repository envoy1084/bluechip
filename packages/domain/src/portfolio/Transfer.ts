/**
 * Money moving in and out of a user's account: deposits from anywhere, withdrawals the user signs.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Address, SigningRequestId, TransferId, TxHash } from "../Ids.ts"
import { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import { CeremonyOptions } from "../WebAuthn.ts"

/**
 * What moved: USDC, or a stock's token.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Asset = Schema.Union([Schema.Literal("USDC"), StockSymbol])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Asset = typeof Asset.Type

/**
 * A deposit (seen on chain) or a withdrawal (signed here). Amounts are base units: USDC has 6 decimals, shares 8.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Transfer extends Schema.Class<Transfer>("@bluechip/domain/portfolio/Transfer/Transfer")({
  id: TransferId,
  kind: Schema.Literals(["deposit", "withdrawal"]),
  asset: Asset,
  amount: Schema.BigInt,
  from: Address,
  to: Address,
  /** Deposits are confirmed when seen; withdrawals are pending until their transaction lands. */
  status: Schema.Literals(["pending", "confirmed", "failed"]),
  /** `null` while a withdrawal waits for the bundler to include it. */
  txHash: Schema.NullOr(TxHash),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * A withdrawal prepared on the server, for the user to approve with their passkey: the WebAuthn request options
 * (their challenge is the user operation's hash) and what it does.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class SigningRequest extends Schema.Class<SigningRequest>("@bluechip/domain/portfolio/Transfer/SigningRequest")({
  id: SigningRequestId,
  options: CeremonyOptions,
  withdrawal: Schema.Struct({ amount: Usdc, to: Address }),
  /** Whether this also deploys the account (its first transaction). */
  deploysAccount: Schema.Boolean,
  expiresAt: Schema.DateTimeUtc
}) {}
