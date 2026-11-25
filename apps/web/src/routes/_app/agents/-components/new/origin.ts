// Where a new agent starts: a built-in template (drafted from a preset), a template the user saved, or nothing.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { type SavedTemplate, type TemplateId, TEMPLATES } from "@bluechip/domain/policies/Templates"
import { scratchSpec, templateSpec } from "../../../../../agents/spec/specEdits.ts"

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

export const originLabel = (origin: Origin): string =>
  origin.kind === "builtIn" ?
    TEMPLATES[origin.template].title :
    origin.kind === "saved" ?
    origin.template.name :
    "Custom agent"

/** The built-in template whose presets apply, if it started from one. */
export const originPresets = (origin: Origin): TemplateId | null => origin.kind === "builtIn" ? origin.template : null

/** The policies an origin starts with: a built-in's balanced preset keeps the stocks already picked. */
export const originSpec = (origin: Origin, stocks: ReadonlyArray<StockSymbol>): AgentSpec => {
  if (origin.kind === "builtIn") return templateSpec(origin.template, "balanced", stocks)
  return origin.kind === "saved" ? origin.template.spec : scratchSpec()
}
