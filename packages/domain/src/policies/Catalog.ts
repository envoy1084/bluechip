/**
 * Reading a spec against the catalog: whether it can be locked, what it lets the agent do, how a change compares with
 * the policies in force, and the catalog as the API describes it.
 *
 * @since 0.0.0
 */
import * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import { AgentSpec, POLICIES, type PolicyEntry, PolicyId, PolicyProblem } from "./AgentSpec.ts"
import { formatDollars, formatPercent } from "./Format.ts"
import * as Policy from "./Policy.ts"

/**
 * The catalog's policy with this id.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const policyOf = (id: PolicyId): Policy.PolicyType<PolicyId, Schema.Top> =>
  POLICIES.find((policy) => policy.id === id)! as Policy.PolicyType<PolicyId, Schema.Top>

/**
 * `spec` with every hidden policy set to bluechip's defaults: added when missing, replaced when given.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const complete = (spec: AgentSpec): AgentSpec => {
  const visible = spec.policies.filter((entry) => !policyOf(entry.id).hidden)
  const hidden = POLICIES.filter((policy) => policy.hidden).map((policy) =>
    ({
      id: policy.id,
      config: policy.defaults
    }) as PolicyEntry
  )
  const policies = [...visible, ...hidden].sort((a, b) =>
    PolicyId.literals.indexOf(a.id) - PolicyId.literals.indexOf(b.id)
  )
  return new AgentSpec({ policies })
}

/**
 * Every reason `spec` can't be locked; empty when it can. Hidden policies are checked after `complete`.
 *
 * **Example** (A session without a trade policy)
 *
 * ```ts import.meta.vitest
 * import { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
 * import { checkSpec } from "@bluechip/domain/policies/Catalog"
 *
 * checkSpec(new AgentSpec({ policies: [] }))[0]?.message // => "Every agent needs this."
 * ```
 *
 * @stability unstable
 * @category validation
 * @since 0.0.0
 */
export const checkSpec = (spec: AgentSpec): ReadonlyArray<PolicyProblem> => {
  const { policies } = complete(spec)
  const problems: Array<PolicyProblem> = []
  const problem = (policy: PolicyId, field: string | null, message: string) =>
    problems.push(new PolicyProblem({ policy, field, message }))
  const ids = policies.map((entry) => entry.id)

  for (const policy of POLICIES) {
    if (policy.required && !ids.includes(policy.id)) problem(policy.id, null, "Every agent needs this.")
  }

  for (const [index, entry] of policies.entries()) {
    if (ids.indexOf(entry.id) !== index) {
      problem(entry.id, null, "Each policy can be added once.")
      continue
    }
    const policy = policyOf(entry.id)
    for (const required of policy.requires) {
      if (!ids.includes(required as PolicyId)) {
        problem(entry.id, null, `Needs ${policyOf(required as PolicyId).title.toLowerCase()}.`)
      }
    }
    for (const conflict of policy.conflicts) {
      if (ids.includes(conflict as PolicyId)) {
        problem(entry.id, null, `Can't be added with ${policyOf(conflict as PolicyId).title.toLowerCase()}.`)
      }
    }
    for (const [name, field] of Object.entries(policy.fields as Record<string, Policy.Field>)) {
      const value = (entry.config as Record<string, unknown>)[name]
      if (field.min === undefined || field.max === undefined) continue
      if (typeof value !== "number" && typeof value !== "bigint") continue
      if (value >= field.min && value <= field.max) continue
      const range = field.unit === "usd" ?
        `${formatDollars(field.min)} to ${formatDollars(field.max)}` :
        field.unit === "bps" ?
        `${formatPercent(field.min)} to ${formatPercent(field.max)}` :
        `${field.min} to ${field.max}`
      problem(entry.id, name, `Pick ${range}.`)
    }
    for (const found of policy.validate(entry.config, policies)) {
      problem(entry.id, found.field, found.message)
    }
  }
  return problems
}

/**
 * What an agent can do, and what it can never do, as sentences.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class SpecDescription
  extends Schema.Class<SpecDescription>("@bluechip/domain/policies/Catalog/SpecDescription")({
    can: Schema.Array(Schema.String),
    never: Schema.Array(Schema.String)
  })
{}

/**
 * What an agent with `spec` can and can never do, policy by policy, naming stocks with `name`.
 *
 * @stability unstable
 * @category formatting
 * @since 0.0.0
 */
export const describeSpec = (spec: AgentSpec, name: (symbol: StockSymbol) => string): SpecDescription => {
  const descriptions = spec.policies.map((entry) =>
    policyOf(entry.id).describe(entry.config, { policies: spec.policies, name })
  )
  return new SpecDescription({
    can: descriptions.flatMap((description) => description.can),
    never: [...descriptions.flatMap((description) => description.never), "Change its own policies"]
  })
}

/**
 * How one policy changes: added (the agent may do less), removed (more), or its configuration compared.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PolicyChange extends Schema.Class<PolicyChange>("@bluechip/domain/policies/Catalog/PolicyChange")({
  policy: PolicyId,
  change: Schema.Union([Policy.Change, Schema.Literals(["added", "removed"])])
}) {}

/**
 * A change of policies, policy by policy (unchanged ones left out) and as a whole (looser if any policy is).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class SpecChanges extends Schema.Class<SpecChanges>("@bluechip/domain/policies/Catalog/SpecChanges")({
  overall: Policy.Change,
  policies: Schema.Array(PolicyChange)
}) {}

/**
 * How `after` compares with `before`: adding a rule only ever narrows what the agent may do, removing one widens it.
 *
 * **Example** (Lowering the daily budget)
 *
 * ```ts import.meta.vitest
 * import { compareSpecs } from "@bluechip/domain/policies/Catalog"
 * import { draftSpec } from "@bluechip/domain/policies/Templates"
 *
 * const before = draftSpec({ template: "stockPicker", preset: "balanced", stocks: ["NVDA"], targets: [] })
 * const after = draftSpec({ template: "stockPicker", preset: "conservative", stocks: ["NVDA"], targets: [] })
 * compareSpecs(before, after).overall // => "tighter"
 * ```
 *
 * @stability unstable
 * @category comparisons
 * @since 0.0.0
 */
export const compareSpecs = (before: AgentSpec, after: AgentSpec): SpecChanges => {
  const policies = PolicyId.literals.flatMap((id): ReadonlyArray<PolicyChange> => {
    const old = before.policies.find((entry) => entry.id === id)
    const next = after.policies.find((entry) => entry.id === id)
    if (old === undefined) return next === undefined ? [] : [new PolicyChange({ policy: id, change: "added" })]
    if (next === undefined) return [new PolicyChange({ policy: id, change: "removed" })]
    const change = policyOf(id).compare(old.config, next.config)
    return change === "same" ? [] : [new PolicyChange({ policy: id, change })]
  })
  const overall = Policy.combine(
    policies.map(({ change }) => change === "added" ? "tighter" : change === "removed" ? "looser" : change)
  )
  return new SpecChanges({ overall, policies })
}

/**
 * A spec read against the catalog: why it can't be locked, what it allows, and how it compares with the policies in
 * force (`null` for a new agent).
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class SpecCheck extends Schema.Class<SpecCheck>("@bluechip/domain/policies/Catalog/SpecCheck")({
  problems: Schema.Array(PolicyProblem),
  description: SpecDescription,
  changes: Schema.NullOr(SpecChanges)
}) {}

/**
 * A field of a policy as the API describes it.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class FieldInfo extends Schema.Class<FieldInfo>("@bluechip/domain/policies/Catalog/FieldInfo")({
  name: Schema.String,
  field: Policy.Field
}) {}

/**
 * A policy as the API describes it, for forms, the assistant and other clients: its copy, fields, defaults and
 * configuration as JSON Schema.
 *
 * @stability unstable
 * @category models
 * @since 0.0.0
 */
export class PolicyInfo extends Schema.Class<PolicyInfo>("@bluechip/domain/policies/Catalog/PolicyInfo")({
  id: PolicyId,
  kind: Policy.PolicyKind,
  title: Schema.String,
  summary: Schema.String,
  aliases: Schema.Array(Schema.String),
  examples: Schema.Array(Schema.String),
  required: Schema.Boolean,
  hidden: Schema.Boolean,
  requires: Schema.Array(PolicyId),
  conflicts: Schema.Array(PolicyId),
  fields: Schema.Array(FieldInfo),
  defaults: Schema.Json,
  schema: Schema.Json
}) {}

/**
 * The catalog as the API describes it.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const catalogInfo = (): ReadonlyArray<PolicyInfo> =>
  POLICIES.map((policy) => {
    const config = policy.config as Schema.Codec<unknown, unknown>
    return new PolicyInfo({
      id: policy.id,
      kind: policy.kind,
      title: policy.title,
      summary: policy.summary,
      aliases: policy.aliases,
      examples: policy.examples,
      required: policy.required,
      hidden: policy.hidden,
      requires: policy.requires as ReadonlyArray<PolicyId>,
      conflicts: policy.conflicts as ReadonlyArray<PolicyId>,
      fields: Object.entries(policy.fields as Record<string, Policy.Field>).map(([name, field]) =>
        new FieldInfo({ name, field })
      ),
      defaults: Schema.encodeSync(Schema.toCodecJson(config))(policy.defaults) as Schema.Json,
      schema: Schema.toJsonSchemaDocument(config) as unknown as Schema.Json
    })
  })
