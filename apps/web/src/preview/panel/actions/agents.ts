// The panel's agents actions: named changes to the preview's agents and automations, saved across reloads, each
// telling the app what changed as the server would (`AgentChanged`, `AutomationRan`).
import { limitsOf } from "@bluechip/domain/automations/AgentLimits"
import type { RunOutcome } from "@bluechip/domain/automations/Run"
import { LiveEvent } from "@bluechip/domain/Events"
import type { AgentId, AutomationId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { type Preset, type TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import { type ActionDef, defineAction } from "../../store.ts"
import { findAgent, findAutomation } from "../../world/agents.ts"
import {
  type AgentRecord,
  nextId,
  saveSession,
  sessionOf,
  toAgent,
  type UsageLimit
} from "../../world/agents/AgentRecord.ts"
import { type AgentState, setAgentState } from "../../world/agents/AgentStates.ts"
import { type AutomationState, setAutomationStatus } from "../../world/agents/automations.ts"
import { castAgent } from "../../world/agents/castAgents.ts"
import { runEntries, tradeEntry, type TradeMoment } from "../../world/agents/journal.ts"
import { addRun, type RunSkip } from "../../world/agents/runs.ts"
import type { World } from "../../world/World.ts"

const changed = (record: AgentRecord) => [LiveEvent.cases.AgentChanged.make({ agent: toAgent(record) })]

// The agent `id` names, and what changing it tells the app; nothing when this account has no such agent.
const onAgent = (world: World, id: unknown, apply: (record: AgentRecord, now: DateTime.Utc) => void) => {
  const record = findAgent(world.agents, id as AgentId)
  if (record === undefined) return []
  apply(record, DateTime.nowUnsafe())
  return changed(record)
}

/** Puts an agent in a state: `(agentId, state)`. */
export const setAgentStateAction = defineAction(
  "agents.setState",
  (world, id, state) =>
    onAgent(world, id, (record, now) => setAgentState(world.agents.ids, record, state as AgentState, now))
)

/** Sets how much of one limit an agent has used: `(agentId, limit, share)`, the share from 0 to 1. */
export const setAgentUsage = defineAction(
  "agents.setUsage",
  (world, id, limit, share) =>
    onAgent(world, id, (record) => {
      record.usage = { ...record.usage, [limit as UsageLimit]: Number(share) }
    })
)

/** Makes an agent's session end in a few days, or a few hours for a fraction: `(agentId, days)`. */
export const setAgentEndsIn = defineAction(
  "agents.endsIn",
  (world, id, days) =>
    onAgent(world, id, (record, now) => {
      const current = sessionOf(record, record.currentSessionId)
      if (current?.status !== "active") return
      saveSession(record, current.id, { validUntil: DateTime.add(now, { hours: Math.round(Number(days) * 24) }) })
    })
)

/** Writes one of its trades at a moment to an agent's journal, now: `(agentId, moment)`. */
export const addJournalEntry = defineAction(
  "agents.addJournal",
  (world, id, moment) =>
    onAgent(world, id, (record, now) => {
      const limits = limitsOf(toAgent(record).spec)!
      record.journal.unshift(tradeEntry(world.agents.ids, record, {
        moment: moment as TradeMoment,
        side: record.journal.length % 3 === 2 ? "sell" : "buy",
        symbol: limits.stocks[record.journal.length % Math.max(1, limits.stocks.length)] ?? "AAPL",
        limits,
        share: 0.6,
        at: now
      }))
    })
)

const STARTING_STOCKS: Readonly<Record<TemplateId, ReadonlyArray<StockSymbol>>> = {
  rebalancer: TEMPLATES.rebalancer.defaultStocks,
  stockPicker: ["NVDA", "AAPL"],
  weeklyBuyer: ["AAPL"],
  stopLossGuard: ["TSLA"]
}

/** Adds an agent locked just now from a template: `(template, preset)`. */
export const addAgentFromTemplate = defineAction("agents.add", (world, template, preset) => {
  const id = template as TemplateId
  const stocks = STARTING_STOCKS[id]
  const record = castAgent(world.agents.ids, {
    id: nextId(world.agents.ids, "agent") as AgentId,
    name: `New ${TEMPLATES[id].title.toLowerCase()}`,
    template: id,
    preset: preset as Preset,
    stocks,
    targets: id === "rebalancer" ?
      [...stocks.map((asset) => ({ asset, weight: 2000 })), {
        asset: "USDC" as const,
        weight: 10_000 - 2000 * stocks.length
      }] :
      [],
    state: "active",
    ageDays: 0
  }, DateTime.nowUnsafe())
  world.agents.agents.push(record)
  return changed(record)
})

const setAllPaused = (name: string, paused: boolean) =>
  defineAction(name, (world) =>
    world.agents.agents.flatMap((record) => {
      if (!["locking", "active", "updating", "removing"].includes(record.status) || record.paused === paused) return []
      record.paused = paused
      return changed(record)
    }))

export const pauseAllAgents = setAllPaused("agents.pauseAll", true)

export const resumeAllAgents = setAllPaused("agents.resumeAll", false)

const runOf = (world: World, id: unknown, options: Omit<Parameters<typeof addRun>[2], "at" | "now">) => {
  const record = findAutomation(world.agents, id as AutomationId)
  if (record === undefined) return []

  const now = DateTime.nowUnsafe()
  const run = addRun(world.agents.ids, record, { ...options, at: now, now })
  const agent = record.automation.agentId === null ? undefined : findAgent(world.agents, record.automation.agentId)
  if (agent !== undefined) {
    agent.journal.unshift(...runEntries(world.agents.ids, agent.id, record.automation, run, record.judgments))
  }
  return [LiveEvent.cases.AutomationRan.make({ run, automationName: record.automation.name })]
}

/** Puts an automation in a state: `(automationId, state)`; failing is active with two runs just failed. */
export const setAutomationState = defineAction("automations.setState", (world, id, state) => {
  const record = findAutomation(world.agents, id as AutomationId)
  if (record === undefined) return []
  if (state !== "failing") {
    setAutomationStatus(record, state as Exclude<AutomationState, "failing">, DateTime.nowUnsafe())
    return []
  }
  setAutomationStatus(record, "active", DateTime.nowUnsafe())
  return [...runOf(world, id, { outcome: "failed" }), ...runOf(world, id, { outcome: "failed" })]
})

/** Runs an automation now, ending as `outcome` (skipped for `skip`): `(automationId, outcome, skip)`. */
export const addAutomationRun = defineAction(
  "automations.addRun",
  (world, id, outcome, skip) =>
    runOf(world, id, { outcome: outcome as RunOutcome, skip: (skip ?? undefined) as RunSkip | undefined })
)

export const AGENTS_ACTIONS: ReadonlyArray<ActionDef> = [
  setAgentStateAction,
  setAgentUsage,
  setAgentEndsIn,
  addJournalEntry,
  addAgentFromTemplate,
  pauseAllAgents,
  resumeAllAgents,
  setAutomationState,
  addAutomationRun
].map((action) => action.def)
