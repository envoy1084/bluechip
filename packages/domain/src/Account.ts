/**
 * A bluechip user, the passkeys that sign for them, and their account on Base.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { Address, PasskeyId, UserId } from "./Ids.ts"

/**
 * Whether the user may hold Coinbase's tokenized stocks, which are offered to non-US persons only (Regulation S).
 * `unknown` until they answer; `us` keeps the account but trading stays off.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const Eligibility = Schema.Literals(["unknown", "outsideUs", "us"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Eligibility = typeof Eligibility.Type

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class User extends Schema.Class<User>("@bluechip/domain/Account/User")({
  id: UserId,
  displayName: Schema.NullOr(Schema.String),
  eligibility: Eligibility,
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * A passkey that signs in and owns the account.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Passkey extends Schema.Class<Passkey>("@bluechip/domain/Account/Passkey")({
  id: PasskeyId,
  /** Where it lives and what it was made on, such as "iCloud Keychain on Mac". */
  label: Schema.NullOr(Schema.String),
  /** Backed up by a passkey provider and available on the user's other devices. */
  synced: Schema.Boolean,
  /** The passkey that signed in the current session. */
  current: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtc)
}) {}

/**
 * The user's Kernel smart account on Base. Its address is fixed by the passkey from sign-up; it is deployed with its
 * first transaction. `deployed` is `null` when the chain could not be read.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Account extends Schema.Class<Account>("@bluechip/domain/Account/Account")({
  address: Address,
  deployed: Schema.NullOr(Schema.Boolean)
}) {}

/**
 * The signed-in user and their account, as `GET /api/account` and sign-in return them.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Me extends Schema.Class<Me>("@bluechip/domain/Account/Me")({
  user: User,
  account: Account
}) {}
