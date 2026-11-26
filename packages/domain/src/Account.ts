/**
 * A bluechip user, the passkeys that sign for them, and their account on Base.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { TimeZoneName } from "./automations/Time.ts"
import { Address, PasskeyId, SessionId, SigningRequestId, UserId } from "./Ids.ts"
import { CeremonyOptions } from "./WebAuthn.ts"

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
  /** Your IANA time zone, for quiet hours and the digest's morning; `null` until the app first sets it. */
  timeZone: Schema.NullOr(TimeZoneName),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * What a passkey is for: an `owner` signs in and owns the account (any one of them signs); a `recovery` passkey only
 * recovers the account, after a 48-hour wait.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const PasskeyRole = Schema.Literals(["owner", "recovery"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PasskeyRole = typeof PasskeyRole.Type

/**
 * Where a passkey stands onchain: being added (`pending`, until its operation lands), an owner (`active`), being
 * removed, or removed.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const PasskeyStatus = Schema.Literals(["pending", "active", "removing", "removed"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type PasskeyStatus = typeof PasskeyStatus.Type

/**
 * A passkey that signs in and owns the account.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Passkey extends Schema.Class<Passkey>("@bluechip/domain/Account/Passkey")({
  id: PasskeyId,
  role: PasskeyRole,
  status: PasskeyStatus,
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

/**
 * Adding or removing one of the account's passkeys, prepared for an owner passkey to sign: the WebAuthn request (its
 * challenge is the owner operation's hash) and the passkey it changes.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PasskeyChange extends Schema.Class<PasskeyChange>("@bluechip/domain/Account/PasskeyChange")({
  id: SigningRequestId,
  options: CeremonyOptions,
  action: Schema.Literals(["add", "remove"]),
  passkey: Passkey,
  /** Whether this also deploys the account (its first transaction). */
  deploysAccount: Schema.Boolean,
  expiresAt: Schema.DateTimeUtc
}) {}

/**
 * A browser signed in to the account: the device it said it was, the passkey it signed in with, and when it was last
 * seen.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Device extends Schema.Class<Device>("@bluechip/domain/Account/Device")({
  id: SessionId,
  /** "Chrome on Mac", from the browser's user agent. */
  device: Schema.String,
  /** The passkey it signed in with ("iCloud Keychain on Mac"). */
  passkey: Schema.NullOr(Schema.String),
  /** The browser asking. */
  current: Schema.Boolean,
  signedInAt: Schema.DateTimeUtc,
  lastSeenAt: Schema.DateTimeUtc
}) {}
