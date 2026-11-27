/**
 * Agent specs as the model writes them: a template, a preset and stocks to start from, then changes in everyday units
 * (dollars, percent, counts), checked against the catalog. The model never writes micro-dollars or basis points.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import { StockSymbol } from "../market/Market.ts"
import { type AgentSpec, PolicyId, PolicyProblem } from "../policies/AgentSpec.ts"
import { checkSpec, complete, policyOf } from "../policies/Catalog.ts"
import { configOf, type Field } from "../policies/Policy.ts"
import { Asset, rebalance } from "../policies/Rebalance.ts"
import {
  addPolicy,
  cantAdd,
  cantRemove,
  removePolicy,
  setDirection,
  setStocks,
  templateSpec,
  withConfig
} from "../policies/SpecEdits.ts"
import { Preset, TemplateId } from "../policies/Templates.ts"
import { Direction } from "../policies/Trade.ts"
import { SavedTemplateIdParam } from "./Params.ts"

/**
 * One policy setting, in the unit its field shows: dollars for `usd` fields, percent for `bps` fields, a whole number
 * for `count` fields, ether for `wei` fields, true or false for `toggle` fields.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const Setting = Schema.Struct({
  policy: PolicyId,
  field: Schema.String.annotate({ description: "The field's name, as listPolicies shows it (e.g. maxPerTrade)." }),
  value: Schema.Union([Schema.Finite, Schema.Boolean]).annotate({
    description: "Dollars for usd fields, percent for bps fields (2.5 means 2.5%), a whole number for count fields, " +
      "ether for wei fields (0.01 means 0.01 ETH), true or false for toggle fields."
  })
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type Setting = typeof Setting.Type

/**
 * Changes to an agent's policies. Applied in this order: direction, policies added and removed, stocks (which resets
 * a rebalancer's mix to even), the mix, then settings.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SpecPatch = Schema.Struct({
  direction: Schema.optionalKey(Direction.annotate({ description: "Whether it buys, sells, both, or rebalances." })),
  add: Schema.optionalKey(Schema.Array(PolicyId).annotate({ description: "Policies to add, with their defaults." })),
  remove: Schema.optionalKey(Schema.Array(PolicyId).annotate({ description: "Policies to remove." })),
  stocks: Schema.optionalKey(Schema.Array(StockSymbol).annotate({ description: "Every stock it may trade." })),
  targets: Schema.optionalKey(
    Schema.Array(Schema.Struct({ asset: Asset, percent: Schema.Finite })).annotate({
      description: "A rebalancer's target mix, in percent, cash (USDC) included; it adds up to 100."
    })
  ),
  settings: Schema.optionalKey(Schema.Array(Setting))
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SpecPatch = typeof SpecPatch.Type

/**
 * A new agent as the model drafts it: a template to start from (built in, with a preset, or one the user saved), its
 * stocks, and changes on top.
 *
 * @stability unstable
 * @category schemas
 * @since 0.0.0
 */
export const SpecDraft = Schema.Struct({
  template: Schema.Union([TemplateId, SavedTemplateIdParam]).annotate({
    description: "The template it starts from (see listTemplates): a built-in one's id, or a saved one's (template_…)."
  }),
  preset: Preset.annotate({
    description: "How much it may do: conservative, balanced or active. A saved template keeps its own amounts."
  }),
  stocks: Schema.Array(StockSymbol).annotate({
    description: "The stocks it may trade. For a saved template, empty keeps the template's stocks."
  }),
  changes: Schema.optionalKey(SpecPatch)
})

/**
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export type SpecDraft = typeof SpecDraft.Type

/**
 * A spec and everything wrong with it: settings that don't exist or can't be set this way, policies that can't be
 * added or removed, and the catalog's own checks. Empty problems mean the spec can be locked.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export interface PatchedSpec {
  readonly spec: AgentSpec
  readonly problems: ReadonlyArray<PolicyProblem>
}

const MICROS_PER_DOLLAR = 1_000_000

const settingValue = (field: Field, value: number | boolean): bigint | number | boolean | undefined => {
  switch (field.unit) {
    case "usd":
      return typeof value === "number" ? BigInt(Math.round(value * MICROS_PER_DOLLAR)) : undefined
    case "bps":
      return typeof value === "number" ? Math.round(value * 100) : undefined
    case "count":
      return typeof value === "number" ? Math.round(value) : undefined
    case "toggle":
      return typeof value === "boolean" ? value : undefined
    // Ether to a millionth, then wei: a float of wei would lose its last digits.
    case "wei":
      return typeof value === "number" ? BigInt(Math.round(value * 1e6)) * BigInt(1e12) : undefined
    default:
      return undefined
  }
}

/**
 * Applies a patch to a spec, collecting the problems on the way and those of the result.
 *
 * **Example** (A lower largest trade)
 *
 * ```ts import.meta.vitest
 * import { applyPatch } from "@bluechip/domain/tools/SpecPatch"
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const spec = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * applyPatch(spec, { settings: [{ policy: "tradeSize", field: "maxPerTrade", value: 50 }] }).problems // => []
 * ```
 *
 * @stability unstable
 * @category specs
 * @since 0.0.0
 */
export const applyPatch = (spec: AgentSpec, patch: SpecPatch): PatchedSpec => {
  const problems: Array<PolicyProblem> = []
  const problem = (policy: PolicyId, field: string | null, message: string) =>
    problems.push(new PolicyProblem({ policy, field, message }))
  let next = spec

  if (patch.direction !== undefined) next = setDirection(next, patch.direction)
  for (const id of patch.add ?? []) {
    const reason = cantAdd(next, id)
    if (reason === undefined) next = addPolicy(next, id)
    else problem(id, null, reason)
  }
  for (const id of patch.remove ?? []) {
    const reason = cantRemove(next, id)
    if (reason === undefined) next = removePolicy(next, id)
    else problem(id, null, reason)
  }
  if (patch.stocks !== undefined) next = setStocks(next, patch.stocks)
  if (patch.targets !== undefined) {
    const config = configOf(next.policies, rebalance)
    if (config === undefined) problem("rebalance", "targets", "Only a rebalancer has a target mix.")
    else {
      const targets = patch.targets.map(({ asset, percent }) => ({ asset, weight: Math.round(percent * 100) }))
      next = withConfig(next, "rebalance", { ...config, targets })
    }
  }

  for (const setting of patch.settings ?? []) {
    const entry = next.policies.find((candidate) => candidate.id === setting.policy)
    if (entry === undefined) {
      problem(setting.policy, setting.field, "The agent doesn't have this policy; add it first.")
      continue
    }
    const field = (policyOf(setting.policy).fields as Record<string, Field>)[setting.field]
    const value = field === undefined ? undefined : settingValue(field, setting.value)
    if (value === undefined) {
      problem(setting.policy, setting.field, "This setting doesn't exist or can't take that value.")
      continue
    }
    next = withConfig(next, setting.policy, { ...(entry.config as object), [setting.field]: value })
  }

  const completed = complete(next)
  return { spec: completed, problems: [...problems, ...checkSpec(completed)] }
}

/**
 * Drafts a new agent's spec, then applies the draft's changes: a built-in template with the preset and stocks, or a
 * saved template's spec (`saved`, which the caller reads for the draft's saved template id) with the draft's stocks
 * when it names any.
 *
 * @stability unstable
 * @category specs
 * @since 0.0.0
 */
export const draftAgentSpec = (draft: SpecDraft, saved?: AgentSpec): PatchedSpec => {
  const start = saved !== undefined ?
    (draft.stocks.length === 0 ? saved : setStocks(saved, draft.stocks)) :
    templateSpec(draft.template as TemplateId, draft.preset, draft.stocks)
  return applyPatch(start, draft.changes ?? {})
}
