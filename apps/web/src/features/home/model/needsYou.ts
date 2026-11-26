// What needs you now, one line each with its way to act: a recovery under way, trades waiting for your approval,
// automations that need a look, agents that ran out or are about to, and, once you're settled in, a draft left
// unlocked, cash no agent can trade, or no recovery key. The most pressing first.
import type { Agent } from "@bluechip/domain/agents/Agent"
import { SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import type { Intent } from "@bluechip/domain/intents/Intent"
import { type AccountRecovery, isOpen } from "@bluechip/domain/recovery/Recovery"
import { formatMoney } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { usdcDollars } from "../../../lib/amounts.ts"
import { untilText, whenText } from "./time.ts"

/** How pressing it is: act now, have a look soon, or worth knowing. */
export type Tone = "urgent" | "warn" | "info"

/** Where its button leads. */
export type NeedAction =
  | { readonly _tag: "approvals" }
  | { readonly _tag: "security" }
  | { readonly _tag: "agent"; readonly agentId: AgentId }
  | { readonly _tag: "agents" }
  | { readonly _tag: "newAgent" }
  | { readonly _tag: "automation"; readonly automationId: AutomationId }
  | { readonly _tag: "automations" }

export interface Need {
  readonly key: string
  readonly tone: Tone
  readonly title: string
  readonly detail: string
  readonly action: NeedAction
  readonly actionLabel: string
}

/** An automation as its list reads it: why it needs a look, or `null`. */
export interface AutomationAttention {
  readonly automation: Pick<Automation, "id" | "name">
  readonly attention: string | null
}

export interface NeedsFacts {
  readonly approvals: ReadonlyArray<Pick<Intent, "agentId" | "expiresAt">>
  readonly agents: ReadonlyArray<Pick<Agent, "id" | "name" | "status" | "paused" | "lockedUntil">>
  readonly automations: ReadonlyArray<AutomationAttention>
  /** `null` while it loads. */
  readonly recovery: Pick<AccountRecovery, "key" | "request"> | null
  /** Cash in USDC units; `null` while it loads. */
  readonly cash: bigint | null
  /** Settled in: the getting-started checklist is gone, so what it would say shows here. */
  readonly settled: boolean
}

/** An agent's rules end within this many days: time to renew. */
export const ENDING_SOON_DAYS = 3

const DAY = 86_400_000
const IDLE_CASH = BigInt(10_000_000)
const RANK: Readonly<Record<Tone, number>> = { urgent: 0, warn: 1, info: 2 }

const names = (list: ReadonlyArray<string>) =>
  list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`

const endsAt = (agent: Pick<Agent, "lockedUntil">) =>
  agent.lockedUntil === null ? null : DateTime.toEpochMillis(agent.lockedUntil)

const recoveryNeed = (recovery: NeedsFacts["recovery"], now: Date, zone: string): ReadonlyArray<Need> => {
  const request = recovery?.request
  if (request == null || !isOpen(request)) return []

  const detail = request.status === "executing" ?
    "A new passkey is taking over your account. If it isn't you, check your security now." :
    request.status === "requesting" || request.executableAt === null ?
    "Its request is on its way to Base. If it isn't you, cancel it." :
    `If it isn't you, cancel it. It can take over ${whenText(DateTime.toDateUtc(request.executableAt), now, zone)}.`
  return [{
    key: "recovery",
    tone: "urgent",
    title: "Your account is being recovered",
    detail,
    action: { _tag: "security" },
    actionLabel: "Review"
  }]
}

const approvalsNeed = (facts: NeedsFacts, now: Date): ReadonlyArray<Need> => {
  if (facts.approvals.length === 0) return []

  const count = facts.approvals.length
  const from = [...new Set(facts.approvals.flatMap((intent) => intent.agentId === null ? [] : [intent.agentId]))]
    .flatMap((id) => facts.agents.find((agent) => agent.id === id)?.name ?? [])
  const ends = facts.approvals
    .flatMap((intent) => intent.expiresAt === null ? [] : [DateTime.toEpochMillis(intent.expiresAt)])
    .toSorted((a, b) => a - b)[0]

  const sentences = [
    ...(from.length === 0 ? [] : [`From ${names(from)}.`]),
    ...(ends === undefined ? [] : [`${count === 1 ? "It" : "The first"} expires ${untilText(new Date(ends), now)}.`])
  ]
  return [{
    key: "approvals",
    tone: ends !== undefined && ends - now.getTime() < 60 * 60_000 ? "urgent" : "warn",
    title: count === 1 ? "1 trade waits for your approval" : `${count} trades wait for your approval`,
    detail: sentences.length === 0 ? "Review it before it expires." : sentences.join(" "),
    action: { _tag: "approvals" },
    actionLabel: "Review"
  }]
}

const automationsNeed = (automations: NeedsFacts["automations"]): ReadonlyArray<Need> => {
  const needLook = automations.filter((each) => each.attention !== null)
  const [first] = needLook
  if (first === undefined) return []

  return [
    needLook.length === 1 ?
      {
        key: "automations",
        tone: "warn",
        title: `${first.automation.name} needs attention`,
        detail: first.attention!,
        action: { _tag: "automation", automationId: first.automation.id },
        actionLabel: "Review"
      } :
      {
        key: "automations",
        tone: "warn",
        title: `${needLook.length} automations need attention`,
        detail: `${names(needLook.map((each) => each.automation.name))}.`,
        action: { _tag: "automations" },
        actionLabel: "Review"
      }
  ]
}

const agentsNeed = (facts: NeedsFacts, now: Date): ReadonlyArray<Need> => {
  const time = now.getTime()
  const ranOut = facts.agents.filter((agent) =>
    agent.status === "expired" || (agent.status === "active" && (endsAt(agent) ?? Infinity) <= time)
  )
  const endingSoon = facts.agents.filter((agent) => {
    const end = endsAt(agent)
    return agent.status === "active" && end !== null && end > time && end - time <= ENDING_SOON_DAYS * DAY
  })
  const drafts = facts.settled ? facts.agents.filter((agent) => agent.status === "draft") : []

  const many = (
    key: string,
    tone: Tone,
    list: typeof facts.agents,
    one: (agent: (typeof list)[number]) => Omit<Need, "key" | "tone" | "action">,
    title: string,
    actionLabel: string
  ): ReadonlyArray<Need> => {
    const [first] = list
    if (first === undefined) return []
    if (list.length === 1) return [{ key, tone, action: { _tag: "agent", agentId: first.id }, ...one(first) }]
    return [{
      key,
      tone,
      title,
      detail: `${names(list.map((agent) => agent.name))}.`,
      action: { _tag: "agents" },
      actionLabel
    }]
  }

  return [
    ...many(
      "ranOut",
      "warn",
      ranOut,
      (agent) => ({
        title: `${agent.name} ran out`,
        detail: "Its rules ended, so it can't trade. Renew them to keep it going.",
        actionLabel: "Renew"
      }),
      `${ranOut.length} agents ran out`,
      "Renew"
    ),
    ...many(
      "endingSoon",
      "info",
      endingSoon,
      (agent) => ({
        title: `${agent.name}'s rules end ${untilText(new Date(endsAt(agent)!), now)}`,
        detail: `Renew them with Face ID for another ${SESSION_DAYS} days of trading.`,
        actionLabel: "Renew"
      }),
      `${endingSoon.length} agents' rules end soon`,
      "Renew"
    ),
    ...many(
      "drafts",
      "info",
      drafts,
      (agent) => ({
        title: `${agent.name} isn't trading yet`,
        detail: "It's a draft. Lock its rules with Face ID to start it.",
        actionLabel: "Finish"
      }),
      `${drafts.length} drafts aren't trading yet`,
      "Finish"
    )
  ]
}

const idleCashNeed = (facts: NeedsFacts, now: Date): ReadonlyArray<Need> => {
  if (!facts.settled || facts.cash === null || facts.cash < IDLE_CASH) return []

  const kept = facts.agents.filter((agent) => agent.status !== "removed")
  const canTrade = kept.some((agent) =>
    (agent.status === "active" || agent.status === "updating") && !agent.paused &&
    (endsAt(agent) ?? Infinity) > now.getTime()
  )
  if (canTrade) return []

  return [{
    key: "idleCash",
    tone: "info",
    title: `${formatMoney(usdcDollars(facts.cash))} is sitting in cash`,
    detail: kept.length === 0 ?
      "No agent trades for you yet. Start one to put it to work inside limits you set." :
      "None of your agents can trade right now. Resume one, or start a new one.",
    action: kept.length === 0 ? { _tag: "newAgent" } : { _tag: "agents" },
    actionLabel: kept.length === 0 ? "New agent" : "Agents"
  }]
}

const recoveryKeyNeed = (facts: NeedsFacts): ReadonlyArray<Need> =>
  !facts.settled || facts.recovery === null || facts.recovery.key !== null ? [] : [{
    key: "recoveryKey",
    tone: "info",
    title: "Add a recovery key",
    detail: "If you lose this device, a second passkey gets you back in.",
    action: { _tag: "security" },
    actionLabel: "Add key"
  }]

/** Everything that needs you, the most pressing first; empty when nothing does. */
export const needsYou = (facts: NeedsFacts, now: Date, zone: string): ReadonlyArray<Need> =>
  [
    ...recoveryNeed(facts.recovery, now, zone),
    ...approvalsNeed(facts, now),
    ...automationsNeed(facts.automations),
    ...agentsNeed(facts, now),
    ...idleCashNeed(facts, now),
    ...recoveryKeyNeed(facts)
  ].toSorted((a, b) => RANK[a.tone] - RANK[b.tone])
