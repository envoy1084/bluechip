import type { AuditEvent, AuditType } from "@bluechip/domain/audit/Audit"

/** The kinds of thing the log filters by, in its menu's order and words. */
export const AUDIT_TYPES: ReadonlyArray<{ readonly value: AuditType; readonly label: string }> = [
  { value: "intent", label: "Trades" },
  { value: "agent", label: "Agents" },
  { value: "automation", label: "Automations" },
  { value: "passkey", label: "Passkeys" },
  { value: "recovery", label: "Recovery" },
  { value: "device", label: "Devices" },
  { value: "channel", label: "Chats" }
]

const INTENT: Readonly<Record<string, string>> = {
  proposed: "A trade was proposed",
  deciding: "A trade was checked against its policies",
  waiting: "A trade is waiting",
  needsApproval: "A trade needs your OK",
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

const field = (event: AuditEvent, key: string): string | undefined => {
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
  const named = field(event, "name") ?? field(event, "label") ?? field(event, "device")
  if (event.action === "device.signedOut" && field(event, "device") === undefined) {
    return "Every other device was signed out"
  }
  const describe = ACTIONS[event.action]
  return describe === undefined ? event.action : describe(named ?? "A passkey")
}

/** Who acted, in words. */
export const actorLabel = (event: AuditEvent): string => {
  switch (event.actor) {
    case "owner":
      return "You"
    case "agent":
      return "An agent"
    case "assistant":
      return "The assistant"
    case "automation":
      return "An automation"
    case "system":
      return "bluechip"
  }
}
