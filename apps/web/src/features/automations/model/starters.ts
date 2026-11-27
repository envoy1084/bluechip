// Ideas a new automation can start from: a whole recipe (what starts it, its checks, what it does) built from the
// catalog's defaults, about the stock it's for. Picking one fills the editor's steps; everything stays editable.
import type { Action, Condition, Trigger } from "@bluechip/domain/automations/Automation"
import type { CheckContext } from "@bluechip/domain/automations/Entry"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Price } from "@bluechip/domain/market/Units"
import { catalogEntry, type DraftFields, freshEntry, type Kind, whyUnavailable, withField } from "./drafts.ts"

export type StarterId = "weeklyBuy" | "buyTheDip" | "stopLoss" | "takeProfit" | "priceAlert" | "badNews"

/** What a starter is made of, by type; a recipe is told apart by its trigger and action. */
export interface Starter {
  readonly id: StarterId
  readonly title: string
  readonly summary: string
  readonly trigger: Trigger["type"]
  readonly conditions: ReadonlyArray<Condition["type"]>
  readonly action: Action["type"]
}

export const STARTERS: ReadonlyArray<Starter> = [
  {
    id: "weeklyBuy",
    title: "Weekly buy",
    summary: "Buy a set amount every week.",
    trigger: "schedule",
    conditions: [],
    action: "buy"
  },
  {
    id: "buyTheDip",
    title: "Buy the dip",
    summary: "Buy when a stock falls 10% from its high.",
    trigger: "priceMove",
    conditions: [],
    action: "buy"
  },
  {
    id: "stopLoss",
    title: "Stop-loss",
    summary: "Sell it all after a 10% fall from its high.",
    trigger: "priceMove",
    conditions: [],
    action: "sellShare"
  },
  {
    id: "takeProfit",
    title: "Take profit",
    summary: "Sell a quarter once it's 20% above today.",
    trigger: "priceCross",
    conditions: [],
    action: "sellShare"
  },
  {
    id: "priceAlert",
    title: "Price alert",
    summary: "Tell you when it drops 10% under today.",
    trigger: "priceCross",
    conditions: [],
    action: "notify"
  },
  {
    id: "badNews",
    title: "Bad news alert",
    summary: "Tell you when a story about it is bad news.",
    trigger: "news",
    conditions: ["judgment"],
    action: "notify"
  }
]

/** The stock a starter is about: its price is Chainlink's (USD × 1e8), `null` while there is none. */
export interface StarterStock {
  readonly symbol: StockSymbol
  readonly name: string
  readonly price: bigint | null
}

export type Recipe = Pick<DraftFields, "trigger" | "conditions" | "action">

const PRICE_SCALE = 100_000_000

// `percent` away from `price`, in whole dollars from $20 up and in cents under it, so the level reads like one a
// person would pick.
const levelAt = (price: bigint, percent: number): Price => {
  const dollars = (Number(price) / PRICE_SCALE) * (1 + percent / 100)
  const cents = dollars >= 20 ? Math.round(dollars) * 100 : Math.round(dollars * 100)
  return Price.make(BigInt(Math.max(cents, 1)) * BigInt(PRICE_SCALE / 100))
}

const fresh = <A>(kind: Kind, type: string, stock: StockSymbol, changes: Readonly<Record<string, unknown>> = {}) =>
  Object.entries(changes).reduce(
    (entry, [name, value]) => withField(entry, name, value),
    freshEntry(kind, type, stock)
  ) as A

/**
 * A starter's recipe about `stock`: the catalog's defaults, with the starter's own amounts. Price levels are set from
 * the stock's price today, or left at the catalog's when it has none.
 */
export const starterRecipe = (id: StarterId, stock: StarterStock): Recipe => {
  const { symbol } = stock
  const level = (percent: number) => stock.price === null ? {} : { level: levelAt(stock.price, percent) }

  switch (id) {
    case "weeklyBuy":
      return { trigger: fresh("trigger", "schedule", symbol), conditions: [], action: fresh("action", "buy", symbol) }
    case "buyTheDip":
      return {
        trigger: fresh("trigger", "priceMove", symbol, { direction: "down", reference: "trailingHigh", bps: 1000 }),
        conditions: [],
        action: fresh("action", "buy", symbol)
      }
    case "stopLoss":
      return {
        trigger: fresh("trigger", "priceMove", symbol, { direction: "down", reference: "trailingHigh", bps: 1000 }),
        conditions: [],
        action: fresh("action", "sellShare", symbol, { bps: 10_000 })
      }
    case "takeProfit":
      return {
        trigger: fresh("trigger", "priceCross", symbol, { direction: "above", ...level(20) }),
        conditions: [],
        action: fresh("action", "sellShare", symbol, { bps: 2500 })
      }
    case "priceAlert":
      return {
        trigger: fresh("trigger", "priceCross", symbol, { direction: "below", ...level(-10) }),
        conditions: [],
        action: fresh("action", "notify", symbol, { message: `${stock.name} fell under your price` })
      }
    case "badNews":
      return {
        trigger: fresh("trigger", "news", symbol),
        conditions: [fresh("condition", "judgment", symbol, { preset: "materiallyNegative" })],
        action: fresh("action", "notify", symbol, { message: `There's bad news about ${stock.name}` })
      }
  }
}

/** The starters that can run for this automation: an agent that only buys is offered no sales. */
export const offeredStarters = (context: Pick<CheckContext, "spec">): ReadonlyArray<Starter> =>
  STARTERS.filter((starter) => {
    const check: CheckContext = { spec: context.spec, trigger: starter.trigger }
    return [
      catalogEntry("trigger", starter.trigger),
      ...starter.conditions.map((type) => catalogEntry("condition", type)),
      catalogEntry("action", starter.action)
    ].every((entry) => whyUnavailable(entry, check) === null)
  })

/** The starter a recipe is, by its trigger, checks and action; `null` once it's something else. */
export const starterOf = (recipe: Recipe): StarterId | null =>
  STARTERS.find((starter) =>
    starter.trigger === recipe.trigger.type &&
    starter.action === recipe.action.type &&
    starter.conditions.join() === recipe.conditions.map((condition) => condition.type).join()
  )?.id ?? null
