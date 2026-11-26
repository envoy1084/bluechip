// The panel's account actions: named changes to the preview world, saved across reloads. Each puts the account in a
// state its screens show (you, passkeys and devices, recovery, chats and push, notifications, money in and out) and
// returns the live events the server would send for it.
import { Device, Eligibility, Passkey, User } from "@bluechip/domain/Account"
import { LiveEvent } from "@bluechip/domain/Events"
import type { PasskeyId, SessionId } from "@bluechip/domain/Ids"
import { notificationOfChatLink, notificationOfTransfer } from "@bluechip/domain/notifications/Drafts"
import { Notification, NotificationKind } from "@bluechip/domain/notifications/Notification"
import { notificationOfDevice, notificationOfRecovery } from "@bluechip/domain/notifications/SecurityDrafts"
import { isDue, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import * as DateTime from "effect/DateTime"
import { type ActionDef, defineAction } from "../../store.ts"
import type { AccountSlice } from "../../world/account.ts"
import {
  accountChanged,
  cancelRecovery,
  nextNumber,
  notify,
  portfolioChanged,
  record,
  settleWithdrawal
} from "../../world/account/changes.ts"
import { transferOf } from "../../world/account/history.ts"
import { sampleDraft, stockName } from "../../world/account/notifications.ts"
import {
  otherPushDevices,
  ownerPasskeys,
  PUSH_PUBLIC_KEY,
  recoveryKeyOf,
  signedInDevices,
  telegramLink,
  waitingRecovery
} from "../../world/account/security.ts"
import { previewId } from "../../world/ids.ts"

// A saved action's argument, read back as one of the choices it can be.
const oneOf = <A extends string>(value: unknown, options: ReadonlyArray<A>, fallback: A): A =>
  options.find((option) => option === value) ?? fallback

export const RECOVERY_STATES = ["none", "locking", "key", "waiting", "due", "cancelled", "completed"] as const
export type RecoveryState = typeof RECOVERY_STATES[number]

/** Where the account's recovery stands, as the panel offers it. */
export const recoveryState = (account: AccountSlice): RecoveryState => {
  const request = account.recovery
  if (request === null) {
    return account.recoveryKey === null ? "none" : account.recoveryKey.status === "active" ? "key" : "locking"
  }
  if (request.status === "waiting") return isDue(request, DateTime.nowUnsafe()) ? "due" : "waiting"
  if (request.status === "requesting") return "waiting"
  if (request.status === "executing") return "due"
  return request.status === "failed" ? "cancelled" : request.status
}

export const setRecovery = defineAction("account.recovery", (world, value) => {
  const account = world.account
  const state = oneOf(value, RECOVERY_STATES, "none")
  const now = new Date()

  account.recoveryKey = state === "none"
    ? null
    : recoveryKeyOf(world.now, 30, state === "locking" ? "locking" : "active")
  if (state === "none" || state === "locking" || state === "key") {
    account.recovery = null
    return [accountChanged()]
  }

  // Asked for 14 hours ago (34 hours left), or 48 and a half (due).
  const request = waitingRecovery(now, state === "due" ? 48 * 60 + 30 : 14 * 60, nextNumber(account))
  account.recovery = request
  if (state === "waiting") {
    return [accountChanged(), notify(account, notificationOfRecovery(request, { _tag: "Requested" }))]
  }
  if (state === "cancelled") return cancelRecovery(account, "telegram")
  if (state === "completed") {
    account.recovery = new RecoveryRequest({ ...request, status: "completed", executedAt: DateTime.nowUnsafe() })
  }
  return [accountChanged()]
})

export const PASSKEY_STATES = ["one", "several", "adding", "removing"] as const
export type PasskeysState = typeof PASSKEY_STATES[number]

export const passkeysState = (account: AccountSlice): PasskeysState =>
  account.passkeys.some((passkey) => passkey.status === "pending") ?
    "adding" :
    account.passkeys.some((passkey) => passkey.status === "removing") ?
    "removing" :
    account.passkeys.length <= 1 ?
    "one" :
    "several"

export const setPasskeys = defineAction("account.passkeys", (world, value) => {
  const state = oneOf(value, PASSKEY_STATES, "one")
  const passkeys = ownerPasskeys(world.cast, world.now, state === "one" ? 1 : state === "several" ? 4 : 3)

  if (state === "adding") {
    passkeys.push(
      new Passkey({
        id: previewId("passkey", nextNumber(world.account)) as PasskeyId,
        role: "owner",
        status: "pending",
        label: "Google Password Manager on Mac",
        synced: true,
        current: false,
        createdAt: DateTime.nowUnsafe(),
        lastUsedAt: null
      })
    )
  }
  if (state === "removing") passkeys[2] = new Passkey({ ...passkeys[2]!, status: "removing" })

  world.account.passkeys = passkeys
  return [accountChanged()]
})

export const setDevices = defineAction("account.devices", (world, value) => {
  world.account.devices = signedInDevices(
    world.cast,
    world.now,
    oneOf(value, ["one", "several"], "one") === "one" ? 1 : 5
  )
  return [accountChanged()]
})

/** A browser that never signed in before signs in: listed, logged and told. */
export const newDeviceSignsIn = defineAction("account.newDevice", (world) => {
  const account = world.account
  const device = new Device({
    id: previewId("session", nextNumber(account)) as SessionId,
    device: "Edge on Windows",
    passkey: account.passkeys[0]?.label ?? null,
    current: false,
    signedInAt: DateTime.nowUnsafe(),
    lastSeenAt: DateTime.nowUnsafe()
  })
  account.devices.splice(1, 0, device)
  record(account, {
    actor: "owner",
    action: "device.signedIn",
    subjectType: "session",
    subjectId: device.id,
    data: { device: device.device }
  })
  return [accountChanged(), notify(account, notificationOfDevice(device))]
})

export const setTelegram = defineAction("account.telegram", (world, linked) => {
  const account = world.account
  if (linked !== true) {
    const told = account.links.map((link) => notify(account, notificationOfChatLink(link, "unlinked")))
    account.links = []
    return told
  }
  if (account.links.length > 0) return []

  const link = telegramLink(new Date(), 0, world.cast.displayName, nextNumber(account))
  account.links = [link]
  record(account, {
    actor: "owner",
    action: "channel.linked",
    subjectType: "channelLink",
    subjectId: link.id,
    data: { platform: link.platform }
  })
  return [notify(account, notificationOfChatLink(link, "linked"))]
})

export const PUSH_STATES = ["unavailable", "none", "one", "two"] as const
export type PushState = typeof PUSH_STATES[number]

/** Push as the panel offers it: not set up on the server, or how many other devices get it. */
export const pushState = (account: AccountSlice): PushState =>
  account.pushKey === null ? "unavailable" : (["none", "one", "two"] as const)[Math.min(account.pushDevices.length, 2)]!

export const setPush = defineAction("account.push", (world, value) => {
  const state = oneOf(value, PUSH_STATES, "none")
  world.account.pushKey = state === "unavailable" ? null : PUSH_PUBLIC_KEY
  world.account.pushDevices = otherPushDevices(world.now, state === "two" ? 2 : state === "one" ? 1 : 0)
})

export const setQuietHours = defineAction("account.quietHours", (world, on) => {
  world.account.quietHours = on === true ? { from: "22:00", to: "07:00" } : null
})

/** A notification of `kind`, worded as the server would, now. */
export const addNotification = defineAction("account.notify", (world, kind, read) => {
  const draft = sampleDraft(
    oneOf(kind, NotificationKind.literals, "intentFilled"),
    world.cast,
    new Date(),
    nextNumber(world.account)
  )
  return [notify(world.account, draft, read === true)]
})

export const markAllRead = defineAction("account.readAll", (world) => {
  const now = DateTime.nowUnsafe()
  world.account.notifications = world.account.notifications.map((notification) =>
    notification.readAt === null ? new Notification({ ...notification, readAt: now }) : notification
  )
})

export const clearNotifications = defineAction("account.clearNotifications", (world) => {
  world.account.notifications = []
})

/** A withdrawal of $250 sent now (`pending`), or the newest one on its way landing or failing. */
export const withdrawal = defineAction("account.withdrawal", (world, value) => {
  const account = world.account
  const status = oneOf(value, ["pending", "confirmed", "failed"], "pending")
  const pending = account.transfers.find((transfer) => transfer.kind === "withdrawal" && transfer.status === "pending")

  if (status !== "pending" && pending !== undefined) return settleWithdrawal(account, pending.id, status)

  const sent = transferOf(nextNumber(account), "withdrawal", 250, "pending", DateTime.nowUnsafe())
  account.transfers.unshift(sent)
  account.deployed = true
  const events: Array<LiveEvent> = [LiveEvent.cases.TransferUpdated.make({ transfer: sent }), portfolioChanged()]
  return status === "pending" ? events : [...events, ...settleWithdrawal(account, sent.id, status)]
})

/** `dollars` of USDC arrives from your wallet, as reconciliation sees a deposit. */
export const deposit = defineAction("account.deposit", (world, dollars) => {
  const account = world.account
  const arrived = transferOf(
    nextNumber(account),
    "deposit",
    typeof dollars === "number" ? dollars : 500,
    "confirmed",
    DateTime.nowUnsafe()
  )
  account.transfers.unshift(arrived)
  return [portfolioChanged(), notify(account, notificationOfTransfer(arrived, stockName)!)]
})

export const setDisplayName = defineAction("account.displayName", (world, name) => {
  world.account.user = new User({ ...world.account.user, displayName: typeof name === "string" ? name : null })
  return [accountChanged()]
})

export const setEligibility = defineAction("account.eligibility", (world, value) => {
  world.account.user = new User({
    ...world.account.user,
    eligibility: oneOf(value, Eligibility.literals, "outsideUs")
  })
  return [accountChanged()]
})

export const setDeployed = defineAction("account.deployed", (world, deployed) => {
  world.account.deployed = deployed === true
  return [accountChanged()]
})

export const ACCOUNT_ACTIONS: ReadonlyArray<ActionDef> = [
  setRecovery,
  setPasskeys,
  setDevices,
  newDeviceSignsIn,
  setTelegram,
  setPush,
  setQuietHours,
  addNotification,
  markAllRead,
  clearNotifications,
  withdrawal,
  deposit,
  setDisplayName,
  setEligibility,
  setDeployed
].map((action) => action.def)
