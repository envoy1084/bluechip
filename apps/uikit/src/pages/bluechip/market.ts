import type { ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import type { TradeOrder } from "@bluechip/ui/bluechip/order-preview"
import type { PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import type { IconName } from "@bluechip/ui/icons/icon"
import { formatDate } from "@bluechip/ui/lib/format"

/* ---------- The example market every demo on this page shares. All numbers are examples. ---------- */

export interface Quote {
  readonly name: string
  readonly price: number
  readonly close: number
}

export const START: Readonly<Record<string, Quote>> = {
  NVDA: { name: "Nvidia", price: 181.42, close: 178.1 },
  AAPL: { name: "Apple", price: 241.18, close: 242.63 },
  MSFT: { name: "Microsoft", price: 455.6, close: 451.52 },
  META: { name: "Meta", price: 612.3, close: 605.1 },
  TSLA: { name: "Tesla", price: 352.75, close: 349.8 },
  GOOGL: { name: "Alphabet", price: 178.9, close: 178.9 },
  AMZN: { name: "Amazon", price: 214.36, close: 216.02 },
  MSTR: { name: "Strategy", price: 318.2, close: 309.44 },
  SNDK: { name: "Sandisk", price: 64.85, close: 63.12 },
  SPCX: { name: "SpaceX", price: 98.4, close: 97.15 }
}
export const HOLDINGS = [["NVDA", 19.3], ["AAPL", 11.4], ["MSFT", 5.2], ["TSLA", 6.1]] as const
export const TARGET: Readonly<Record<string, number>> = { NVDA: 30, AAPL: 25, MSFT: 20, TSLA: 15, cash: 10 }
export const CAP = 30
export const RESERVE = 10
export const START_CASH = 1497.64
export const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
export const SENDER = "0x91c4E7d2A0b3f5C68e19D4a7B2c0E5f31d8a77aE"
// Market hours on Tue 24 Nov 2026: 09:30 to 16:00 New York (14:30 to 21:00 UTC); Friday's close before the weekend.
export const OPENS = Date.UTC(2026, 10, 25, 14, 30)
export const CLOSES = Date.UTC(2026, 10, 24, 21, 0)
export const FRIDAY_CLOSE = Date.UTC(2026, 10, 20, 21, 0)

export const changeOf = (q: Quote) => ((q.price - q.close) / q.close) * 100
export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// A seeded random walk from `start` to `end`, so every example chart has the same shape on every load.
export const walk = (seed: string, n: number, start: number, end: number, volatility: number): Array<number> => {
  let state = [...seed].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261)
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let x = Math.imul(state ^ (state >>> 15), 1 | state)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
  const noise = [0]
  for (let i = 1; i < n; i++) noise.push((noise[i - 1] ?? 0) + (random() - 0.5) * 2 * volatility)
  const drift = noise[n - 1] ?? 0
  return noise.map((v, i) => start + (end - start) * (i / (n - 1)) + v - drift * (i / (n - 1)))
}

export const history = (symbol: string, q: Quote) => walk(`spark-${symbol}`, 32, q.close, q.price, q.price * 0.004)

const tradingDays = (count: number): Array<Date> => {
  const days: Array<Date> = []
  const day = new Date(Date.UTC(2026, 10, 24))
  while (days.length < count) {
    if (day.getUTCDay() % 6 !== 0) days.unshift(new Date(day))
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return days
}

export const portfolioRanges = (total: number, dayChange: number): ReadonlyArray<PortfolioRange> => {
  const dayLabel = (d: Date) => formatDate(d, { time: false })
  const week = tradingDays(5), month = tradingDays(22), all = tradingDays(66)
  return [
    {
      id: "1D",
      description: "Today",
      points: walk("1D", 60, total - dayChange, total, total * 0.0012).map((value, i) => {
        const minutes = 570 + i * 5
        return {
          value,
          label: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
        }
      })
    },
    {
      id: "1W",
      description: "Past week",
      points: walk("1W", 35, total * 0.972, total, total * 0.003).map((value, i) => ({
        value,
        label: `${dayLabel(week[Math.floor(i / 7)] ?? week[0] ?? new Date())}, ${9 + (i % 7)}:30`
      }))
    },
    {
      id: "1M",
      description: "Past month",
      points: walk("1M", 22, total * 0.941, total, total * 0.006).map((value, i) => ({
        value,
        label: dayLabel(month[i] ?? new Date())
      }))
    },
    {
      id: "All",
      description: "Since 24 Aug",
      points: walk("All", 66, 10000, total, total * 0.008).map((value, i) => ({
        value,
        label: dayLabel(all[i] ?? new Date())
      }))
    }
  ]
}

export interface Activity {
  readonly id: number
  readonly kind: ActivityKind
  readonly agentId?: string
  readonly icon?: IconName
  readonly title: string
  readonly body: string
  readonly time: string
  readonly go?: "blocked" | "approval"
}

export const FIRST_ACTIVITY: ReadonlyArray<Activity> = [
  {
    id: 1,
    kind: "approval",
    agentId: "picker",
    title: "Tech picker needs your OK",
    body: "Buy $600 of Nvidia. It's over your $300 ask-me amount.",
    time: "Just now",
    go: "approval"
  },
  {
    id: 2,
    kind: "blocked",
    agentId: "picker",
    title: "Your limit stopped a trade",
    body:
      "Tech picker tried to buy $2,400 of Tesla. That would put 41% of your money in one stock; your max is 30%. Nothing was bought.",
    time: "2 min ago",
    go: "blocked"
  },
  {
    id: 3,
    kind: "trade",
    agentId: "rebalancer",
    title: "Rebalanced your portfolio",
    body: "Sold $73.61 of Nvidia and bought Apple. You're back on target.",
    time: "9:41"
  },
  {
    id: 4,
    kind: "trade",
    agentId: "weekly",
    title: "Bought $50 of Microsoft",
    body: "Your weekly buy, 0.11 shares at a fair price.",
    time: "9:30"
  },
  {
    id: 5,
    kind: "deposit",
    title: "$250.00 cash arrived",
    body: "USDC on Base, from 0x91c4…77aE. Ready to invest.",
    time: "Yesterday"
  },
  {
    id: 6,
    kind: "system",
    icon: "moon",
    title: "The US market closed",
    body: "Your agents start buying again at 09:30 New York time.",
    time: "Mon 16:00"
  }
]

export const APPROVAL_ORDER = (price: number): TradeOrder => ({
  side: "buy",
  symbol: "NVDA",
  name: "Nvidia",
  amount: 600,
  price,
  after: "Nvidia is 29% of your money",
  fee: 0.03
})
