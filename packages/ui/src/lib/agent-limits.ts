/* An agent's limits and how bluechip reads them back: rules as sentences, presets, validation, and whether a change
   is tighter (applies at once) or looser (needs Face ID). Copy follows the brand kit's Agents & limits view. */
import { findTicker } from "./tickers.ts"

/** What kind of trades an agent may make. A Rebalancer only trades back toward your target mix. */
export type AgentTradeMode = "rebalance" | "buy" | "sell" | "buy-and-sell"

export interface AgentLimits {
  /** Market symbols the agent may trade. */
  readonly stocks: ReadonlyArray<string>
  readonly mode: AgentTradeMode
  /** Dollars it may spend in a day. 0 means it never buys (a sell-only agent). */
  readonly dailySpend: number
  /** Dollars per trade, at most. */
  readonly maxPerTrade: number
  /** Percent of your money any one stock may reach. */
  readonly maxInOneStock: number
  /** Percent of your money always kept as cash (USDC). */
  readonly cashReserve: number
  /** Trades above this many dollars wait for your approval. 0 means every trade does. */
  readonly approveAbove: number
}

/** The limits a number field sets. */
export type LimitField = "dailySpend" | "maxPerTrade" | "maxInOneStock" | "cashReserve" | "approveAbove"

export interface LimitFieldSpec {
  readonly field: LimitField
  readonly label: string
  readonly help: string
  readonly min: number
  readonly max: number
  readonly step: number
  readonly unit: "dollars" | "percent"
  /** Which way is tighter: a lower value (-1) or a higher one (1). A bigger cash reserve is tighter. */
  readonly tighter: -1 | 1
}

/** The five number limits, in the editor's order, with the range each accepts. */
export const LIMIT_FIELDS: ReadonlyArray<LimitFieldSpec> = [
  {
    field: "dailySpend",
    label: "Daily spend",
    help: "The most it can spend in a day. Resets at midnight UTC.",
    min: 0,
    max: 2000,
    step: 10,
    unit: "dollars",
    tighter: -1
  },
  {
    field: "maxPerTrade",
    label: "Max per trade",
    help: "No single trade can be bigger than this.",
    min: 10,
    max: 1000,
    step: 10,
    unit: "dollars",
    tighter: -1
  },
  {
    field: "maxInOneStock",
    label: "Max in one stock",
    help: "Share of your money any one stock can reach.",
    min: 5,
    max: 100,
    step: 1,
    unit: "percent",
    tighter: -1
  },
  {
    field: "cashReserve",
    label: "Cash reserve",
    help: "Always keep at least this much as cash.",
    min: 0,
    max: 50,
    step: 1,
    unit: "percent",
    tighter: 1
  },
  {
    field: "approveAbove",
    label: "Ask me above",
    help: "Bigger trades wait for your approval. 0 means every trade.",
    min: 0,
    max: 1000,
    step: 10,
    unit: "dollars",
    tighter: -1
  }
]

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

/** Whole dollars, as limits are set: "$1,000". */
export const formatDollars = (value: number): string => dollars.format(value)

/** A limit's value with its unit: "$250" or "30%". */
export const formatLimit = (spec: LimitFieldSpec, value: number): string =>
  spec.unit === "dollars" ? formatDollars(value) : `${value}%`

export type LimitPresetName = "conservative" | "balanced" | "active"

export interface LimitPreset {
  readonly name: LimitPresetName
  readonly label: string
  readonly blurb: string
  readonly limits: Pick<AgentLimits, LimitField>
}

/** Three starting points, so nobody faces five sliders first. */
export const LIMIT_PRESETS: ReadonlyArray<LimitPreset> = [
  {
    name: "conservative",
    label: "Conservative",
    blurb: "Small, careful trades",
    limits: { dailySpend: 100, maxPerTrade: 50, maxInOneStock: 20, cashReserve: 20, approveAbove: 50 }
  },
  {
    name: "balanced",
    label: "Balanced",
    blurb: "Most people start here",
    limits: { dailySpend: 250, maxPerTrade: 100, maxInOneStock: 30, cashReserve: 10, approveAbove: 150 }
  },
  {
    name: "active",
    label: "Active",
    blurb: "More room, still capped",
    limits: { dailySpend: 1000, maxPerTrade: 400, maxInOneStock: 40, cashReserve: 5, approveAbove: 500 }
  }
]

/** The preset whose values these limits match exactly, if any; otherwise they are custom. */
export const matchPreset = (limits: Pick<AgentLimits, LimitField>): LimitPresetName | undefined =>
  LIMIT_PRESETS.find((preset) => LIMIT_FIELDS.every(({ field }) => preset.limits[field] === limits[field]))?.name

const stockName = (symbol: string): string => findTicker(symbol)?.name ?? symbol

const listStocks = (symbols: ReadonlyArray<string>): string => {
  const names = symbols.map(stockName)
  if (names.length === 0) return "no stocks yet"
  if (names.length > 3) return `${names.slice(0, 3).join(", ")} +${names.length - 3}`
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

export interface LimitRules {
  readonly can: ReadonlyArray<string>
  readonly never: ReadonlyArray<string>
}

/** Limits read back as sentences: what the agent can do, and what it can never do. */
export const limitRules = (limits: AgentLimits): LimitRules => {
  const stocks = listStocks(limits.stocks)
  const trade = {
    rebalance: `Trade ${stocks}, only to move you back to your target mix`,
    buy: `Buy ${stocks}`,
    sell: `Sell ${stocks}`,
    "buy-and-sell": `Buy and sell ${stocks}`
  }[limits.mode]
  const can = [
    trade,
    ...(limits.dailySpend > 0 ? [`Spend up to ${formatDollars(limits.dailySpend)} a day`] : []),
    `Up to ${formatDollars(limits.maxPerTrade)} per trade`,
    limits.approveAbove > 0 ?
      `Ask you before trades over ${formatDollars(limits.approveAbove)}` :
      "Ask you before every trade"
  ]
  const never = [
    "Send money out of your account",
    ...(limits.maxInOneStock < 100 ? [`Put over ${limits.maxInOneStock}% of your money in one stock`] : []),
    ...(limits.cashReserve > 0 ? [`Leave less than ${limits.cashReserve}% in cash`] : []),
    "Pay more than 1% off the market price",
    "Change its own limits"
  ]
  return { can, never }
}

/** What a limit errors on: a field, or the stock list. */
export type LimitErrorKey = LimitField | "stocks"

/** Problems that block locking, each said as a sentence. Empty when the limits are valid. */
export const limitErrors = (limits: AgentLimits): Partial<Record<LimitErrorKey, string>> => {
  const errors: Partial<Record<LimitErrorKey, string>> = {}
  for (const spec of LIMIT_FIELDS) {
    const value = limits[spec.field]
    if (!Number.isFinite(value) || value < spec.min || value > spec.max) {
      errors[spec.field] = `Pick ${formatLimit(spec, spec.min)} to ${formatLimit(spec, spec.max)}.`
    }
  }
  if (!errors.maxPerTrade && limits.dailySpend > 0 && limits.maxPerTrade > limits.dailySpend) {
    errors.maxPerTrade = `Can't be more than the daily spend (${formatDollars(limits.dailySpend)}).`
  }
  if (!errors.cashReserve && limits.maxInOneStock + limits.cashReserve > 100) {
    errors.cashReserve = "Cash reserve plus max in one stock can't pass 100%."
  }
  if (limits.stocks.length === 0) errors.stocks = "Pick at least one stock."
  return errors
}

/** How a change compares with the limits in force. Tighter applies at once; looser needs Face ID. */
export type LimitChange = "same" | "tighter" | "looser"

/** How one number limit changed. */
export const compareField = (spec: LimitFieldSpec, before: number, after: number): LimitChange => {
  if (before === after) return "same"
  return Math.sign(after - before) === spec.tighter ? "tighter" : "looser"
}

/** How the stock list changed: any added stock gives the agent more room. */
export const compareStocks = (before: ReadonlyArray<string>, after: ReadonlyArray<string>): LimitChange => {
  if (after.some((symbol) => !before.includes(symbol))) return "looser"
  return before.some((symbol) => !after.includes(symbol)) ? "tighter" : "same"
}

/**
 * How the trade mode changed: narrowing "buy and sell" to one direction (or to rebalancing) is tighter; any other
 * change lets the agent make trades it couldn't before.
 */
export const compareMode = (before: AgentTradeMode, after: AgentTradeMode): LimitChange => {
  if (before === after) return "same"
  return before === "buy-and-sell" ? "tighter" : "looser"
}

/** The change as a whole: looser if any part is looser, so it needs Face ID. */
export const compareLimits = (before: AgentLimits, after: AgentLimits): LimitChange => {
  const changes = [
    compareMode(before.mode, after.mode),
    compareStocks(before.stocks, after.stocks),
    ...LIMIT_FIELDS.map((spec) => compareField(spec, before[spec.field], after[spec.field]))
  ]
  if (changes.includes("looser")) return "looser"
  return changes.includes("tighter") ? "tighter" : "same"
}
