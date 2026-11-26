// How notifications read in the app: when, which channel, which section of settings, and a device's name.
import { type KindGroup, type KindInfo, KINDS } from "@bluechip/domain/notifications/Kinds"
import type { Channel, Notification, NotificationRule } from "@bluechip/domain/notifications/Notification"
import type { IllustrationName } from "@bluechip/ui/illustrations/illustration"
import { formatDate, formatTime } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { dayHeading, localTimeZone } from "../../../lib/localTime.ts"

/**
 * When a notification came, in the viewer's zone: "Just now" and "5 min ago" for the last hour, then the clock time
 * today ("14:05"), "Yesterday, 14:05", and the date before that ("Tue 24 Nov, 14:05").
 */
export const notificationTime = (at: DateTime.Utc, now: DateTime.Utc, timeZone = localTimeZone()): string => {
  const minutes = Math.floor((DateTime.toEpochMillis(now) - DateTime.toEpochMillis(at)) / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  const date = DateTime.toDateUtc(at)
  const day = dayHeading(at, DateTime.toDateUtc(now), timeZone)
  if (day === "Today") return formatTime(date, { timeZone })
  if (day === "Yesterday") return `Yesterday, ${formatTime(date, { timeZone })}`
  return formatDate(date, { timeZone })
}

/** The bell's list in two parts, newest first in each: what came today (in the viewer's zone), then earlier. */
export const notificationDays = <A extends Pick<Notification, "createdAt">>(
  notifications: ReadonlyArray<A>,
  now: DateTime.Utc,
  timeZone = localTimeZone()
): ReadonlyArray<{ readonly title: "Today" | "Earlier"; readonly notifications: ReadonlyArray<A> }> => {
  const today = notifications.filter((notification) =>
    dayHeading(notification.createdAt, DateTime.toDateUtc(now), timeZone) === "Today"
  )
  const earlier = notifications.filter((notification) => !today.includes(notification))
  return [
    ...(today.length === 0 ? [] : [{ title: "Today" as const, notifications: today }]),
    ...(earlier.length === 0 ? [] : [{ title: "Earlier" as const, notifications: earlier }])
  ]
}

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  inApp: "In app",
  push: "Push",
  telegram: "Telegram"
}

const GROUPS: ReadonlyArray<
  {
    readonly group: KindGroup
    readonly title: string
    readonly description: string
    readonly illustration: IllustrationName
  }
> = [
  {
    group: "trades",
    title: "Trades",
    description: "Approvals, trades done and the ones a policy stopped.",
    illustration: "certificate"
  },
  {
    group: "agents",
    title: "Agents",
    description: "Pauses, renewals and sessions about to end.",
    illustration: "butterfly"
  },
  {
    group: "automations",
    title: "Automations",
    description: "Runs, and the judgments that held one back.",
    illustration: "bolt"
  },
  { group: "money", title: "Money", description: "Cash arriving and withdrawals.", illustration: "wallet" },
  {
    group: "security",
    title: "Security",
    description: "Always on, on every channel, through quiet hours.",
    illustration: "shield"
  },
  {
    group: "digest",
    title: "Daily digest",
    description: "What the digest held back, in one message each morning.",
    illustration: "sun"
  }
]

/** The settings page's sections, each with its kinds and the rule in force for each. */
export const settingsSections = (rules: ReadonlyArray<NotificationRule>) =>
  GROUPS.map((section) => ({
    ...section,
    kinds: KINDS.filter((info) => info.group === section.group).map((info) => ({
      info,
      rule: rules.find((rule) => rule.kind === info.kind) ?? { kind: info.kind, ...info.defaults }
    }))
  }))

/** A rule with one channel turned on or off (the center stays on). */
export const withChannel = (
  rule: NotificationRule,
  channel: Channel,
  on: boolean
): { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean } => ({
  channels: on ?
    [...new Set([...rule.channels, channel])] :
    rule.channels.filter((existing) => existing !== channel || channel === "inApp"),
  digest: rule.digest
})

/** Whether a kind's switch for a channel can be changed: never the center or a locked kind. */
export const isChangeable = (info: KindInfo, channel: Channel): boolean =>
  !info.locked && channel !== "inApp" && info.channels.includes(channel)

/** A browser as settings names it, from its user agent: "Chrome on Mac", "Safari on iPhone". */
export const deviceName = (userAgent: string): string => {
  const browser = /Edg\//.test(userAgent) ?
    "Edge" :
    /Firefox\//.test(userAgent) ?
    "Firefox" :
    /Chrome\//.test(userAgent) ?
    "Chrome" :
    /Safari\//.test(userAgent) ?
    "Safari" :
    "A browser"
  const system = /iPhone/.test(userAgent) ?
    "iPhone" :
    /iPad/.test(userAgent) ?
    "iPad" :
    /Android/.test(userAgent) ?
    "Android" :
    /Mac OS X/.test(userAgent) ?
    "Mac" :
    /Windows/.test(userAgent) ?
    "Windows" :
    /Linux/.test(userAgent) ?
    "Linux" :
    null
  return system === null ? browser : `${browser} on ${system}`
}
