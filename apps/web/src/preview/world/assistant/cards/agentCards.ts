// Agent cards: a drafted agent (with the automations its template comes with), a change, renewal or removal for Face
// ID, pausing or resuming agents, and a set of policies to save as a template.
import { Agent, type AgentAction, AgentRequest } from "@bluechip/domain/agents/Agent"
import type { Card, CardStatus, DraftAutomation } from "@bluechip/domain/assistant/Card"
import { describeAutomation } from "@bluechip/domain/automations/Automation"
import { defaultAutomations } from "@bluechip/domain/automations/Templates"
import type { AutomationId, CardId, RequestId, SavedTemplateId, SigningRequestId } from "@bluechip/domain/Ids"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { SavedTemplate } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"
import type { CastAgent } from "../../cast.ts"
import { CEREMONY, describe, nameOf, specOf } from "../castRecords.ts"
import type { Mint } from "../mint.ts"

const requestFor = (mint: Mint, action: AgentAction, agent: Agent, expired: boolean): AgentRequest =>
  new AgentRequest({
    id: mint.id("signing") as SigningRequestId,
    options: CEREMONY,
    action,
    agent,
    deploysAccount: false,
    expiresAt: expired ? mint.at(1) : DateTime.add(mint.at(0), { hours: 6 })
  })

/**
 * A drafted agent with its template's automations: kept and waiting while it's a draft, or started (`started`: the
 * automation each became) once it's live.
 */
export const draftAgentCard = (
  mint: Mint,
  agent: Agent,
  options: { readonly started?: ReadonlyArray<AutomationId>; readonly expired?: boolean } = {}
): Card => {
  const automations = defaultAutomations(agent.template, agent.spec, agent.id).map((draft, index): DraftAutomation => ({
    requestId: mint.uuid() as RequestId,
    draft,
    sentence: describeAutomation(draft, nameOf).sentence,
    kept: true,
    automationId: options.started?.[index] ?? null
  }))
  return {
    _tag: "DraftAgent",
    id: mint.id("card") as CardId,
    agent,
    request: requestFor(mint, "lock", agent, options.expired ?? agent.status !== "draft"),
    description: describe(agent.spec),
    automations
  }
}

/**
 * Changing an agent's policies (tighter: a smaller preset, or looser), renewing it or removing it, for Face ID. Removing a draft
 * needs no signature: it is gone already.
 */
export const policyChangeCard = (
  mint: Mint,
  cast: CastAgent,
  agent: Agent,
  action: "update" | "renew" | "remove",
  /** An update that lets it do more (a bigger preset): the card flags it as looser. */
  looser = false
): Card => {
  const id = mint.id("card") as CardId
  if (action === "remove" && agent.status === "draft") {
    return {
      _tag: "PolicyChange",
      id,
      action,
      agent: new Agent({ ...agent, status: "removed" }),
      request: null,
      changes: null,
      description: null
    }
  }
  if (action !== "update") {
    return {
      _tag: "PolicyChange",
      id,
      action,
      agent,
      request: requestFor(mint, action, agent, false),
      changes: null,
      description: null
    }
  }

  // A preset further along, or (at the end already) a stock more or less.
  const preset = looser ? "active" : "conservative"
  const stocks = cast.preset !== preset ?
    cast.stocks :
    looser ?
    [...cast.stocks, cast.stocks.includes("GOOGL") ? "META" as const : "GOOGL" as const] :
    cast.stocks.slice(0, Math.max(1, cast.stocks.length - 1))
  const after = specOf({ ...cast, preset, stocks })
  return {
    _tag: "PolicyChange",
    id,
    action,
    agent,
    request: requestFor(mint, action, new Agent({ ...agent, pendingSpec: after }), false),
    changes: compareSpecs(agent.spec, after),
    description: describe(after)
  }
}

/** Pausing or resuming one agent, or pausing every agent; applied, it lists the agents as they were left. */
export const agentControlCard = (
  mint: Mint,
  action: "pause" | "resume" | "pauseAll",
  agents: ReadonlyArray<Agent>,
  status: CardStatus
): Card => {
  const one = action === "pauseAll" ? null : agents[0] ?? null
  const touched = one === null ? agents.filter((agent) => agent.status === "active") : [one]
  return {
    _tag: "AgentControl",
    id: mint.id("card") as CardId,
    action,
    agentId: one?.id ?? null,
    agentName: one?.name ?? null,
    status,
    agents: status === "applied" ? touched.map((agent) => new Agent({ ...agent, paused: action !== "resume" })) : []
  }
}

/** An agent's policies to save as a template. */
export const saveTemplateCard = (mint: Mint, cast: CastAgent, name: string, status: CardStatus): Card => {
  const spec = specOf(cast)
  return {
    _tag: "SaveTemplate",
    id: mint.id("card") as CardId,
    name,
    basedOn: cast.template,
    spec,
    description: describe(spec),
    status,
    template: status === "applied" ? savedTemplateOf(mint, name, cast.template, spec) : null
  }
}

export const savedTemplateOf = (
  mint: Mint,
  name: string,
  basedOn: string | null,
  spec: SavedTemplate["spec"]
): SavedTemplate =>
  new SavedTemplate({ id: mint.id("template") as SavedTemplateId, name, basedOn, spec, createdAt: mint.at(0) })
