// Where a new agent starts: a built-in template (drafted from a preset), a template the user saved, or nothing.
import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { addPolicy, scratchSpec, templateSpec } from "@bluechip/domain/policies/SpecEdits"
import { type SavedTemplate, type TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import { isTemplateId } from "./templateLabel.ts"

export type Origin =
  | { readonly kind: "builtIn"; readonly template: TemplateId }
  | { readonly kind: "saved"; readonly template: SavedTemplate }
  | { readonly kind: "scratch" }

export const SCRATCH = "scratch"

/** The gallery's value for an origin. */
export const originKey = (origin: Origin): string =>
  origin.kind === "builtIn" ? origin.template : origin.kind === "saved" ? origin.template.id : SCRATCH

/** What the agent records it started from: a built-in's id, a saved template's id, or `null`. */
export const originTemplate = (origin: Origin): string | null =>
  origin.kind === "scratch" ? null : origin.kind === "builtIn" ? origin.template : origin.template.id

/** What analytics calls an origin: a built-in template's id, or `saved` or `scratch` (a saved template's id is yours). */
export const originEventTemplate = (origin: Origin): string => origin.kind === "builtIn" ? origin.template : origin.kind

export const originLabel = (origin: Origin): string =>
  origin.kind === "builtIn" ?
    TEMPLATES[origin.template].title :
    origin.kind === "saved" ?
    origin.template.name :
    "Custom agent"

/** The built-in template whose presets apply, if it started from one. */
export const originPresets = (origin: Origin): TemplateId | null => origin.kind === "builtIn" ? origin.template : null

/**
 * The policies an origin starts with: a built-in's balanced preset over the stocks already picked (none are picked for
 * you, whatever the template), with the rules it offers switched on (a Stop-loss guard's floor: it's what the guard
 * is for). You switch off what you don't want.
 */
export const originSpec = (origin: Origin, stocks: ReadonlyArray<StockSymbol>): AgentSpec => {
  if (origin.kind === "builtIn") {
    return TEMPLATES[origin.template].options.reduce(addPolicy, templateSpec(origin.template, "balanced", stocks))
  }
  return origin.kind === "saved" ? origin.template.spec : scratchSpec()
}

/** Where a draft started: its built-in template, the saved template it names, or scratch (that template since deleted). */
export const originOf = (draft: Agent, saved: ReadonlyArray<SavedTemplate>): Origin => {
  if (isTemplateId(draft.template)) return { kind: "builtIn", template: draft.template }
  const template = saved.find((candidate) => candidate.id === draft.template)
  return template === undefined ? { kind: "scratch" } : { kind: "saved", template }
}
