// An agent's limits between the domain (`Limits`: USDC micro-dollars, basis points) and `@bluechip/ui`'s view of
// them (`AgentLimits`: dollars, percent), which the limit editor, permission card and agent card take.
import { Limits } from "@bluechip/domain/agents/Limits"
import type { Template } from "@bluechip/domain/agents/Templates"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Usdc } from "@bluechip/domain/market/Units"
import type { AgentTemplateName } from "@bluechip/ui/bluechip/template-picker"
import type { AgentLimits, AgentTradeMode } from "@bluechip/ui/lib/agent-limits"

const MICRO = 1_000_000

const UI_MODE: Readonly<Record<Limits["mode"], AgentTradeMode>> = {
  rebalance: "rebalance",
  buy: "buy",
  sell: "sell",
  both: "buy-and-sell"
}

const dollars = (amount: bigint): number => Number(amount) / MICRO

const usdc = (amount: number): Usdc => Usdc.make(BigInt(Math.round(amount * MICRO)))

/** The limits as `@bluechip/ui` shows them. */
export const uiLimits = (limits: Limits): AgentLimits => ({
  stocks: limits.stocks,
  mode: UI_MODE[limits.mode],
  dailySpend: dollars(limits.dailyBudget),
  maxPerTrade: dollars(limits.maxPerTrade),
  maxInOneStock: limits.maxInOneStock / 100,
  cashReserve: limits.cashReserve / 100,
  approveAbove: dollars(limits.askAbove)
})

/** `base` with what the limit editor changed: the stocks and the five number limits (mode and the rest stay). */
export const withUiLimits = (base: Limits, edited: AgentLimits): Limits =>
  new Limits({
    ...base,
    stocks: edited.stocks as ReadonlyArray<StockSymbol>,
    dailyBudget: usdc(edited.dailySpend),
    maxPerTrade: usdc(edited.maxPerTrade),
    askAbove: usdc(edited.approveAbove),
    maxInOneStock: Math.round(edited.maxInOneStock * 100),
    cashReserve: Math.round(edited.cashReserve * 100)
  })

const UI_TEMPLATE: Readonly<Record<Template, AgentTemplateName>> = {
  rebalancer: "rebalancer",
  stockPicker: "stock-picker",
  weeklyBuyer: "weekly-buyer",
  stopLossGuard: "stop-loss-guard"
}

/** A template's name in `@bluechip/ui` (`stock-picker`). */
export const uiTemplate = (template: Template): AgentTemplateName => UI_TEMPLATE[template]

/** A template from its `@bluechip/ui` name. */
export const templateOf = (name: AgentTemplateName): Template =>
  (Object.keys(UI_TEMPLATE) as Array<Template>).find((template) => UI_TEMPLATE[template] === name)!

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })

/** A lock's end as the UI says it: "21 Feb". */
export const lockedUntilLabel = (date: Date): string => dayFormat.format(date)
