// How notifications read in the app: when, which channel, which section of settings, and a device's name.
import { type KindGroup, type KindInfo, KINDS } from "@bluechip/domain/notifications/Kinds"
import type { Channel, NotificationRule } from "@bluechip/domain/notifications/Notification"
import * as DateTime from "effect/DateTime"

/** When a notification came, as people say it: "Just now", "5 min ago", "3 h ago", "Yesterday", "24 Nov". */
export const timeAgo = (at: DateTime.Utc, now: DateTime.Utc): string => {
  const minutes = Math.floor((DateTime.toEpochMillis(now) - DateTime.toEpochMillis(at)) / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`
  if (minutes < 48 * 60) return "Yesterday"
  return DateTime.toDateUtc(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  inApp: "In app",
  push: "Push",
  telegram: "Telegram"
}

const GROUPS: ReadonlyArray<{ readonly group: KindGroup; readonly title: string; readonly description: string }> = [
  { group: "trades", title: "Trades", description: "Approvals, trades done and the ones a policy stopped." },
  { group: "agents", title: "Agents", description: "Pauses, renewals and sessions about to end." },
  { group: "automations", title: "Automations", description: "Runs, and the judgments that held one back." },
  { group: "money", title: "Money", description: "Cash arriving and withdrawals." },
  { group: "security", title: "Security", description: "Always on, on every channel, through quiet hours." },
  { group: "digest", title: "Daily digest", description: "What the digest held back, in one message each morning." }
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
