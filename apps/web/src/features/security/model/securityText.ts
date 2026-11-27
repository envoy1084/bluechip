import type { Device, Passkey } from "@bluechip/domain/Account"
import { Conflict, SignatureRejected, Unavailable } from "@bluechip/domain/Errors"
import { type AccountRecovery, isDue } from "@bluechip/domain/recovery/Recovery"
import { formatDate } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { passkeyProblem } from "../../../lib/passkeyProblem.ts"
import { unavailableProblem } from "../../../lib/unavailableProblem.ts"

const dated = (date: DateTime.Utc, timeZone: string) =>
  DateTime.toDateUtc(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone })

const day = (date: DateTime.Utc, timeZone: string) => formatDate(DateTime.toDateUtc(date), { time: false, timeZone })

const dayAndTime = (date: DateTime.Utc, timeZone: string) => formatDate(DateTime.toDateUtc(date), { timeZone })

/** How long until a moment, roughly: "in 34 h", "in 20 min", "in 2 days". */
const until = (at: DateTime.Utc, now: DateTime.Utc): string => {
  const minutes = Math.ceil((DateTime.toEpochMillis(at) - DateTime.toEpochMillis(now)) / 60_000)
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.round(minutes / 60)
  return hours < 48 ? `in ${hours} h` : `in ${Math.round(hours / 24)} days`
}

/** A passkey's line under its name: where it works, when it was added and last used, or where its change stands. */
export const passkeyDescription = (passkey: Passkey, timeZone: string): string => {
  if (passkey.status === "pending") return "Being added. Base takes it in a few seconds."
  if (passkey.status === "removing") return "Being removed. Base takes it in a few seconds."
  const where = passkey.synced ? "Synced to your other devices" : "On one device only"
  const used = passkey.lastUsedAt === null ? "" : `, last used ${dated(passkey.lastUsedAt, timeZone)}`
  return `${where}, added ${dated(passkey.createdAt, timeZone)}${used}`
}

/** A device's line under its name: the passkey it signed in with and when it was last seen. */
export const deviceDescription = (device: Device, timeZone: string): string => {
  const seen = `last seen ${dayAndTime(device.lastSeenAt, timeZone)}`
  return device.passkey === null ? `Signed in, ${seen}` : `Signed in with ${device.passkey}, ${seen}`
}

/** What the recovery card says: the recovery passkey and the recovery under way, if any. */
interface RecoveryText {
  readonly title: string
  readonly description: string
  /** A recovery is waiting out its delay, or past it: the card offers to cancel it. */
  readonly cancellable: boolean
  /** How the latest recovery ended when it was cancelled, so a cancel from Telegram leaves a trace; else `null`. */
  readonly cancelled: string | null
}

/** The recovery card's words for the account's recovery at `now`. */
export const recoveryText = (recovery: AccountRecovery, now: DateTime.Utc, timeZone: string): RecoveryText => {
  const { key, request } = recovery
  if (request?.status === "waiting") {
    const asked = `Your recovery key asked on ${day(request.requestedAt, timeZone)} to replace your passkeys with ` +
      `${request.newPasskey ?? "a new one"}.`
    if (isDue(request, now)) {
      return {
        title: "Someone can recover your account now",
        description: `${asked} Its 48 hours are up, so it can go through now. Cancel it if this wasn't you.`,
        cancellable: true,
        cancelled: null
      }
    }
    const due = request.executableAt === null ?
      "in 48 hours, once Base has the request" :
      `on ${dayAndTime(request.executableAt, timeZone)}, ${until(request.executableAt, now)}`
    return {
      title: "Someone asked to recover your account",
      description: `${asked} It can go through ${due}. Cancel it if this wasn't you.`,
      cancellable: true,
      cancelled: null
    }
  }
  if (request?.status === "requesting" || request?.status === "executing") {
    return {
      title: request.status === "requesting" ? "A recovery is being asked for" : "Your account is being recovered",
      description: "Base takes it in a few seconds.",
      cancellable: false,
      cancelled: null
    }
  }

  const cancelled = request?.status === "cancelled" && request.cancelledAt !== null ?
    `A recovery asked for on ${day(request.requestedAt, timeZone)} was cancelled ${
      request.cancelledFrom === "telegram" ? "from Telegram" : "in the app"
    } on ${dayAndTime(request.cancelledAt, timeZone)}.` :
    null
  if (key === null) {
    return {
      title: "No recovery key yet",
      description: "Keep one on another device or a hardware key. If it ever asks to recover your account, you " +
        "have 48 hours to cancel.",
      cancellable: false,
      cancelled
    }
  }
  if (key.status === "locking") {
    return {
      title: "Locking your recovery key",
      description: "It's ready once Base takes it.",
      cancellable: false,
      cancelled
    }
  }
  if (key.status === "removing") {
    return {
      title: "Removing your recovery key",
      description: "Base takes it in a few seconds.",
      cancellable: false,
      cancelled
    }
  }
  return {
    title: key.label ?? "Recovery key",
    description: `Ready since ${dated(key.createdAt, timeZone)}. It can replace your passkeys 48 hours after it ` +
      "asks, and you're told on every channel so you can cancel.",
    cancellable: false,
    cancelled
  }
}

const CONFLICTS: Partial<Record<Conflict["reason"], string>> = {
  lastPasskey: "This is the account's only passkey. Add another one before you remove it.",
  passkeyBusy: "This passkey has another change on its way. Try again once it lands.",
  recoveryKeyExists: "Your account already has a recovery key. Remove it first to set up another.",
  noRecoveryKey: "Your account has no recovery key ready.",
  recoveryPending: "A recovery is on its way. Try again once it lands.",
  noRecoveryRequest: "There's no recovery waiting to be cancelled.",
  agentBusy: "An agent has another change on its way. Try again once it lands."
}

/** Why a change didn't start, in words: nothing changed onchain. */
export const changeProblem = (error: unknown): string => {
  if (error instanceof Conflict) return CONFLICTS[error.reason] ?? "Something else changed first. Try again."
  if (error instanceof SignatureRejected) {
    return error.reason === "unknownPasskey" ?
      "That passkey doesn't sign for this account. Use one of its passkeys." :
      "The passkey's answer didn't check out. Nothing changed. Try again."
  }
  if (error instanceof Unavailable) return unavailableProblem(error)
  return passkeyProblem(error, "Nothing changed.").text
}
