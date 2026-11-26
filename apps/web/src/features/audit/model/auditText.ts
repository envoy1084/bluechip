import type { AuditEvent, AuditType } from "@bluechip/domain/audit/Audit"
import type { IconName } from "@bluechip/ui/icons/icon"

/** The kinds of thing the log filters by, in its tabs' order and words, each with its icon. */
export const AUDIT_TYPES: ReadonlyArray<
  { readonly value: AuditType; readonly label: string; readonly icon: IconName }
> = [
  { value: "intent", label: "Trades", icon: "chart-line" },
  { value: "agent", label: "Agents", icon: "agent" },
  { value: "automation", label: "Automations", icon: "zap" },
  { value: "passkey", label: "Passkeys", icon: "key" },
  { value: "recovery", label: "Recovery", icon: "shield" },
  { value: "device", label: "Devices", icon: "desktop" },
  { value: "channel", label: "Chats", icon: "chat" }
]

const INTENT: Readonly<Record<string, string>> = {
  proposed: "A trade was proposed",
  deciding: "A trade was checked against its policies",
  waiting: "A trade is waiting",
  needsApproval: "A trade needs your approval",
  awaitingSignature: "A trade is waiting for your Face ID",
  sending: "A trade was sent",
  confirming: "A trade is confirming",
  filled: "A trade filled",
  failed: "A trade failed",
  blocked: "A policy stopped a trade",
  declined: "You declined a trade",
  expired: "A trade expired",
  cancelled: "A trade was cancelled"
}

const ACTIONS: Readonly<Record<string, (name: string) => string>> = {
  "agent.locking": (name) => `You locked ${name}'s policies with Face ID`,
  "agent.active": (name) => `${name}'s policies are in force onchain`,
  "agent.updating": (name) => `You changed ${name}'s policies with Face ID`,
  "agent.removing": (name) => `You removed ${name} with Face ID`,
  "agent.removed": (name) => `${name} was removed onchain`,
  "agent.expired": (name) => `${name}'s session ended`,
  "agent.paused": (name) => `${name} was paused`,
  "agent.resumed": (name) => `${name} was resumed`,
  "automation.created": () => "You made an automation",
  "automation.deleted": () => "You deleted an automation",
  "passkey.added": (label) => `${label} became one of your passkeys`,
  "passkey.removed": (label) => `${label} was removed from your passkeys`,
  "recovery.keySet": (label) => `${label} became your recovery key`,
  "recovery.keyRemoved": (label) => `${label} stopped being your recovery key`,
  "recovery.signedIn": () => "Someone signed in with your recovery key",
  "recovery.requested": () => "Your recovery key asked to recover your account",
  "recovery.cancelled": () => "A recovery was cancelled",
  "recovery.completed": () => "Your account was recovered with your recovery key",
  "device.signedIn": (device) => `${device} signed in`,
  "device.signedOut": (device) => `${device} was signed out`,
  "channel.linked": () => "A chat was linked",
  "channel.unlinked": () => "A chat was unlinked"
}

/** A string field of the event's `data`, when it has one. */
export const auditField = (event: AuditEvent, key: string): string | undefined => {
  const data = event.data
  if (data === null || typeof data !== "object" || Array.isArray(data)) return undefined
  const value = (data as Record<string, unknown>)[key]
  return typeof value === "string" ? value : undefined
}

/** One entry of the log in words: what happened, naming the agent, passkey or device it was about. */
export const describeAudit = (event: AuditEvent): string => {
  if (event.action.startsWith("intent.")) {
    return INTENT[event.action.slice("intent.".length)] ?? "A trade changed"
  }
  const named = auditField(event, "name") ?? auditField(event, "label") ?? auditField(event, "device")
  if (event.action === "device.signedOut" && auditField(event, "device") === undefined) {
    return "Every other device was signed out"
  }
  const describe = ACTIONS[event.action]
  return describe === undefined ? event.action : describe(named ?? "A passkey")
}

/** Who acted, in words: an agent by its name when `agentName` knows it (or the entry carries it). */
export const actorLabel = (event: AuditEvent, agentName: (id: string) => string | undefined = () => undefined) => {
  switch (event.actor) {
    case "owner":
      return "You"
    case "agent": {
      const id = event.actorId ?? event.agentId
      return (id === null ? undefined : agentName(id)) ?? auditField(event, "name") ?? "An agent"
    }
    case "assistant":
      return "The assistant"
    case "automation":
      return "An automation"
    case "system":
      return "bluechip"
  }
}

/** The kind of thing an entry is about, by its action's subject (`intent.filled` is an `intent`). */
export const auditTypeOf = (event: AuditEvent): AuditType | undefined =>
  AUDIT_TYPES.find((type) => event.action.startsWith(`${type.value}.`))?.value

/** How an entry reads at a glance: went well, went wrong, waits on you, or plain. */
export type AuditTone = "gain" | "loss" | "warn" | "plain"

const TONES: Readonly<Record<string, AuditTone>> = {
  "intent.filled": "gain",
  "intent.failed": "loss",
  "intent.blocked": "loss",
  "intent.needsApproval": "warn",
  "intent.awaitingSignature": "warn",
  "agent.active": "gain",
  "agent.removed": "loss",
  "passkey.added": "gain",
  "passkey.removed": "loss",
  "recovery.keySet": "gain",
  "recovery.signedIn": "warn",
  "recovery.requested": "warn",
  "recovery.completed": "warn",
  "channel.linked": "gain"
}

export const auditTone = (event: AuditEvent): AuditTone => TONES[event.action] ?? "plain"

/** Where an entry's subject lives in the app, and its name there. */
export type AuditSubject =
  | { readonly _tag: "Agent"; readonly agentId: string; readonly label: string }
  | { readonly _tag: "Trade"; readonly agentId: string | null; readonly label: string }
  | { readonly _tag: "Automation"; readonly automationId: string; readonly label: string }
  | { readonly _tag: "Security"; readonly label: string }
  | { readonly _tag: "Chats"; readonly label: string }

const PLATFORMS: Readonly<Record<string, string>> = { telegram: "Telegram" }

/** The thing an entry is about, to link to: its agent, trade, automation, security setting or chat. */
export const auditSubject = (
  event: AuditEvent,
  agentName: (id: string) => string | undefined = () => undefined
): AuditSubject | undefined => {
  const agentLabel = (id: string) => agentName(id) ?? auditField(event, "name") ?? "An agent"

  switch (auditTypeOf(event)) {
    case "intent": {
      const label = event.agentId === null ? "Your trade" : `${agentLabel(event.agentId)}'s trade`
      return { _tag: "Trade", agentId: event.agentId, label }
    }
    case "agent":
      return { _tag: "Agent", agentId: event.subjectId, label: agentLabel(event.subjectId) }
    case "automation":
      return { _tag: "Automation", automationId: event.subjectId, label: "Automation" }
    case "passkey":
      return { _tag: "Security", label: auditField(event, "label") ?? "Passkeys" }
    case "recovery":
      return { _tag: "Security", label: auditField(event, "label") ?? "Recovery" }
    case "device":
      return { _tag: "Security", label: auditField(event, "device") ?? "Devices" }
    case "channel": {
      const platform = auditField(event, "platform")
      return { _tag: "Chats", label: (platform === undefined ? undefined : PLATFORMS[platform]) ?? "Chats" }
    }
    case undefined:
      return undefined
  }
}

/** Whether an entry matches a search: every word of it in what happened, who did it or what it was about. */
export const matchesAuditSearch = (fields: ReadonlyArray<string>, search: string): boolean => {
  const haystack = fields.join(" ").toLowerCase()
  return search.toLowerCase().split(/\s+/).filter((word) => word !== "").every((word) => haystack.includes(word))
}
