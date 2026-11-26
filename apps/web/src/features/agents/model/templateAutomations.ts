// The automations a new agent's template comes with, as its flow holds them until the agent is live, and the pieces
// of the automations feature that show them (passed in by the route).
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AutomationDraft } from "@bluechip/domain/automations/Automation"
import { defaultAutomations } from "@bluechip/domain/automations/Templates"
import type { RequestId } from "@bluechip/domain/Ids"
import type { Stock, StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { complete } from "@bluechip/domain/policies/Catalog"
import type { ComponentType } from "react"
import { type Origin, originTemplate } from "./origin.ts"

/** One automation its template comes with, kept or not, changed or as it came. */
export interface TemplateAutomation {
  readonly id: RequestId
  readonly draft: AutomationDraft
  readonly kept: boolean
  readonly edited: boolean
}

/** The template's automations, drawn by the automations feature and passed in by the route. */
export interface AutomationSlots {
  /** On the review: each automation, to keep, change or leave out. */
  readonly Defaults: ComponentType<{
    automations: ReadonlyArray<TemplateAutomation>
    spec: AgentSpec
    stocks: ReadonlyArray<Stock>
    nameOf: (symbol: StockSymbol) => string
    onChange: (automations: ReadonlyArray<TemplateAutomation>) => void
  }>
  /** Once it's live: the kept ones, saved for it. */
  readonly Saved: ComponentType<{ agent: Agent; automations: ReadonlyArray<TemplateAutomation> }>
}

/** The automations an agent from `origin` with `spec` comes with, all kept. */
export const templateAutomations = (origin: Origin, spec: AgentSpec): ReadonlyArray<TemplateAutomation> =>
  defaultAutomations(originTemplate(origin), complete(spec), null).map((draft) => ({
    id: crypto.randomUUID() as RequestId,
    draft,
    kept: true,
    edited: false
  }))
