import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentSpec, PolicyId } from "@bluechip/domain/policies/AgentSpec"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { formatDollars, listNames } from "@bluechip/domain/policies/Format"
import { configOf } from "@bluechip/domain/policies/Policy"
import {
  addPolicy,
  applyPreset,
  cantAdd,
  cantRemove,
  hasPolicy,
  removePolicy,
  templateSpec,
  VISIBLE_POLICIES
} from "@bluechip/domain/policies/SpecEdits"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { draftSpec, type Preset } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { PolicyGroup, PolicyRow } from "@bluechip/ui/bluechip/policy-row"
import { type PresetAmounts, PresetPicker } from "@bluechip/ui/bluechip/preset-picker"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { findTicker } from "@bluechip/ui/lib/tickers"
import { Seal } from "@bluechip/ui/motion/seal"
import { type ComponentType, useEffect, useRef, useState } from "react"
import { usdcDollars } from "../../../lib/amounts.ts"
import { useInView } from "../hooks/useInView.ts"

/** An agent's rules at a glance, as the new-agent flow shows them; it comes from the agents feature, through the route. */
export type GlanceView = ComponentType<{
  spec: AgentSpec
  nameOf: (symbol: StockSymbol) => string
  lockedLine?: string
}>

const STOCKS: ReadonlyArray<StockSymbol> = ["NVDA", "AAPL", "MSFT"]
// As the new-agent form lays them out: its limits, then the fine-tuning most people leave alone, folded away.
const FINE_TUNING: ReadonlyArray<PolicyId> = ["fairPrice", "slippageBudget", "tradesPerDay"]
const LIMITS = VISIBLE_POLICIES.map((policy) => policy.id as PolicyId)
  .filter((id) => id !== "trade" && !FINE_TUNING.includes(id))
const LOCK_DAYS = 90

const nameOf = (symbol: StockSymbol): string => findTicker(symbol)?.name ?? symbol

const amountsOf = (preset: Preset): PresetAmounts => {
  const { policies } = draftSpec({ template: "stockPicker", preset, stocks: [], targets: [] })
  const maxBps = configOf(policies, stockCap)?.maxBps
  return {
    dailySpend: usdcDollars(configOf(policies, trade)?.dailyBudget ?? BigInt(0)),
    maxPerTrade: usdcDollars(configOf(policies, tradeSize)?.maxPerTrade ?? BigInt(0)),
    ...(maxBps === undefined ? {} : { maxInOneStock: maxBps / 100 })
  }
}

const AMOUNTS = {
  conservative: amountsOf("conservative"),
  balanced: amountsOf("balanced"),
  active: amountsOf("active")
}

// A rule's collapsed line, in the catalog's words, as the new-agent form reads it.
const summaryOf = (spec: AgentSpec, id: PolicyId): string => {
  const entry = spec.policies.find((candidate) => candidate.id === id)
  if (entry === undefined) return policyOf(id).summary
  const { can, never } = policyOf(id).describe(entry.config as never, { policies: spec.policies, name: nameOf })
  if (can.length > 0) return `${can.join(". ")}.`
  return never.length > 0 ?
    `Never ${never.map((line) => line.charAt(0).toLowerCase() + line.slice(1)).join(", or ")}.` :
    policyOf(id).summary
}

const lockDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

/**
 * A Stock picker being set up with the same pieces as the new-agent flow: presets, each rule folded to a line (the
 * optional ones switch, the fine-tuning folded away), its rules at a glance and its worst day. It locks with Face ID once it comes into view, and
 * every change locks it again, as a real change would.
 */
export function LimitsDemo({ Glance }: Readonly<{ Glance: GlanceView }>) {
  const root = useRef<HTMLDivElement>(null)
  const seen = useInView(root)
  const [preset, setPreset] = useState<Preset>("balanced")
  const [spec, setSpec] = useState(() => templateSpec("stockPicker", "balanced", STOCKS))
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  // Locked a moment after it is seen, and again a moment after each change unlocks it.
  useEffect(() => {
    if (!seen || lockedUntil !== null) return
    const timer = window.setTimeout(() => setLockedUntil(lockDay.format(Date.now() + LOCK_DAYS * 86_400_000)), 700)
    return () => window.clearTimeout(timer)
  }, [seen, lockedUntil])

  const change = (next: AgentSpec) => {
    setLockedUntil(null)
    setSpec(next)
  }

  const budget = configOf(spec.policies, trade)?.dailyBudget ?? BigInt(0)
  const perTrade = configOf(spec.policies, tradeSize)?.maxPerTrade ?? BigInt(0)

  const row = (id: PolicyId) => {
    const policy = policyOf(id)
    const on = hasPolicy(spec, id)
    const blocked = on ? cantRemove(spec, id) : cantAdd(spec, id)
    return (
      <PolicyRow
        key={id}
        title={policy.title}
        off={!on}
        summary={summaryOf(spec, id)}
        control={policy.required ?
          <Icon name="lock" size={16} label="Every agent has this rule" className="text-g-400" /> :
          (
            <Switch
              aria-label={policy.title}
              checked={on}
              disabled={blocked !== undefined}
              onCheckedChange={(checked) => change(checked ? addPolicy(spec, id) : removePolicy(spec, id))}
            />
          )}
      >
        <p className="text-label text-g-600">{policy.summary}</p>
      </PolicyRow>
    )
  }

  return (
    <div
      ref={root}
      className="grid items-start gap-4 rounded-[28px] bg-[linear-gradient(180deg,var(--color-g-50),#fff)] p-3 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
    >
      <div className="grid min-w-0 gap-3.5">
        <PolicyGroup
          title="Its limits"
          description="Checked onchain on every trade it makes."
          media={<AgentAvatar agentId="Stock picker" />}
          aside={
            <span className="flex gap-1">
              {STOCKS.map((symbol) => <TickerChip key={symbol} symbol={symbol} size="sm" />)}
            </span>
          }
        >
          <div className="grid gap-2 border-b border-g-100 px-[18px] py-4">
            <span className="text-label font-semibold text-g-800">Start from a preset</span>
            <PresetPicker
              value={preset}
              amounts={AMOUNTS}
              onValueChange={(picked) => {
                setPreset(picked.name)
                change(applyPreset(spec, "stockPicker", picked.name))
              }}
            />
          </div>
          {LIMITS.map(row)}
        </PolicyGroup>
        <Collapsible className="overflow-hidden rounded-lg bg-white shadow-e1">
          <CollapsibleTrigger className="group/adv flex w-full cursor-pointer items-center justify-between gap-2 px-[18px] py-3.5 text-left hover:bg-g-50">
            <span className="grid gap-0.5">
              <span className="text-[14px] font-semibold">Fine-tuning</span>
              <span className="text-label text-g-500">Price checks, slippage and trades a day.</span>
            </span>
            <Icon
              name="chevron-down"
              size={16}
              className="text-g-500 transition-transform duration-base ease-brand group-data-panel-open/adv:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-g-100">{FINE_TUNING.map(row)}</div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-24">
        <Glance
          spec={spec}
          nameOf={nameOf}
          lockedLine={lockedUntil === null ? "Not locked yet" : `Locked with Face ID until ${lockedUntil}`}
        />
        <WorstCaseCard>
          On its worst day it could spend at most <b>{formatDollars(budget)}</b>, up to <b>{formatDollars(perTrade)}</b>
          {" "}
          a trade, only in {listNames(STOCKS.map(nameOf))}.
        </WorstCaseCard>
        <div className="flex items-center gap-3 rounded-lg bg-white p-3 pr-4 shadow-e2">
          <Seal playing={lockedUntil !== null} label="Locked with Face ID" className="size-14 shrink-0" />
          <p aria-live="polite" className="text-label text-g-600">
            {lockedUntil === null ?
              "Every change waits for your Face ID." :
              <b className="font-semibold text-ink">Locked. bluechip checks every trade against it.</b>}
          </p>
        </div>
      </div>
    </div>
  )
}
