// The account's made-up history: the audit log (what you, your agents and bluechip did, from the cast's agents,
// automations and security records) and the deposits and withdrawals, newest first.
import { AuditEvent } from "@bluechip/domain/audit/Audit"
import type { AuditEventId, TransferId, TxHash } from "@bluechip/domain/Ids"
import { Transfer } from "@bluechip/domain/portfolio/Transfer"
import * as DateTime from "effect/DateTime"
import { ACCOUNT_ADDRESS, type Cast } from "../cast.ts"
import { previewId } from "../ids.ts"
import { OWN_WALLET } from "./notifications.ts"
import { accountAgeDays, minutesAgo, type Security } from "./security.ts"

const DAY = 24 * 60

/** An audit entry before it has an id: who did what to what, and when. */
export type AuditEntry = Omit<AuditEvent, "id">

/** The audit entry of `entry`, the `n`th of the account. */
export const auditOf = (entry: AuditEntry, n: number): AuditEvent =>
  new AuditEvent({ ...entry, id: previewId("audit", n) as AuditEventId })

const owner = (
  action: string,
  subjectType: string,
  subjectId: string,
  data: AuditEntry["data"],
  at: DateTime.Utc,
  agentId: string | null = null
): AuditEntry => ({ actor: "owner", actorId: null, action, subjectType, subjectId, agentId, data, at })

const system = (
  action: string,
  subjectType: string,
  subjectId: string,
  data: AuditEntry["data"],
  at: DateTime.Utc,
  agentId: string | null
) => ({ ...owner(action, subjectType, subjectId, data, at, agentId), actor: "system" as const })

/** The audit log a scenario starts with, newest first. */
export const makeAudit = (cast: Cast, now: Date, security: Security): Array<AuditEvent> => {
  const entries: Array<AuditEntry> = []
  const age = accountAgeDays(cast)

  for (const device of security.devices) {
    entries.push(owner("device.signedIn", "session", device.id, { device: device.device }, device.signedInAt))
  }
  for (const passkey of security.passkeys.slice(1)) {
    entries.push(owner("passkey.added", "passkey", passkey.id, { label: passkey.label }, passkey.createdAt))
  }
  if (security.recoveryKey !== null) {
    const key = security.recoveryKey
    entries.push(owner("recovery.keySet", "recoveryKey", key.id, { label: key.label }, key.createdAt))
  }
  if (security.recovery !== null) {
    const request = security.recovery
    entries.push(owner("recovery.signedIn", "passkey", previewId("passkey", 99), {}, request.requestedAt))
    entries.push({
      ...owner("recovery.requested", "recovery", request.id, {}, DateTime.add(request.requestedAt, { minutes: 2 })),
      actor: "system"
    })
  }
  for (const link of security.links) {
    entries.push(owner("channel.linked", "channelLink", link.id, { platform: link.platform }, link.linkedAt))
  }

  for (const agent of cast.agents) {
    if (agent.state === "draft") continue
    const name = { name: agent.name }
    const locked = minutesAgo(now, agent.ageDays * DAY + 30)
    entries.push(owner("agent.locking", "agent", agent.id, name, locked, agent.id))
    if (agent.state === "locking") continue
    entries.push(system("agent.active", "agent", agent.id, name, DateTime.add(locked, { seconds: 8 }), agent.id))
    if (agent.state === "paused") {
      entries.push(owner("agent.paused", "agent", agent.id, name, minutesAgo(now, 5 * 60), agent.id))
    }
    if (agent.state === "updating") {
      entries.push(owner("agent.updating", "agent", agent.id, name, minutesAgo(now, 2), agent.id))
    }
    if (agent.state === "expired") {
      entries.push(
        system("agent.expired", "agent", agent.id, name, minutesAgo(now, (agent.ageDays - 90) * DAY), agent.id)
      )
    }
    if (agent.state === "removed") {
      const removed = minutesAgo(now, 60 * DAY)
      entries.push(owner("agent.removing", "agent", agent.id, name, removed, agent.id))
      entries.push(system("agent.removed", "agent", agent.id, name, DateTime.add(removed, { seconds: 9 }), agent.id))
    }

    // Its trades: a fill most days it was trading, each a few steps in the log.
    const trading = agent.state === "active" || agent.state === "doneForToday" || agent.state === "asking"
    const days = trading ? Math.min(agent.ageDays, cast.scenario === "heavy" ? 24 : 8) : 0
    for (let day = 0; day < days; day++) {
      const at = minutesAgo(now, day * DAY + 3 * 60 + agent.ageDays)
      const intentId = previewId("intent", 80_000 + agent.ageDays * 100 + day)
      const step = (status: string, seconds: number, actor: AuditEntry["actor"]) =>
        entries.push({
          actor,
          actorId: actor === "agent" ? agent.id : null,
          action: `intent.${status}`,
          subjectType: "intent",
          subjectId: intentId,
          agentId: agent.id,
          data: {},
          at: DateTime.add(at, { seconds })
        })
      step("deciding", 0, "system")
      if (day % 7 === 3) {
        step("blocked", 2, "system")
        continue
      }
      step("sending", 2, "system")
      step("confirming", 4, "agent")
      step("filled", 7, "system")
    }
    if (agent.state === "asking") {
      const intentId = previewId("intent", 80_000 + agent.ageDays * 100 + 99)
      entries.push({ ...system("intent.needsApproval", "intent", intentId, {}, minutesAgo(now, 20), agent.id) })
    }
  }

  cast.automations.forEach((automation, index) => {
    const daysAgo = automation.ageDays ?? age - 8 - index
    entries.push(owner("automation.created", "automation", automation.id, {}, minutesAgo(now, daysAgo * DAY)))
  })

  return entries
    .toSorted((a, b) => DateTime.toEpochMillis(a.at) - DateTime.toEpochMillis(b.at))
    .map((entry, index) => auditOf(entry, index + 1))
    .toReversed()
}

/** A made-up transaction hash, the same for the same `n`. */
export const txHashOf = (n: number): TxHash => {
  let hex = ""
  for (let index = 0; hex.length < 64; index++) hex += ((n + 1) * 2_654_435_761 * (index + 7)).toString(16).slice(-4)
  return `0x${hex.slice(0, 64)}` as TxHash
}

/** A transfer of `dollars` of USDC, the `n`th of the account. */
export const transferOf = (
  n: number,
  kind: Transfer["kind"],
  dollars: number,
  status: Transfer["status"],
  createdAt: DateTime.Utc
): Transfer =>
  new Transfer({
    id: previewId("transfer", n) as TransferId,
    kind,
    asset: "USDC",
    amount: BigInt(Math.round(dollars * 1_000_000)),
    from: (kind === "deposit" ? OWN_WALLET : ACCOUNT_ADDRESS) as Transfer["from"],
    to: (kind === "deposit" ? ACCOUNT_ADDRESS : OWN_WALLET) as Transfer["to"],
    status,
    txHash: status === "pending" ? null : txHashOf(n),
    createdAt
  })

// Each scenario's money in and out: [kind, dollars, status, days ago].
const TRANSFERS: Readonly<
  Record<Cast["scenario"], ReadonlyArray<readonly [Transfer["kind"], number, Transfer["status"], number]>>
> = {
  newPerson: [],
  starter: [["deposit", 200, "confirmed", 1.4]],
  typical: [
    ["deposit", 2_000, "confirmed", 44],
    ["deposit", 1_000, "confirmed", 12],
    ["withdrawal", 200, "confirmed", 6],
    ["deposit", 500, "confirmed", 5]
  ],
  heavy: [
    ["deposit", 10_000, "confirmed", 200],
    ["deposit", 5_000, "confirmed", 170],
    ["deposit", 5_000, "confirmed", 140],
    ["withdrawal", 1_200, "confirmed", 120],
    ["deposit", 5_000, "confirmed", 110],
    ["deposit", 5_000, "confirmed", 80],
    ["withdrawal", 300, "failed", 61],
    ["withdrawal", 300, "confirmed", 61],
    ["deposit", 5_000, "confirmed", 50],
    ["deposit", 2_500, "confirmed", 20],
    ["withdrawal", 400, "confirmed", 2],
    ["deposit", 1_000, "confirmed", 1],
    ["withdrawal", 750, "pending", 0.007]
  ]
}

/** The deposits and withdrawals a scenario starts with, newest first. */
export const makeTransfers = (cast: Cast, now: Date): Array<Transfer> =>
  TRANSFERS[cast.scenario]
    .map(([kind, dollars, status, daysAgo], index) =>
      transferOf(index + 1, kind, dollars, status, minutesAgo(now, daysAgo * DAY))
    )
    .toReversed()
