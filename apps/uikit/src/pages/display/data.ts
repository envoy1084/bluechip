import type { ChartSeries } from "@bluechip/ui/components/chart"

export const STOCKS = [
  { symbol: "NVDA", name: "Nvidia", price: 181.42, change: 1.86 },
  { symbol: "AAPL", name: "Apple", price: 241.18, change: -0.6 },
  { symbol: "MSFT", name: "Microsoft", price: 455.6, change: 0.9 },
  { symbol: "META", name: "Meta", price: 612.3, change: 1.19 },
  { symbol: "TSLA", name: "Tesla", price: 352.75, change: 0.84 },
  { symbol: "GOOGL", name: "Alphabet", price: 178.9, change: 0 },
  { symbol: "AMZN", name: "Amazon", price: 214.36, change: -0.77 },
  { symbol: "MSTR", name: "Strategy", price: 318.2, change: 2.83 },
  { symbol: "SNDK", name: "Sandisk", price: 64.85, change: 2.74 },
  { symbol: "SPCX", name: "SpaceX", price: 98.4, change: 1.29 },
  { symbol: "ANT", name: "Anthropic", price: 79.46, change: -0.42 },
  { symbol: "CRCL", name: "Circle", price: 47.12, change: 1.08 },
  { symbol: "INTC", name: "Intel", price: 53.62, change: -1.2 }
] as const

export const stock = (symbol: string) => STOCKS.find((s) => s.symbol === symbol) ?? STOCKS[0]

export const AGENTS = [
  { id: "rebalancer", name: "Rebalancer" },
  { id: "stock-picker", name: "Stock picker" },
  { id: "weekly-buyer", name: "Weekly buyer" },
  { id: "stop-loss", name: "Stop-loss guard" }
] as const

export const HOLDINGS = [["NVDA", 12.4], ["AAPL", 8], ["MSFT", 3.2], ["TSLA", 2.5], ["GOOGL", 6]] as const

export type TradeStatus = "Done" | "Stopped by limit" | "Waiting for you"

export interface Trade {
  readonly id: number
  readonly symbol: string
  readonly agent: (typeof AGENTS)[number]
  readonly side: "Buy" | "Sell"
  readonly amount: number
  readonly status: TradeStatus
  readonly day: number
}

export const TRADES: ReadonlyArray<Trade> = Array.from({ length: 23 }, (_, i) => ({
  id: 2860 - i,
  symbol: STOCKS[(i * 7) % STOCKS.length]!.symbol,
  agent: AGENTS[i % 4]!,
  side: (["Buy", "Sell", "Buy", "Buy", "Sell", "Buy"] as const)[i % 6]!,
  amount: Math.round((40 + ((i * 53) % 260)) * 100) / 100,
  status: (["Done", "Done", "Stopped by limit", "Done", "Waiting for you", "Done"] as const)[i % 6]!,
  day: 23 - Math.floor(i * 0.9)
}))

// 30 days of portfolio value, shaped like the kit's sample series.
const DAYS = Array.from({ length: 30 }, (_, i) => i)
/** A random-looking but fixed walk from `start`, one step per day. */
const walk = (start: number, step: (day: number, last: number) => number) => {
  const values: Array<number> = []
  for (const day of DAYS) values.push(Math.round(step(day, values.at(-1) ?? start)))
  return values
}
const STOCKS_VALUE = walk(8400, (i, last) => last + Math.sin(i * 0.55) * 120 + Math.cos(i * 0.21) * 90 + 34)
const CASH_VALUE = walk(2200, (i, last) => Math.max(900, last + Math.sin(i * 0.4 + 1) * 70 - 18))
export const DAY_LABELS = DAYS.map((i) =>
  new Date(Date.UTC(2026, 9, 26 + i)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
)
export const VALUE_SERIES: ReadonlyArray<ChartSeries> = [
  { key: "stocks", label: "Stocks", values: STOCKS_VALUE },
  { key: "cash", label: "Cash", values: CASH_VALUE }
]
export const CASH_SERIES: ReadonlyArray<ChartSeries> = [{ key: "cash", label: "Cash", values: CASH_VALUE }]
export const PROFIT_SERIES: ReadonlyArray<ChartSeries> = [{
  key: "profit",
  label: "Profit",
  values: walk(0, (i, last) => last + Math.sin(i * 0.7) * 48 + Math.cos(i * 0.33) * 20 - 6),
  signed: true
}]
export const WEEKS = ["Oct 6", "Oct 13", "Oct 20", "Oct 27", "Nov 3", "Nov 10", "Nov 17", "Nov 24"]
export const FLOW_SERIES: ReadonlyArray<ChartSeries> = [
  { key: "bought", label: "Bought", values: [420, 380, 610, 290, 540, 470, 720, 380] },
  { key: "sold", label: "Sold", values: [120, 260, 180, 340, 90, 210, 160, 240] }
]

export const FEE_SERIES: ReadonlyArray<ChartSeries> = [
  {
    key: "network",
    label: "Network",
    values: [1.2, 0.9, 1.6, 0.7, 1.3, 1.1, 1.9, 0.8],
    color: "var(--color-series-3)"
  },
  { key: "swap", label: "Swap", values: [2.4, 2.1, 3.2, 1.8, 2.7, 2.3, 3.6, 2], color: "var(--color-series-6)" }
]
