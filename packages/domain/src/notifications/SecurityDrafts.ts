/**
 * Your account's safety in words: a passkey added or removed, a new device signed in, the recovery key set up or
 * removed, and a recovery asked for, cancelled or made. Every one is a security notification, on every channel.
 *
 * @since 0.0.0
 */
import * as DateTime from "effect/DateTime"
import type { CancelledFrom } from "../recovery/Recovery.ts"
import type { NotificationDraft } from "./Notification.ts"

/**
 * Where the account's security settings are.
 *
 * @stability unstable
 * @category links
 * @since 0.0.0
 */
export const SECURITY_LINK = "/settings/security"

const named = (label: string | null) => label ?? "A passkey"

const dueFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC"
})

/**
 * A passkey that became one of the account's owners, or stopped being one.
 *
 * **Example** (A YubiKey added)
 *
 * ```ts import.meta.vitest
 * import { notificationOfPasskey } from "@bluechip/domain/notifications/SecurityDrafts"
 *
 * notificationOfPasskey({ id: "passkey_01", label: "YubiKey" }, true).title
 * // => "YubiKey can now sign for your account"
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfPasskey = (
  passkey: { readonly id: string; readonly label: string | null },
  added: boolean
): NotificationDraft =>
  added ?
    {
      kind: "passkeyAdded",
      title: `${named(passkey.label)} can now sign for your account`,
      body: "It signs in and approves with Face ID like your other passkeys. Remove it in Settings if this wasn't you.",
      link: SECURITY_LINK,
      subjectType: "passkey",
      subjectId: passkey.id,
      dedupeKey: `passkeyAdded:${passkey.id}`
    } :
    {
      kind: "passkeyRemoved",
      title: `${named(passkey.label)} was removed`,
      body: "It can no longer sign in or approve anything for your account.",
      link: SECURITY_LINK,
      subjectType: "passkey",
      subjectId: passkey.id,
      dedupeKey: `passkeyRemoved:${passkey.id}`
    }

/**
 * A sign-in from a device that hadn't signed in before.
 *
 * **Example** (A new browser)
 *
 * ```ts import.meta.vitest
 * import { notificationOfDevice } from "@bluechip/domain/notifications/SecurityDrafts"
 *
 * notificationOfDevice({ id: "session_01", device: "Chrome on Windows" }).title
 * // => "Chrome on Windows signed in"
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfDevice = (session: { readonly id: string; readonly device: string }): NotificationDraft => ({
  kind: "newDevice",
  title: `${session.device} signed in`,
  body: "A device that hadn't signed in before is now signed in to your account. Sign it out in Settings if this " +
    "wasn't you.",
  link: SECURITY_LINK,
  subjectType: "session",
  subjectId: session.id,
  dedupeKey: `newDevice:${session.id}`
})

/**
 * The recovery key set up, or removed.
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfRecoveryKey = (
  key: { readonly id: string; readonly label: string | null },
  set: boolean
): NotificationDraft => ({
  kind: "recoveryKeyChanged",
  title: set ? "Your recovery key is ready" : "Your recovery key was removed",
  body: set ?
    `${named(key.label)} can recover your account if you lose every passkey, 48 hours after it asks.` :
    "Without a recovery key, losing every passkey means losing access to your account. Set one up in Settings.",
  link: SECURITY_LINK,
  subjectType: "recoveryKey",
  subjectId: key.id,
  dedupeKey: `recoveryKeyChanged:${key.id}:${set ? "set" : "removed"}`
})

/**
 * A recovery of the account: asked for with the recovery key (it can be made at `executableAt`), cancelled, or made.
 *
 * **Example** (Asked for)
 *
 * ```ts import.meta.vitest
 * import * as DateTime from "effect/DateTime"
 * import { notificationOfRecovery } from "@bluechip/domain/notifications/SecurityDrafts"
 *
 * notificationOfRecovery(
 *   { id: "recovery_01", executableAt: DateTime.makeUnsafe("2026-11-29T10:00:00Z") },
 *   { _tag: "Requested" }
 * ).body
 * // => "Your recovery key asked to replace your passkeys with a new one. It can happen from Sun 29 Nov, 10:00 UTC. If this wasn't you, cancel it now."
 * ```
 *
 * @stability unstable
 * @category drafts
 * @since 0.0.0
 */
export const notificationOfRecovery = (
  request: { readonly id: string; readonly executableAt: DateTime.Utc | null },
  event:
    | { readonly _tag: "Requested" }
    | { readonly _tag: "Cancelled"; readonly from: CancelledFrom }
    | { readonly _tag: "Completed" }
): NotificationDraft => {
  const base = { link: SECURITY_LINK, subjectType: "recovery", subjectId: request.id }
  switch (event._tag) {
    case "Requested": {
      const due = request.executableAt === null ?
        "in 48 hours" :
        `from ${dueFormat.format(DateTime.toDateUtc(request.executableAt)).replace(" at ", ", ")} UTC`
      return {
        ...base,
        kind: "recoveryRequested",
        title: "Someone asked to recover your account",
        body: `Your recovery key asked to replace your passkeys with a new one. It can happen ${due}. ` +
          "If this wasn't you, cancel it now.",
        dedupeKey: `recoveryRequested:${request.id}`
      }
    }
    case "Cancelled":
      return {
        ...base,
        kind: "recoveryCancelled",
        title: "The recovery was cancelled",
        body: event.from === "telegram" ?
          "It was cancelled from Telegram. Your passkeys stay as they are." :
          "It was cancelled from a signed-in device. Your passkeys stay as they are.",
        dedupeKey: `recoveryCancelled:${request.id}`
      }
    case "Completed":
      return {
        ...base,
        kind: "recoveryCompleted",
        title: "Your account was recovered",
        body: "A new passkey now owns your account and your old passkeys were removed.",
        dedupeKey: `recoveryCompleted:${request.id}`
      }
  }
}
