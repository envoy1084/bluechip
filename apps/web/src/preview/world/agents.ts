// The preview world's agents slice: the cast's agents with their sessions, usage and journals, the templates you
// saved, the automations with their runs, and the signing requests prepared for Face ID.
import type { AgentId, AutomationId, SavedTemplateId } from "@bluechip/domain/Ids"
import { draftSpec, SavedTemplate } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import { type AgentRecord, type IdCounter, nextId, type SigningRequest, toAgent } from "./agents/AgentRecord.ts"
import { type AutomationRecord, castDraft, savedAutomation } from "./agents/automations.ts"
import { castAgent } from "./agents/castAgents.ts"
import { runEntries, sortJournal } from "./agents/journal.ts"
import { addRun, runPlans } from "./agents/runs.ts"
import type { Cast, CastAutomation } from "./cast.ts"
import type { MarketSlice } from "./market/model.ts"

export interface AgentsSlice {
  readonly ids: IdCounter
  /** Removed ones included, oldest first. */
  agents: Array<AgentRecord>
  /** Newest first. */
  automations: Array<AutomationRecord>
  templates: Array<SavedTemplate>
  requests: Array<SigningRequest>
}

export const findAgent = (slice: AgentsSlice, id: AgentId): AgentRecord | undefined =>
  slice.agents.find((record) => record.id === id)

export const findAutomation = (slice: AgentsSlice, id: AutomationId): AutomationRecord | undefined =>
  slice.automations.find((record) => record.automation.id === id && record.automation.status !== "deleted")

/** What the cast's account is worth, in USDC units: its cash and its stocks at what they cost. */
export const portfolioUsdc = (cast: Cast): bigint =>
  BigInt(
    Math.round(
      (cast.cash + cast.holdings.reduce((sum, holding) => sum + holding.shares * holding.costPerShare, 0)) * 1_000_000
    )
  )

const CREATED_BY: Readonly<Record<CastAutomation["kind"], AutomationRecord["automation"]["createdBy"]>> = {
  weeklyBuy: "template",
  stopLoss: "owner",
  rebalance: "template",
  newsSell: "assistant",
  priceAlert: "owner",
  monthlySplit: "owner"
}

// A cast automation with its runs, each written to its agent's journal; a new one only has the runs since it was set up.
const castAutomation = (
  ids: IdCounter,
  agents: ReadonlyArray<AgentRecord>,
  cast: CastAutomation,
  now: DateTime.Utc
): AutomationRecord => {
  const agent = cast.agentId === null ? undefined : agents.find((record) => record.id === cast.agentId)
  const ageDays = cast.ageDays
  const plans = runPlans(cast.kind, cast.state).filter((plan) => ageDays === undefined || plan.daysAgo < ageDays)
  const createdAt = ageDays === undefined ?
    DateTime.subtract(now, { days: Math.ceil(Math.max(...plans.map((plan) => plan.daysAgo))) + 2 }) :
    DateTime.subtract(now, { hours: Math.round(ageDays * 24) })
  const record = savedAutomation({
    id: cast.id,
    draft: castDraft(cast, agent === undefined ? null : toAgent(agent).spec),
    status: cast.state === "failing" ? "active" : cast.state,
    createdBy: CREATED_BY[cast.kind],
    createdAt,
    now,
    requestKey: null
  })

  for (const plan of plans) {
    const run = addRun(ids, record, {
      ...plan,
      at: DateTime.subtract(now, { hours: Math.round(plan.daysAgo * 24) }),
      now
    })
    if (agent !== undefined) agent.journal.push(...runEntries(ids, agent.id, record.automation, run, record.judgments))
  }
  return record
}

const savedTemplates = (cast: Cast, now: DateTime.Utc): Array<SavedTemplate> => {
  const saved = (n: number, name: string, basedOn: string | null, spec: SavedTemplate["spec"], daysAgo: number) =>
    new SavedTemplate({
      id: nextId({ next: n }, "template") as SavedTemplateId,
      name,
      basedOn,
      spec,
      createdAt: DateTime.subtract(now, { days: daysAgo })
    })
  const careful = saved(
    1,
    "Careful tech picker",
    "stockPicker",
    draftSpec({ template: "stockPicker", preset: "conservative", stocks: ["NVDA", "AAPL"], targets: [] }),
    18
  )
  if (cast.scenario === "typical") return [careful]
  if (cast.scenario === "newPerson" || cast.scenario === "starter") return []
  return [
    careful,
    saved(
      2,
      "Big tech mix",
      "rebalancer",
      draftSpec({
        template: "rebalancer",
        preset: "balanced",
        stocks: ["AAPL", "MSFT", "GOOGL"],
        targets: [{ asset: "AAPL", weight: 3000 }, { asset: "MSFT", weight: 3000 }, { asset: "GOOGL", weight: 3000 }, {
          asset: "USDC",
          weight: 1000
        }]
      }),
      45
    ),
    saved(
      3,
      "Friday dip buyer",
      null,
      draftSpec({ template: "weeklyBuyer", preset: "active", stocks: ["AMZN", "META"], targets: [] }),
      70
    )
  ]
}

/** The agents slice of `cast` as of `now`, its trades the market's (`market`): the same ones every page counts. */
export const makeAgents = (cast: Cast, now: Date, market: Pick<MarketSlice, "intents" | "trades">): AgentsSlice => {
  const at = DateTime.fromDateUnsafe(now)
  const ids: IdCounter = { next: 700_000 }
  const agents = cast.agents.map((agent) => castAgent(ids, agent, at, market))
  const automations = cast.automations.map((automation) => castAutomation(ids, agents, automation, at))
    .toSorted((a, b) => DateTime.toEpochMillis(b.automation.createdAt) - DateTime.toEpochMillis(a.automation.createdAt))
  for (const agent of agents) sortJournal(agent)

  return { ids, agents, automations, templates: savedTemplates(cast, at), requests: [] }
}
