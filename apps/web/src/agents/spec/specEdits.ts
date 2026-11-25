// Editing a draft of policies the way the form does: adding and removing optional policies with what they need,
// keeping the trade direction and the target mix in step, and applying a template's presets. `checkSpec` still decides
// what can be locked; these only keep the draft coherent as one field changes.
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import { AgentSpec, POLICIES, type PolicyEntry, type PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { cashReserve } from "@bluechip/domain/policies/CashReserve"
import { complete, policyOf } from "@bluechip/domain/policies/Catalog"
import { fairPrice } from "@bluechip/domain/policies/FairPrice"
import { configOf, type PolicyType } from "@bluechip/domain/policies/Policy"
import { rebalance, type Target } from "@bluechip/domain/policies/Rebalance"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { draftSpec, type Preset, type TemplateId } from "@bluechip/domain/policies/Templates"
import { type Direction, trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import type * as Schema from "effect/Schema"

/** The policies people see and set, in the catalog's order; hidden ones are bluechip's alone. */
export const VISIBLE_POLICIES = POLICIES.filter((policy) => !policy.hidden)

export const hasPolicy = (spec: AgentSpec, id: PolicyId): boolean => spec.policies.some((entry) => entry.id === id)

/** `spec` with `id`'s configuration replaced. */
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

/** The stocks it trades; a target mix starts again from an even split of the new ones. */
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
  return resetTargets(
    update(insert(next, "rebalance"), fairPrice, (config) => ({ ...config, tradeWhilePaused: false }))
  )
}

/** Adds an optional policy with its defaults and every policy it needs; a target mix also makes it rebalance. */
export const addPolicy = (spec: AgentSpec, id: PolicyId): AgentSpec => {
  if (id === "rebalance") return setDirection(spec, "rebalance")
  const withNeeds = policyOf(id).requires.reduce((next, needed) => insert(next, needed as PolicyId), spec)
  return insert(withNeeds, id)
}

/** Removes an optional policy; without its target mix a Rebalancer buys and sells instead. */
export const removePolicy = (spec: AgentSpec, id: PolicyId): AgentSpec =>
  id === "rebalance" ? setDirection(spec, "both") : drop(spec, id)

const titleOf = (id: string) => policyOf(id as PolicyId).title.toLowerCase()

/** Why `id` can't be added to `spec` right now, if it can't. */
export const cantAdd = (spec: AgentSpec, id: PolicyId): string | undefined => {
  const policy = policyOf(id)
  const clash = spec.policies.find((entry) =>
    policy.conflicts.includes(entry.id) || policyOf(entry.id).conflicts.includes(id)
  )
  return clash === undefined ? undefined : `Can't be added with ${titleOf(clash.id)}.`
}

/** Why `id` can't be removed from `spec`, if it can't: every agent needs it, or another policy does. */
export const cantRemove = (spec: AgentSpec, id: PolicyId): string | undefined => {
  if (policyOf(id).required) return "Every agent has this."
  const needs = spec.policies.find((entry) => policyOf(entry.id).requires.includes(id))
  return needs === undefined ? undefined : `Your ${titleOf(needs.id)} needs it.`
}

/** A new agent built from nothing: every policy an agent needs, at its defaults. */
export const scratchSpec = (): AgentSpec =>
  complete(
    new AgentSpec({
      policies: POLICIES.filter((policy) => policy.required && !policy.hidden).map((policy) =>
        ({ id: policy.id, config: policy.defaults }) as PolicyEntry
      )
    })
  )

/** A template's spec from a preset, keeping the stocks already picked (and an even mix for a Rebalancer). */
export const templateSpec = (template: TemplateId, preset: Preset, stocks: ReadonlyArray<StockSymbol>): AgentSpec =>
  resetTargets(draftSpec({ template, preset, stocks, targets: [] }))

// The amounts a preset sets, in the order the policies that hold them list them.
const presetAmounts = (spec: AgentSpec) => [
  configOf(spec.policies, trade)?.dailyBudget,
  configOf(spec.policies, tradeSize)?.maxPerTrade,
  configOf(spec.policies, stockCap)?.maxBps,
  configOf(spec.policies, cashReserve)?.minBps
]

/** The preset whose amounts `spec` has, if any (otherwise its amounts are custom). */
export const presetOf = (spec: AgentSpec, template: TemplateId, presets: ReadonlyArray<Preset>): Preset | undefined => {
  const amounts = presetAmounts(spec)
  return presets.find((preset) => {
    const drafted = presetAmounts(draftSpec({ template, preset, stocks: [], targets: [] }))
    return amounts.every((amount, index) => amount === undefined || amount === drafted[index])
  })
}

/** `spec` with a preset's amounts, leaving every other choice as it is. */
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
