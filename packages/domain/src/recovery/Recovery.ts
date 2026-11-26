/**
 * Recovering the account when every owner passkey is lost: a recovery passkey (another device or a hardware key) asks
 * for the account's owners to be replaced by a new passkey, and the change can only be made 48 hours later. During
 * the wait you are told on every channel and can cancel from any signed-in device or from Telegram.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import * as Schema from "effect/Schema"
import { Address, RecoveryKeyId, RecoveryRequestId, SigningRequestId } from "../Ids.ts"
import { CeremonyOptions } from "../WebAuthn.ts"

/**
 * How long a recovery waits after it is asked for, in hours. The account's onchain policy enforces the same delay.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const RECOVERY_DELAY_HOURS = 48

/**
 * The recovery passkey set up on the account: being locked onchain, ready, or being removed.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RecoveryKey extends Schema.Class<RecoveryKey>("@bluechip/domain/recovery/Recovery/RecoveryKey")({
  id: RecoveryKeyId,
  /** Where it lives, such as "YubiKey" or "Google Password Manager on Android". */
  label: Schema.NullOr(Schema.String),
  status: Schema.Literals(["locking", "active", "removing"]),
  createdAt: Schema.DateTimeUtc
}) {}

/**
 * Where a recovery stands: its request on its way onchain, waiting out the delay, cancelled, being made, done, or
 * failed (an operation that didn't land).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const RecoveryStatus = Schema.Literals([
  "requesting",
  "waiting",
  "cancelled",
  "executing",
  "completed",
  "failed"
])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type RecoveryStatus = typeof RecoveryStatus.Type

/**
 * Who cancelled a recovery: a signed-in device, or a linked Telegram chat.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export const CancelledFrom = Schema.Literals(["app", "telegram"])

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type CancelledFrom = typeof CancelledFrom.Type

/**
 * One recovery: when it was asked for, when it can be made (once its request is onchain), and how it ended.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RecoveryRequest
  extends Schema.Class<RecoveryRequest>("@bluechip/domain/recovery/Recovery/RecoveryRequest")({
    id: RecoveryRequestId,
    status: RecoveryStatus,
    /** The new passkey that becomes the account's owner. */
    newPasskey: Schema.NullOr(Schema.String),
    requestedAt: Schema.DateTimeUtc,
    executableAt: Schema.NullOr(Schema.DateTimeUtc),
    cancelledAt: Schema.NullOr(Schema.DateTimeUtc),
    cancelledFrom: Schema.NullOr(CancelledFrom),
    executedAt: Schema.NullOr(Schema.DateTimeUtc)
  })
{}

/**
 * The account's recovery as its owner sees it: the recovery passkey, if one is set up, and the latest recovery.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class AccountRecovery
  extends Schema.Class<AccountRecovery>("@bluechip/domain/recovery/Recovery/AccountRecovery")({
    key: Schema.NullOr(RecoveryKey),
    request: Schema.NullOr(RecoveryRequest)
  })
{}

/**
 * Setting up or removing the recovery passkey, prepared for an owner passkey to sign.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RecoveryKeyChange
  extends Schema.Class<RecoveryKeyChange>("@bluechip/domain/recovery/Recovery/RecoveryKeyChange")({
    id: SigningRequestId,
    options: CeremonyOptions,
    action: Schema.Literals(["setup", "remove"]),
    key: RecoveryKey,
    deploysAccount: Schema.Boolean,
    expiresAt: Schema.DateTimeUtc
  })
{}

/**
 * The recovery as the person recovering sees it, signed in with the recovery passkey only: the account, and its
 * latest recovery.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class Recovering extends Schema.Class<Recovering>("@bluechip/domain/recovery/Recovery/Recovering")({
  account: Address,
  request: Schema.NullOr(RecoveryRequest)
}) {}

/**
 * A recovery step prepared for the recovery passkey to sign: asking for the recovery, or making it once due.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class RecoverySigning
  extends Schema.Class<RecoverySigning>("@bluechip/domain/recovery/Recovery/RecoverySigning")({
    id: RecoveryRequestId,
    options: CeremonyOptions,
    action: Schema.Literals(["request", "execute"]),
    expiresAt: Schema.DateTimeUtc
  })
{}

/**
 * Whether a waiting recovery can be made at `now`: its request is onchain and its delay has passed.
 *
 * **Example** (A recovery asked for two days ago)
 *
 * ```ts import.meta.vitest
 * import * as DateTime from "effect/DateTime"
 * import { isDue } from "@bluechip/domain/recovery/Recovery"
 *
 * isDue(
 *   { status: "waiting", executableAt: DateTime.makeUnsafe("2026-11-27T10:00:00Z") },
 *   DateTime.makeUnsafe("2026-11-27T10:00:00Z")
 * )
 * // => true
 * ```
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const isDue = (
  request: Pick<RecoveryRequest, "status" | "executableAt">,
  now: DateTime.Utc
): boolean =>
  request.status === "waiting" && request.executableAt !== null &&
  DateTime.isLessThanOrEqualTo(request.executableAt, now)

/**
 * Whether a recovery is still going: asked for, waiting, or being made. Only one may go at a time.
 *
 * @stability unstable
 * @category predicates
 * @since 0.0.0
 */
export const isOpen = (request: Pick<RecoveryRequest, "status">): boolean =>
  request.status === "requesting" || request.status === "waiting" || request.status === "executing"
