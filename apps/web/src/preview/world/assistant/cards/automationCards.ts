// Automation cards: one drafted from your words (or a change to a saved one), read back in sentences and saved when
// you confirm; pausing or resuming one. The drafts are the catalog's, as the assistant would draft them.
import type { Card, CardStatus } from "@bluechip/domain/assistant/Card"
import { AutomationDraft, describeAutomation } from "@bluechip/domain/automations/Automation"
import { DEFAULT_SETTINGS } from "@bluechip/domain/automations/Settings"
import { defaultAutomations } from "@bluechip/domain/automations/Templates"
import type { AgentId, AutomationId, CardId, MessageId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import type { CastAgent } from "../../cast.ts"
import { automationOf, nameOf, specOf } from "../castRecords.ts"
import type { Mint } from "../mint.ts"

/** The automations the assistant drafts in the preview. */
export type DraftKind = "weeklyBuy" | "stopLoss" | "newsSell" | "priceAlert"

/** A draft of `kind` for `agent` (your own trades when `null`), on its first stock. */
export const draftOf = (kind: DraftKind, agent: CastAgent | null): AutomationDraft => {
  const symbol: StockSymbol = agent?.stocks[0] ?? "AAPL"
  const agentId: AgentId | null = agent?.id ?? null

  switch (kind) {
    case "weeklyBuy":
    case "stopLoss": {
      const template = kind === "weeklyBuy" ? "weeklyBuyer" : "stopLossGuard"
      const [draft] = defaultAutomations(
        template,
        specOf({ template, preset: agent?.preset ?? "balanced", stocks: [symbol], targets: [] }),
        agentId
      )
      return draft!
    }
    case "newsSell":
      return new AutomationDraft({
        name: `Sell ${symbol} on bad news`,
        agentId,
        trigger: { type: "news", config: { symbols: [symbol], topics: ["recall", "investigation"] } },
        conditions: [],
        action: { type: "sellShare", config: { symbol, bps: 5000 } },
        settings: { ...DEFAULT_SETTINGS, cooldownMinutes: 24 * 60 }
      })
    case "priceAlert":
      return new AutomationDraft({
        name: `${nameOf(symbol)} under $200`,
        agentId: null,
        trigger: { type: "priceCross", config: { symbol, level: Price.make(BigInt(200e8)), direction: "below" } },
        conditions: [],
        action: { type: "notify", config: { message: `${nameOf(symbol)} is under $200.` } },
        settings: DEFAULT_SETTINGS
      })
  }
}

/** A new automation (or a change to `automationId`), as `status` left it: applied, it carries the saved automation. */
export const automationCard = (
  mint: Mint,
  draft: AutomationDraft,
  options: {
    readonly status: CardStatus
    readonly automationId?: AutomationId | null
    readonly createdFrom?: MessageId | null
  }
): Card => {
  const automationId = options.automationId ?? null
  const saved = options.status === "applied" ?
    automationOf(mint, draft, {
      createdFrom: options.createdFrom ?? null,
      ...(automationId === null ? {} : { id: automationId })
    }) :
    null
  return {
    _tag: "Automation",
    id: mint.id("card") as CardId,
    action: automationId === null ? "create" : "edit",
    automationId,
    draft,
    description: describeAutomation(draft, nameOf),
    status: options.status,
    automation: saved
  }
}

/** Pausing or resuming a saved automation. */
export const automationControlCard = (
  mint: Mint,
  action: "pause" | "resume",
  automation: { readonly id: AutomationId; readonly name: string; readonly draft: AutomationDraft },
  status: CardStatus
): Card => {
  const saved = status === "applied" ?
    automationOf(mint, automation.draft, {
      createdFrom: null,
      status: action === "pause" ? "paused" : "active",
      id: automation.id,
      name: automation.name
    }) :
    null
  return {
    _tag: "AutomationControl",
    id: mint.id("card") as CardId,
    action,
    automationId: automation.id,
    automationName: automation.name,
    status,
    automation: saved
  }
}
