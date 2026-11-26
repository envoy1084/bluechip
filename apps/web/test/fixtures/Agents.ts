// Agents and saved templates as the API returns them.
import { Agent, type AgentStatus } from "@bluechip/domain/agents/Agent"
import { AgentId, SavedTemplateId } from "@bluechip/domain/Ids"
import { draftSpec, SavedTemplate } from "@bluechip/domain/policies/Templates"
import * as DateTime from "effect/DateTime"

export const AGENT_ID = AgentId.make("agent_01jd8v4t5m6n7a8q9r0s1t2v3w")
export const TEMPLATE_ID = SavedTemplateId.make("template_01jd8v4t5m6n7a8q9r0s1t2v3w")

// $250 a day, $100 a trade, 30% in one stock, 10% cash, over Nvidia and Apple.
export const PICKER = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA", "AAPL"], targets: [] })

/** A stock picker named "Nvidia picker", made on 20 Nov 2026 and locked until 1 Dec 2026, at `status`. */
export const agent = (
  status: AgentStatus,
  options: {
    readonly id?: AgentId
    readonly name?: string
    readonly paused?: boolean
    readonly lockedUntil?: string | null
    readonly template?: string | null
    readonly createdAt?: string
  } = {}
): Agent =>
  new Agent({
    id: options.id ?? AGENT_ID,
    name: options.name ?? "Nvidia picker",
    template: options.template === undefined ? "stockPicker" : options.template,
    status,
    paused: options.paused ?? false,
    spec: PICKER,
    pendingSpec: null,
    lockedUntil: options.lockedUntil === undefined ?
      DateTime.makeUnsafe("2026-12-01T00:00:00Z") :
      options.lockedUntil === null ?
      null :
      DateTime.makeUnsafe(options.lockedUntil),
    createdAt: DateTime.makeUnsafe(options.createdAt ?? "2026-11-20T10:00:00Z")
  })

/** A saved template named "My picker", made from the stock picker. */
export const SAVED = new SavedTemplate({
  id: TEMPLATE_ID,
  name: "My picker",
  basedOn: "stockPicker",
  spec: PICKER,
  createdAt: DateTime.makeUnsafe("2026-11-21T10:00:00Z")
})
