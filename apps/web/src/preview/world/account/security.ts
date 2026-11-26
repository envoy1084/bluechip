// The account's made-up security records: the user, the passkeys that own the account, the devices signed in, the
// recovery key and recovery, the chats linked and the devices that get push, sized to the scenario.
import { Device, Passkey, User } from "@bluechip/domain/Account"
import { ChannelLink } from "@bluechip/domain/channels/Channel"
import type {
  ChannelLinkId,
  PasskeyId,
  PushSubscriptionId,
  RecoveryKeyId,
  RecoveryRequestId,
  SessionId
} from "@bluechip/domain/Ids"
import { PushDevice } from "@bluechip/domain/push/Push"
import { RECOVERY_DELAY_HOURS, RecoveryKey, RecoveryRequest } from "@bluechip/domain/recovery/Recovery"
import * as DateTime from "effect/DateTime"
import type { Cast } from "../cast.ts"
import { previewId } from "../ids.ts"

/** A made-up VAPID public key (a P-256 point), so the browser can subscribe to push in preview. */
export const PUSH_PUBLIC_KEY = "BPkh8ixkxwMfIfcSqLQzFbMk3o-1Mc1GFjPHZJviZlKA8jaVYe3GUfDBIVbFZYJq8t-67Qmit6o1em8IrzD3tUk"

/** `minutes` before `now`. */
export const minutesAgo = (now: Date, minutes: number): DateTime.Utc =>
  DateTime.fromDateUnsafe(new Date(now.getTime() - minutes * 60_000))

const DAY = 24 * 60

/** How many days ago the scenario's person signed up: a little before their oldest agent (the day before, when new). */
export const accountAgeDays = (cast: Cast): number =>
  cast.agents.length === 0 ?
    0 :
    Math.max(...cast.agents.map((agent) => agent.ageDays)) + (cast.scenario === "starter" ? 1 : 5)

const PASSKEYS: ReadonlyArray<{ readonly label: string; readonly synced: boolean; readonly usedMinutesAgo: number }> = [
  { label: "iCloud Keychain on Mac", synced: true, usedMinutesAgo: 3 },
  { label: "iCloud Keychain on iPhone", synced: true, usedMinutesAgo: 5 * 60 },
  { label: "YubiKey 5C", synced: false, usedMinutesAgo: 9 * DAY },
  { label: "Google Password Manager on Android", synced: true, usedMinutesAgo: 2 * DAY }
]

/**
 * The account's first `count` owner passkeys (up to four), all active: the first is this device's, which signed in
 * the tab's session.
 */
export const ownerPasskeys = (cast: Cast, now: Date, count: number): Array<Passkey> => {
  const age = accountAgeDays(cast)
  return PASSKEYS.slice(0, count).map((passkey, index) =>
    new Passkey({
      id: previewId("passkey", index + 1) as PasskeyId,
      role: "owner",
      status: "active",
      label: passkey.label,
      synced: passkey.synced,
      current: index === 0,
      createdAt: minutesAgo(now, index === 0 ? Math.max(age * DAY, 12) : Math.max(age - 12 * index, 1) * DAY),
      lastUsedAt: minutesAgo(now, passkey.usedMinutesAgo)
    })
  )
}

const DEVICES: ReadonlyArray<{ readonly device: string; readonly passkey: number; readonly seenMinutesAgo: number }> = [
  { device: "Chrome on Mac", passkey: 0, seenMinutesAgo: 0 },
  { device: "Safari on iPhone", passkey: 1, seenMinutesAgo: 40 },
  { device: "Firefox on Windows", passkey: 2, seenMinutesAgo: 6 * DAY },
  { device: "Chrome on Android", passkey: 3, seenMinutesAgo: 2 * DAY },
  { device: "Safari on iPad", passkey: 1, seenMinutesAgo: 11 * DAY }
]

/** The first `count` devices signed in (up to five), this browser first. */
export const signedInDevices = (cast: Cast, now: Date, count: number): Array<Device> => {
  const age = accountAgeDays(cast)
  return DEVICES.slice(0, count).map((device, index) =>
    new Device({
      id: previewId("session", index + 1) as SessionId,
      device: device.device,
      passkey: PASSKEYS[device.passkey]!.label,
      current: index === 0,
      signedInAt: minutesAgo(now, index === 0 ? 2 * DAY : Math.max(age - 10 * index, 1) * DAY),
      lastSeenAt: minutesAgo(now, device.seenMinutesAgo)
    })
  )
}

/** The recovery key on a hardware key, ready since `daysAgo`. */
export const recoveryKeyOf = (now: Date, daysAgo: number, status: RecoveryKey["status"] = "active"): RecoveryKey =>
  new RecoveryKey({
    id: previewId("recoverykey", 1) as RecoveryKeyId,
    label: "YubiKey 5 NFC",
    status,
    createdAt: minutesAgo(now, daysAgo * DAY)
  })

/** A recovery asked for `minutesAgo` minutes before `now`, waiting out its 48 hours. */
export const waitingRecovery = (now: Date, askedMinutesAgo: number, n = 1): RecoveryRequest => {
  const requestedAt = minutesAgo(now, askedMinutesAgo)
  return new RecoveryRequest({
    id: previewId("recovery", n) as RecoveryRequestId,
    status: "waiting",
    newPasskey: "Chrome on Windows",
    requestedAt,
    executableAt: DateTime.add(requestedAt, { hours: RECOVERY_DELAY_HOURS }),
    cancelledAt: null,
    cancelledFrom: null,
    executedAt: null
  })
}

/** The Telegram chat linked `daysAgo`, under `name`. */
export const telegramLink = (now: Date, daysAgo: number, name: string | null, n = 1): ChannelLink =>
  new ChannelLink({
    id: previewId("channellink", n) as ChannelLinkId,
    platform: "telegram",
    name,
    linkedAt: minutesAgo(now, daysAgo * DAY)
  })

const PUSH: ReadonlyArray<{ readonly device: string; readonly endpoint: string }> = [
  { device: "Safari on iPhone", endpoint: "https://web.push.apple.com/QPreviewIphoneSubscription" },
  { device: "Chrome on Android", endpoint: "https://fcm.googleapis.com/fcm/send/preview-android-subscription" }
]

/** The first `count` other devices that get push (up to two). */
export const otherPushDevices = (now: Date, count: number): Array<PushDevice> =>
  PUSH.slice(0, count).map((device, index) =>
    new PushDevice({
      id: previewId("pushsub", index + 1) as PushSubscriptionId,
      device: device.device,
      endpoint: device.endpoint,
      createdAt: minutesAgo(now, (20 - index * 7) * DAY)
    })
  )

/** The security records a scenario starts with. */
export interface Security {
  readonly user: User
  readonly passkeys: Array<Passkey>
  readonly devices: Array<Device>
  readonly recoveryKey: RecoveryKey | null
  readonly recovery: RecoveryRequest | null
  readonly links: Array<ChannelLink>
  readonly pushDevices: Array<PushDevice>
}

export const makeSecurity = (cast: Cast, now: Date): Security => {
  const age = accountAgeDays(cast)
  const size = cast.scenario === "heavy" ? "heavy" : cast.scenario === "typical" ? "typical" : "new"

  return {
    user: new User({
      id: cast.userId,
      displayName: cast.displayName,
      eligibility: "outsideUs",
      timeZone: size === "heavy" ? "America/New_York" : size === "typical" ? "Europe/London" : null,
      createdAt: minutesAgo(now, Math.max(age * DAY, 12))
    }),
    passkeys: ownerPasskeys(cast, now, size === "heavy" ? 4 : size === "typical" ? 2 : 1),
    devices: signedInDevices(cast, now, size === "heavy" ? 5 : size === "typical" ? 2 : 1),
    recoveryKey: size === "heavy" ? recoveryKeyOf(now, age - 20) : null,
    recovery: size === "heavy" ? waitingRecovery(now, 14 * 60) : null,
    links: size === "heavy" ? [telegramLink(now, age - 30, "Sam")] : [],
    pushDevices: otherPushDevices(now, size === "heavy" ? 2 : size === "typical" ? 1 : 0)
  }
}
