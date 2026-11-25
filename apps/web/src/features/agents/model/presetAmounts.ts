// What each preset drafts for a built-in template, for the preset picker: a template can cap the preset's daily
// budget (the Weekly buyer spends at most $500 a day), and a trade is never bigger than the day's budget.
import { configOf } from "@bluechip/domain/policies/Policy"
import { stockCap } from "@bluechip/domain/policies/StockCap"
import { draftSpec, type Preset, type TemplateId } from "@bluechip/domain/policies/Templates"
import { trade } from "@bluechip/domain/policies/Trade"
import { tradeSize } from "@bluechip/domain/policies/TradeSize"
import type { PresetAmounts } from "@bluechip/ui/bluechip/preset-picker"
import { toDollars } from "./fieldText.ts"

const amountsOf = (template: TemplateId, preset: Preset): PresetAmounts => {
  const { policies } = draftSpec({ template, preset, stocks: [], targets: [] })
  const maxBps = configOf(policies, stockCap)?.maxBps
  return {
    dailySpend: toDollars(configOf(policies, trade)?.dailyBudget ?? 0),
    maxPerTrade: toDollars(configOf(policies, tradeSize)?.maxPerTrade ?? 0),
    ...(maxBps === undefined ? {} : { maxInOneStock: maxBps / 100 })
  }
}

/** The amounts each of the template's presets drafts. */
export const presetAmounts = (template: TemplateId): Record<Preset, PresetAmounts> => ({
  conservative: amountsOf(template, "conservative"),
  balanced: amountsOf(template, "balanced"),
  active: amountsOf(template, "active")
})
