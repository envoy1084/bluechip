/**
 * The catalog of notification kinds: how each is shown in settings, how much it matters, the channels it may use and
 * where it goes until you change it; and the rule that decides where a notification is delivered.
 *
 * @since 0.0.0
 */
import type { Channel, NotificationKind, NotificationRule, Severity } from "./Notification.ts"

/**
 * The settings page's sections.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type KindGroup = "trades" | "agents" | "automations" | "money" | "security" | "digest"

/**
 * One kind of notification: its words in settings, its severity, the channels it may use and its defaults. A
 * `locked` kind (your account's safety) always goes everywhere; a `digestable` one can wait for the daily digest.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface KindInfo {
  readonly kind: NotificationKind
  readonly group: KindGroup
  readonly label: string
  readonly description: string
  readonly severity: Severity
  readonly channels: ReadonlyArray<Channel>
  readonly defaults: { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean }
  readonly locked: boolean
  readonly digestable: boolean
}

const EVERYWHERE: ReadonlyArray<Channel> = ["inApp", "push", "telegram"]

const kind = (
  info: Omit<KindInfo, "channels" | "locked" | "digestable" | "defaults"> & {
    readonly channels?: ReadonlyArray<Channel>
    readonly defaults: ReadonlyArray<Channel>
    readonly digest?: boolean
    readonly digestable?: boolean
  }
): KindInfo => ({
  kind: info.kind,
  group: info.group,
  label: info.label,
  description: info.description,
  severity: info.severity,
  channels: info.channels ?? EVERYWHERE,
  defaults: { channels: info.defaults, digest: info.digest ?? false },
  locked: info.severity === "security",
  digestable: info.digestable ?? info.severity === "info"
})

/**
 * Every kind, in the order the settings page shows them.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const KINDS: ReadonlyArray<KindInfo> = [
  kind({
    kind: "approvalNeeded",
    group: "trades",
    label: "An agent needs your OK",
    description: "A trade over an agent's largest trade, or one an automation asks you about.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "approvalExpiring",
    group: "trades",
    label: "An approval is about to expire",
    description: "An hour before a trade waiting for your OK expires.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "intentBlocked",
    group: "trades",
    label: "A policy stopped a trade",
    description: "Which policy refused it, and why.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "intentFilled",
    group: "trades",
    label: "Trades done",
    description: "Each buy and sell your agents, the assistant and Telegram make, filled or failed.",
    severity: "info",
    defaults: ["inApp", "telegram"]
  }),
  kind({
    kind: "intentWaiting",
    group: "trades",
    label: "A trade waits too long",
    description: "An agent's trade still waiting after an hour: prices paused, gas, or Base not answering.",
    severity: "info",
    defaults: ["inApp", "telegram"]
  }),
  kind({
    kind: "agentPaused",
    group: "agents",
    label: "An agent was paused",
    description: "From any device, the assistant or Telegram.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "sessionEnding",
    group: "agents",
    label: "An agent's session is ending",
    description: "Seven days and one day before an agent needs your Face ID to keep trading.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "sessionRenewed",
    group: "agents",
    label: "An agent was renewed",
    description: "Its policies hold for another 90 days.",
    severity: "info",
    defaults: ["inApp"]
  }),
  kind({
    kind: "automationFired",
    group: "automations",
    label: "An automation ran",
    description: "What fired it and what it did, or the message it has for you.",
    severity: "info",
    defaults: ["inApp", "telegram"]
  }),
  kind({
    kind: "automationSkipped",
    group: "automations",
    label: "A judgment held an automation back",
    description: "When the model's answer to a question kept an automation from trading.",
    severity: "info",
    defaults: ["inApp", "telegram"],
    digest: true
  }),
  kind({
    kind: "deposit",
    group: "money",
    label: "Cash arrived",
    description: "USDC or ETH sent to your account.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "withdrawal",
    group: "money",
    label: "Withdrawals",
    description: "When a withdrawal lands, or fails.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "balanceUnexplained",
    group: "money",
    label: "Money moved outside bluechip",
    description: "Cash or a stock that arrived or left in a way no trade, deposit or withdrawal explains.",
    severity: "important",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "passkeyAdded",
    group: "security",
    label: "A new passkey",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "passkeyRemoved",
    group: "security",
    label: "A passkey was removed",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "newDevice",
    group: "security",
    label: "A new device signed in",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "recoveryKeyChanged",
    group: "security",
    label: "Your recovery key changed",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "recoveryRequested",
    group: "security",
    label: "Someone asked to recover your account",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "recoveryCancelled",
    group: "security",
    label: "A recovery was cancelled",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "recoveryCompleted",
    group: "security",
    label: "Your account was recovered",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "chatLinked",
    group: "security",
    label: "A chat was linked",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "chatUnlinked",
    group: "security",
    label: "A chat was unlinked",
    description: "Always on, on every channel.",
    severity: "security",
    defaults: EVERYWHERE
  }),
  kind({
    kind: "dailyDigest",
    group: "digest",
    label: "Daily digest",
    description: "One message each morning, 08:00 UTC, with what the digest held and your agents' day.",
    severity: "info",
    channels: ["inApp", "telegram"],
    defaults: ["inApp", "telegram"],
    digestable: false
  })
]

/**
 * The catalog entry of a kind.
 *
 * @stability unstable
 * @category catalog
 * @since 0.0.0
 */
export const kindOf = (kind: NotificationKind): KindInfo => KINDS.find((info) => info.kind === kind)!

/**
 * The rule in force for a kind: the one you saved, kept to the channels the kind may use, or its defaults. The center
 * (`inApp`) is always on; a locked kind goes everywhere and never waits for the digest.
 *
 * **Example** (A saved rule that asks for a channel the kind can't use)
 *
 * ```ts import.meta.vitest
 * import { ruleFor } from "@bluechip/domain/notifications/Kinds"
 *
 * ruleFor("dailyDigest", { channels: ["push"], digest: false })
 * // => { kind: "dailyDigest", channels: ["inApp"], digest: false }
 * ```
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const ruleFor = (
  kind: NotificationKind,
  saved?: { readonly channels: ReadonlyArray<Channel>; readonly digest: boolean } | undefined
): NotificationRule => {
  const info = kindOf(kind)
  if (info.locked) return { kind, channels: info.channels, digest: false }
  const wanted = saved ?? info.defaults
  return {
    kind,
    channels: info.channels.filter((channel) => channel === "inApp" || wanted.channels.includes(channel)),
    digest: info.digestable && wanted.digest
  }
}

/**
 * The channels a notification is delivered on now, beside the center: none while its kind waits for the digest.
 *
 * @stability unstable
 * @category rules
 * @since 0.0.0
 */
export const deliveryChannels = (rule: NotificationRule): ReadonlyArray<Exclude<Channel, "inApp">> =>
  rule.digest ? [] : rule.channels.filter((channel): channel is Exclude<Channel, "inApp"> => channel !== "inApp")
