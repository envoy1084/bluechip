/**
 * Editing a draft of policies the way the form and the assistant do: adding and removing optional policies with what
 * they need, keeping the trade direction and the target mix in step, and applying a template's presets. `checkSpec`
 * still decides what can be locked; these only keep the draft coherent as one field changes.
 *
 * @since 0.0.0
 */
import type * as Schema from "effect/Schema"
import type { StockSymbol } from "../market/Market.ts"
import { Usdc } from "../market/Units.ts"
import { AgentSpec, POLICIES, type PolicyEntry, type PolicyId } from "./AgentSpec.ts"
import { cashReserve } from "./CashReserve.ts"
import { complete, policyOf } from "./Catalog.ts"
import { configOf, type PolicyType } from "./Policy.ts"
import { rebalance, type Target } from "./Rebalance.ts"
import { stockCap } from "./StockCap.ts"
import { draftSpec, type Preset, type TemplateId } from "./Templates.ts"
import { type Direction, trade } from "./Trade.ts"
import { tradeSize } from "./TradeSize.ts"

/**
 * The policies people see and set, in the catalog's order; hidden ones are bluechip's alone.
 *
 * @stability unstable
 * @category constants
 * @since 0.0.0
 */
export const VISIBLE_POLICIES = POLICIES.filter((policy) => !policy.hidden)

/**
 * Whether `spec` carries `id`.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const hasPolicy = (spec: AgentSpec, id: PolicyId): boolean => spec.policies.some((entry) => entry.id === id)

/**
 * `spec` with `id`'s configuration replaced.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const withConfig = (spec: AgentSpec, id: PolicyId, config: unknown): AgentSpec =>
  new AgentSpec({
    policies: spec.policies.map((entry) => entry.id === id ? ({ id, config }) as PolicyEntry : entry)
  })

const update = <S extends Schema.Top>(
  spec: AgentSpec,
  policy: PolicyType<PolicyId, S>,
  patch: (config: S["Type"]) => S["Type"]
): AgentSpec => {
  const config = configOf(spec.policies, policy)
  return config === undefined ? spec : withConfig(spec, policy.id, patch(config))
}

/**
 * A starting mix for `stocks`: an even share each, never past the max in one stock nor into the cash reserve, and
 * cash for the rest, so it passes the target checks.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const evenTargets = (spec: AgentSpec, stocks: ReadonlyArray<StockSymbol>): ReadonlyArray<Target> => {
  if (stocks.length === 0) return []

  const reserve = configOf(spec.policies, cashReserve)?.minBps ?? 0
  const cap = configOf(spec.policies, stockCap)?.maxBps ?? 10_000
  const room = 100 - Math.ceil(reserve / 100)
  const each = Math.min(Math.floor(room / stocks.length), Math.floor(cap / 100))

  return [
    ...stocks.map((asset) => ({ asset, weight: each * 100 })),
    { asset: "USDC" as const, weight: (100 - each * stocks.length) * 100 }
  ]
}

const resetTargets = (spec: AgentSpec): AgentSpec =>
  update(spec, rebalance, (config) => ({
    ...config,
    targets: evenTargets(spec, configOf(spec.policies, trade)?.stocks ?? [])
  }))

/**
 * The stocks it trades; a target mix starts again from an even split of the new ones.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const setStocks = (spec: AgentSpec, stocks: ReadonlyArray<StockSymbol>): AgentSpec =>
  resetTargets(update(spec, trade, (config) => ({ ...config, stocks })))

const insert = (spec: AgentSpec, id: PolicyId): AgentSpec =>
  hasPolicy(spec, id) ?
    spec :
    complete(new AgentSpec({ policies: [...spec.policies, ({ id, config: policyOf(id).defaults }) as PolicyEntry] }))

const drop = (spec: AgentSpec, id: PolicyId): AgentSpec =>
  new AgentSpec({ policies: spec.policies.filter((entry) => entry.id !== id) })

/**
 * The direction it trades. Rebalancing comes with a target mix (and only on live prices); any other direction drops
 * the mix. An agent that only sells never spends, and one that stops only selling gets the standard budget back.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const setDirection = (spec: AgentSpec, direction: Direction): AgentSpec => {
  const before = configOf(spec.policies, trade)
  const budget = direction === "sell" ?
    Usdc.make(BigInt(0)) :
    before?.direction === "sell" || before === undefined ?
    trade.defaults.dailyBudget :
    before.dailyBudget
  const next = update(spec, trade, (config) => ({ ...config, direction, dailyBudget: budget }))

  if (direction !== "rebalance") return drop(next, "rebalance")
  return resetTargets(insert(next, "rebalance"))
}

/**
 * Adds an optional policy with its defaults and every policy it needs; a target mix also makes it rebalance.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const addPolicy = (spec: AgentSpec, id: PolicyId): AgentSpec => {
  if (id === "rebalance") return setDirection(spec, "rebalance")
  const withNeeds = policyOf(id).requires.reduce((next, needed) => insert(next, needed as PolicyId), spec)
  return insert(withNeeds, id)
}

/**
 * Removes an optional policy; without its target mix a Rebalancer buys and sells instead.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const removePolicy = (spec: AgentSpec, id: PolicyId): AgentSpec =>
  id === "rebalance" ? setDirection(spec, "both") : drop(spec, id)

const titleOf = (id: string) => policyOf(id as PolicyId).title.toLowerCase()

/**
 * Why `id` can't be added to `spec` right now, if it can't.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const cantAdd = (spec: AgentSpec, id: PolicyId): string | undefined => {
  const policy = policyOf(id)
  const clash = spec.policies.find((entry) =>
    policy.conflicts.includes(entry.id) || policyOf(entry.id).conflicts.includes(id)
  )
  return clash === undefined ? undefined : `Can't be added with ${titleOf(clash.id)}.`
}

/**
 * Why `id` can't be removed from `spec`, if it can't: every agent needs it, or another policy does.
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const cantRemove = (spec: AgentSpec, id: PolicyId): string | undefined => {
  if (policyOf(id).required) return "Every agent has this."
  const needs = spec.policies.find((entry) => policyOf(entry.id).requires.includes(id))
  return needs === undefined ? undefined : `Your ${titleOf(needs.id)} needs it.`
}

/**
 * A new agent built from nothing: every policy an agent needs, at its defaults.
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const scratchSpec = (): AgentSpec =>
  complete(
    new AgentSpec({
      policies: POLICIES.filter((policy) => policy.required && !policy.hidden).map((policy) =>
        ({ id: policy.id, config: policy.defaults }) as PolicyEntry
      )
    })
  )

/**
 * A template's spec from a preset, keeping the stocks already picked (and an even mix for a Rebalancer).
 *
 * @stability unstable
 * @category constructors
 * @since 0.0.0
 */
export const templateSpec = (template: TemplateId, preset: Preset, stocks: ReadonlyArray<StockSymbol>): AgentSpec =>
  resetTargets(draftSpec({ template, preset, stocks, targets: [] }))

// The amounts a preset sets, in the order the policies that hold them list them.
const presetAmounts = (spec: AgentSpec) => [
  configOf(spec.policies, trade)?.dailyBudget,
  configOf(spec.policies, tradeSize)?.maxPerTrade,
  configOf(spec.policies, stockCap)?.maxBps,
  configOf(spec.policies, cashReserve)?.minBps
]

/**
 * The preset whose amounts `spec` has, if any (otherwise its amounts are custom).
 *
 * @stability unstable
 * @category getters
 * @since 0.0.0
 */
export const presetOf = (spec: AgentSpec, template: TemplateId, presets: ReadonlyArray<Preset>): Preset | undefined => {
  const amounts = presetAmounts(spec)
  return presets.find((preset) => {
    const drafted = presetAmounts(draftSpec({ template, preset, stocks: [], targets: [] }))
    return amounts.every((amount, index) => amount === undefined || amount === drafted[index])
  })
}

/**
 * `spec` with a preset's amounts, leaving every other choice as it is.
 *
 * @stability unstable
 * @category edits
 * @since 0.0.0
 */
export const applyPreset = (spec: AgentSpec, template: TemplateId, preset: Preset): AgentSpec => {
  const drafted = draftSpec({ template, preset, stocks: [], targets: [] }).policies
  const budget = configOf(drafted, trade)?.dailyBudget
  const maxPerTrade = configOf(drafted, tradeSize)?.maxPerTrade

  let next = update(spec, trade, (config) => ({ ...config, dailyBudget: budget ?? config.dailyBudget }))
  next = update(next, tradeSize, (config) => ({ ...config, maxPerTrade: maxPerTrade ?? config.maxPerTrade }))
  next = update(next, stockCap, (config) => configOf(drafted, stockCap) ?? config)
  next = update(next, cashReserve, (config) => configOf(drafted, cashReserve) ?? config)
  return resetTargets(next)
}
