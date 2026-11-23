import { ActivityItem, type ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { AllocationBar, capState } from "@bluechip/ui/bluechip/allocation-bar"
import { AllocationDonut, type AllocationSlice } from "@bluechip/ui/bluechip/allocation-donut"
import { AllocationEditor } from "@bluechip/ui/bluechip/allocation-editor"
import { ApprovalCard, type ApprovalProgress, ApprovalSheet } from "@bluechip/ui/bluechip/approval-sheet"
import { BlockedTradeCard } from "@bluechip/ui/bluechip/blocked-trade-card"
import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { CashHoldingRow, HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { KillSwitch } from "@bluechip/ui/bluechip/kill-switch"
import { type MarketState, MarketStatus } from "@bluechip/ui/bluechip/market-status"
import { MoneyInput } from "@bluechip/ui/bluechip/money-input"
import {
  FairPriceCheck,
  OrderPreview,
  OrderPreviewRow,
  type TradeOrder,
  TradeOrderPreview
} from "@bluechip/ui/bluechip/order-preview"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { PortfolioChart, type PortfolioRange } from "@bluechip/ui/bluechip/portfolio-chart"
import { Price, PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { StockRow } from "@bluechip/ui/bluechip/stock-row"
import { CASH_SYMBOL, TickerChip, TickerToggle } from "@bluechip/ui/bluechip/ticker-chip"
import { TickerMarquee } from "@bluechip/ui/bluechip/ticker-marquee"
import { type TransactionState, TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Button } from "@bluechip/ui/components/button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Label } from "@bluechip/ui/components/label"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { Toaster } from "@bluechip/ui/components/toast"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatDate, formatMoney } from "@bluechip/ui/lib/format"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useId, useRef, useState } from "react"

export const Route = createFileRoute("/kit/bluechip")({ component: KitBluechip })

/* ---------- The example market every demo on this page shares. All numbers are examples. ---------- */

interface Quote {
  readonly name: string
  readonly price: number
  readonly close: number
}

const START: Readonly<Record<string, Quote>> = {
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
const HOLDINGS = [["NVDA", 19.3], ["AAPL", 11.4], ["MSFT", 5.2], ["TSLA", 6.1]] as const
const TARGET: Readonly<Record<string, number>> = { NVDA: 30, AAPL: 25, MSFT: 20, TSLA: 15, cash: 10 }
const CAP = 30
const RESERVE = 10
const START_CASH = 1497.64
const ADDRESS = "0x7a3F9C41b2E08d5A6c1F4e9B03D7a2C58e61B9d4"
const SENDER = "0x91c4E7d2A0b3f5C68e19D4a7B2c0E5f31d8a77aE"
// Market hours on Tue 24 Nov 2026: 09:30 to 16:00 New York (14:30 to 21:00 UTC); Friday's close before the weekend.
const OPENS = Date.UTC(2026, 10, 25, 14, 30)
const CLOSES = Date.UTC(2026, 10, 24, 21, 0)
const FRIDAY_CLOSE = Date.UTC(2026, 10, 20, 21, 0)

const changeOf = (q: Quote) => ((q.price - q.close) / q.close) * 100
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// A seeded random walk from `start` to `end`, so every example chart has the same shape on every load.
const walk = (seed: string, n: number, start: number, end: number, volatility: number): Array<number> => {
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

const history = (symbol: string, q: Quote) => walk(`spark-${symbol}`, 32, q.close, q.price, q.price * 0.004)

const tradingDays = (count: number): Array<Date> => {
  const days: Array<Date> = []
  const day = new Date(Date.UTC(2026, 10, 24))
  while (days.length < count) {
    if (day.getUTCDay() % 6 !== 0) days.unshift(new Date(day))
    day.setUTCDate(day.getUTCDate() - 1)
  }
  return days
}

const portfolioRanges = (total: number, dayChange: number): ReadonlyArray<PortfolioRange> => {
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

interface Activity {
  readonly id: number
  readonly kind: ActivityKind
  readonly agentId?: string
  readonly icon?: IconName
  readonly title: string
  readonly body: string
  readonly time: string
  readonly go?: "blocked" | "approval"
}

const FIRST_ACTIVITY: ReadonlyArray<Activity> = [
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

const APPROVAL_ORDER = (price: number): TradeOrder => ({
  side: "buy",
  symbol: "NVDA",
  name: "Nvidia",
  amount: 600,
  price,
  after: "Nvidia is 29% of your money",
  fee: 0.03
})

/* ---------- Page scaffolding (mirrors the brand kit's #product-ui layout) ---------- */

function ExampleFlag({ children = "Example" }: { readonly children?: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-warn-wash px-2 py-0.5 text-[11.5px] font-semibold text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]">
      {children}
    </span>
  )
}

function Group(
  { id, title, intro, children }: {
    readonly id: string
    readonly title: string
    readonly intro: string
    readonly children: ReactNode
  }
) {
  return (
    <div id={id} className="scroll-mt-6 pt-14">
      <div className="grid max-w-[760px] gap-2.5 pb-2">
        <h2 className="text-[clamp(26px,3.2vw,34px)] leading-[1.1] font-semibold tracking-[-0.035em]">{title}</h2>
        <p className="text-[15.5px] text-g-600">{intro}</p>
      </div>
      {children}
    </div>
  )
}

function Section(
  { id, title, purpose, notes, states, children }: {
    readonly id: string
    readonly title: string
    readonly purpose: string
    readonly notes: ReadonlyArray<string>
    readonly states?: ReadonlyArray<readonly [string, ReactNode, boolean?]>
    readonly children: ReactNode
  }
) {
  const titleId = useId()
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="grid scroll-mt-6 gap-[18px] border-t border-ink/6 py-8 first-of-type:border-t-0 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 lg:py-10"
    >
      <div className="grid content-start gap-2.5 lg:sticky lg:top-6">
        <h3 id={titleId} className="text-title-3 font-semibold">{title}</h3>
        <p className="text-body-sm text-g-600">{purpose}</p>
        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 lg:grid lg:gap-1.5">
          {notes.map((note) => (
            <li
              key={note}
              className="relative pl-3.5 text-label-sm text-g-500 before:absolute before:top-[7px] before:left-0.5 before:size-[5px] before:rounded-[1.5px] before:bg-g-300"
            >
              {note}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid min-w-0 gap-3">
        <div
          className="grid min-w-0 grid-cols-[minmax(0,1fr)] place-items-center rounded-xl px-3.5 py-5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)] sm:p-8"
          style={{ background: STAGE }}
        >
          {children}
        </div>
        {states && states.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,210px),1fr))] gap-2.5">
            {states.map(([label, content, wide]) => (
              <figure
                key={label}
                className={cn(
                  "m-0 grid min-w-0 content-start gap-3 rounded-lg bg-white px-3.5 pt-3 pb-4 shadow-e1",
                  wide && "col-span-full"
                )}
              >
                <figcaption className="text-[11.5px] font-semibold text-g-500">{label}</figcaption>
                <div className="flex min-h-9 min-w-0 flex-wrap items-center gap-2.5">{content}</div>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

const card = "w-full rounded-lg bg-white shadow-e2"
const STAGE =
  "radial-gradient(circle at 1px 1px, rgba(10,11,13,.07) 1px, transparent 1.2px) 0 0 / 16px 16px, linear-gradient(180deg, #f7f8fa, #f3f4f7)"

/* ---------- Page ---------- */

function KitBluechip() {
  const [prices, setPrices] = useState(START)
  const [market, setMarket] = useState<"open" | "closed">("open")
  const [cash, setCash] = useState(START_CASH)
  const [paused, setPaused] = useState(false)
  const [deposit, setDeposit] = useState<{ readonly arrived: boolean; readonly amount: number; readonly key: number }>(
    { arrived: false, amount: 0, key: 0 }
  )
  const [blockedKey, setBlockedKey] = useState(0)
  const [approvalKey, setApprovalKey] = useState(0)
  const [activity, setActivity] = useState(FIRST_ACTIVITY)
  const [log, setLog] = useState<{ readonly text: string; readonly target: string } | null>(null)
  const nextId = useRef(100)

  const quote = (symbol: string) => prices[symbol] ?? START["NVDA"] as Quote
  const rows = HOLDINGS.map(([symbol, shares]) => {
    const q = quote(symbol)
    return {
      symbol,
      name: q.name,
      shares,
      value: shares * q.price,
      day: shares * (q.price - q.close),
      change: changeOf(q)
    }
  })
  const total = rows.reduce((sum, r) => sum + r.value, 0) + cash
  const dayChange = rows.reduce((sum, r) => sum + r.day, 0)
  const weight = (value: number) => (value / total) * 100

  const addActivity = (item: Omit<Activity, "id">) =>
    setActivity((items) => [{ ...item, id: nextId.current++ }, ...items])
  const setPrice = (symbol: string, price: number) =>
    setPrices((current) => ({ ...current, [symbol]: { ...quote(symbol), price: Math.max(0.01, price) } }))
  const show = (target: string) =>
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })

  const actions = {
    market: () => {
      const next = market === "open" ? "closed" : "open"
      setMarket(next)
      addActivity(
        next === "open" ?
          {
            kind: "system",
            icon: "sun",
            title: "The US market opened",
            body: "Prices are live. Your agents can trade within their limits.",
            time: "Just now"
          } :
          { ...FIRST_ACTIVITY[5] as Activity, time: "Just now" }
      )
      setLog({
        text: next === "open" ?
          "Market opened. Status pills, stock rows and activity updated." :
          "Market closed. Status pills, stock rows, sparklines and activity updated.",
        target: "stock-row"
      })
    },
    blocked: () => {
      setBlockedKey((k) => k + 1)
      addActivity({ ...FIRST_ACTIVITY[1] as Activity, time: "Just now" })
      setLog({
        text: "Tech picker tried to buy $2,400 of Tesla and your 30% limit stopped it.",
        target: "blocked-trade"
      })
    },
    approval: () => {
      setApprovalKey((k) => k + 1)
      addActivity({ ...FIRST_ACTIVITY[0] as Activity, time: "Just now" })
      setLog({
        text: "Tech picker asked to buy $600 of Nvidia. It's waiting in the approval sheet.",
        target: "approval"
      })
    },
    drop: () => {
      const tesla = quote("TSLA")
      setPrice("TSLA", tesla.price * 0.9)
      addActivity(
        market === "open" && !paused ?
          {
            kind: "trade",
            agentId: "guard",
            title: "Stop-loss guard sold your Tesla",
            body: `Tesla fell 10% from ${formatMoney(tesla.price)}, so it sold 6.1 shares at ${
              formatMoney(tesla.price * 0.9)
            }, a fair price.`,
            time: "Just now"
          } :
          {
            kind: "system",
            agentId: "guard",
            title: "Stop-loss guard is waiting",
            body: paused ?
              "Tesla fell 10%, but your agents are paused. Resume them to let it sell." :
              "Tesla fell 10%. It will sell when the market opens at 09:30 New York time.",
            time: "Just now"
          }
      )
      setLog({
        text: `Tesla is now ${formatMoney(tesla.price * 0.9)}. Prices, holdings and the donut moved.`,
        target: "holding-row"
      })
    },
    deposit: () => {
      setCash((c) => c + 250)
      setDeposit((d) => ({ arrived: true, amount: 250, key: d.key + 1 }))
      addActivity({ ...FIRST_ACTIVITY[4] as Activity, title: "$250.00 cash arrived", time: "Just now" })
      setLog({
        text: "$250.00 cash arrived. Deposit card, total value, holdings and activity updated.",
        target: "deposit"
      })
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl px-4 pt-12 pb-24 md:px-10">
      <Toaster />
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">bluechip components</span>
        <h1 className="text-display-3 font-semibold">Money & activity</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          Prices, balances, approvals and the brakes. Every demo here shares one example market, so the controls below
          move them all at once. All prices, balances and addresses are examples.
        </p>
      </div>

      <DemoControls market={market} log={log} actions={actions} onShow={show} />

      <Group
        id="market-money"
        title="Market & money"
        intro="Prices, balances and how your money is split. Numbers are tabular, changes are never color alone, and every amount here is an example."
      >
        <TickerSection prices={prices} />
        <PriceSection
          quote={quote("NVDA")}
          onTick={(dir) => setPrice("NVDA", quote("NVDA").price * (1 + dir * 0.004))}
        />
        <MoneySection cash={cash} nvidia={quote("NVDA").price} />
        <SparklineSection prices={prices} />
        <Section
          id="portfolio-chart"
          title="Portfolio chart"
          purpose="Your total value over time in Base Blue, with the starting value dashed for reference. Hover or use the arrow keys to read any point; the headline follows you."
          notes={[
            "Ranges are tabs: 1D, 1W, 1M, All",
            "Crosshair snaps to the nearest point",
            "Keyboard: focus the chart, ← → Home End"
          ]}
          states={[
            ["Loading", <PortfolioChart key="l" ranges={[]} loading className="shadow-none" />, true],
            [
              "Empty · new account",
              <PortfolioChart key="e" ranges={[{ id: "All", description: "", points: [] }]} className="shadow-none" />,
              true
            ]
          ]}
        >
          <PortfolioChart ranges={portfolioRanges(total, dayChange)} defaultRange="1M" titleAddon={<ExampleFlag />} />
        </Section>
        <AllocationBarSection />
        <Section
          id="allocation-donut"
          title="Allocation donut vs target"
          purpose="Your mix now (outer ring) against the mix you asked for (inner ring), in the chart series colors. The center says how far off you are; the Rebalancer only ever trades to close that gap."
          notes={[
            "Outer 14 px = now · inner 6 px = target",
            "Off target = half the sum of all gaps",
            "Hover or focus a row to isolate it"
          ]}
        >
          <AllocationDonut
            slices={[
              ...rows.map((r): AllocationSlice => ({
                id: r.symbol,
                label: r.name,
                current: weight(r.value),
                target: TARGET[r.symbol] ?? 0
              })),
              { id: "cash", label: "Cash", current: weight(cash), target: TARGET["cash"] ?? 0 }
            ]}
          />
        </Section>
        <Section
          id="allocation-editor"
          title="Allocation editor"
          purpose="Set the target mix for a Rebalancer. Cash fills whatever the stocks don't use, so targets always add up to 100%. Lock a stock to keep it while you move the others."
          notes={[
            "Cash = 100 − stocks, read-only",
            "Raising a stock takes from cash, then unlocked stocks",
            "Split evenly keeps your 10% reserve"
          ]}
        >
          <AllocationEditor
            defaultValue={[
              { symbol: "NVDA", target: 30 },
              { symbol: "AAPL", target: 25 },
              { symbol: "MSFT", target: 20 },
              { symbol: "TSLA", target: 15 }
            ]}
            cap={CAP}
            reserve={RESERVE}
          />
        </Section>
        <Section
          id="holding-row"
          title="Holding row"
          purpose="One thing you own: shares, value, today's change and how close it is to your max. The whole row is one button that opens the stock."
          notes={[
            "Grid: chip · name and bar · value",
            "Over your max adds a red badge",
            "Cash is the last row, always"
          ]}
          states={[
            [
              "Over your max",
              <div key="o" className="w-full overflow-hidden rounded-md">
                <HoldingRow
                  symbol="NVDA"
                  name="Nvidia"
                  shares={24.1}
                  value={4372.2}
                  weight={34.2}
                  cap={CAP}
                  change={1.86}
                />
              </div>,
              true
            ],
            [
              "At your max",
              <div key="a" className="w-full overflow-hidden rounded-md">
                <HoldingRow
                  symbol="NVDA"
                  name="Nvidia"
                  shares={20.2}
                  value={3664.68}
                  weight={29.6}
                  cap={CAP}
                  change={1.86}
                />
              </div>,
              true
            ]
          ]}
        >
          <div className={cn(card, "overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
              <b className="text-body-sm font-semibold">Holdings</b>
              <span className="flex items-center gap-1.5 text-caption text-g-500">
                Share of your money · your max <ExampleFlag />
              </span>
            </div>
            {rows.map((r) => (
              <HoldingRow
                key={r.symbol}
                symbol={r.symbol}
                name={r.name}
                shares={r.shares}
                value={r.value}
                weight={weight(r.value)}
                cap={CAP}
                change={r.change}
              />
            ))}
            <CashHoldingRow value={cash} weight={weight(cash)} reserve={RESERVE} />
          </div>
        </Section>
        <Section
          id="stock-row"
          title="Stock row"
          purpose="A stock you can buy: price, today's change, the day's shape and whether its market is open. Rows are buttons; the selected one is pressed."
          notes={["Sparkline hides on phones", "Halted: per stock, amber", "Closed: dashed tail + “Last close”"]}
        >
          <StockList prices={prices} market={market} />
        </Section>
        <MarketSection live={market} />
        <Section
          id="ticker-marquee"
          title="Ticker marquee"
          purpose="A slow strip of live prices for the landing page and home. It pauses on hover and focus, has a pause button, and stands still with reduced motion."
          notes={["40 s per loop, linear", "Edges fade over 48 px", "Pause control meets WCAG 2.2.2"]}
        >
          <TickerMarquee
            quotes={Object.entries(prices).map(([symbol, q]) => ({ symbol, price: q.price, change: changeOf(q) }))}
          />
        </Section>
      </Group>

      <Group
        id="activity-approvals"
        title="Activity & approvals"
        intro="What happened, what's waiting for you, and the moment a limit says no."
      >
        <ActivitySection activity={activity} onGo={show} />
        <Section
          id="blocked-trade"
          title="Blocked-trade card"
          purpose="bluechip's signature moment. When a limit stops a trade we say so plainly: what the agent tried, which limit stopped it, and that nothing happened to your money. Then you choose."
          notes={["Red wash, never a modal", "Shows the would-be number against your max", "Keep is the calm default"]}
        >
          <BlockedTradeCard
            key={blockedKey}
            agentName="Tech picker"
            time="2 min ago"
            meta={<ExampleFlag />}
            side="buy"
            stockName="Tesla"
            amount={2400}
            weight={17.5}
            projected={41}
            cap={CAP}
            onChangeLimit={() =>
              setLog({ text: "Change limit opens the limit editor on the agent's page.", target: "blocked-trade" })}
          />
        </Section>
        <OrderSection nvidia={quote("NVDA").price} tesla={quote("TSLA").price} />
        <TransactionSection />
        <ApprovalSection key={approvalKey} nvidia={quote("NVDA").price} />
      </Group>

      <Group id="account-safety" title="Account & safety" intro="Face ID, cash in, and the brakes.">
        <PasskeySection />
        <Section
          id="address-chip"
          title="Address chip"
          purpose="Your account's address, shortened to the first six and last four characters, with copy. We only show addresses where you need them: deposits and receipts."
          notes={["0x7a3F…B9d4, tabular", "Copied state for 1.6 s, announced", "Blue dot = Base network"]}
          states={[
            ["Toast feedback", <AddressChip key="t" address={ADDRESS} feedback="toast" />],
            ["No network", <AddressChip key="n" address={SENDER} network={false} />]
          ]}
        >
          <div className="grid justify-items-center gap-3">
            <AddressChip address={ADDRESS} />
            <span className="flex items-center gap-1.5 text-label-sm text-g-500">
              <ExampleFlag /> not a real address
            </span>
          </div>
        </Section>
        <Section
          id="deposit"
          title="Deposit card"
          purpose="How to add cash. Send USDC on Base to your address; we watch for it and tell you the moment it lands. The warning is loud because other coins or networks can be lost."
          notes={[
            "The QR here is a pixel pattern, not a real code",
            "Waiting pulses; arrival rolls in",
            "Warning always visible, never in a tooltip"
          ]}
        >
          {deposit.arrived ?
            (
              <DepositCard
                key={deposit.key}
                address={ADDRESS}
                status="arrived"
                amount={deposit.amount}
                from={SENDER}
                celebrate
                footer={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    onClick={() => setDeposit((d) => ({ ...d, arrived: false }))}
                  >
                    Show address again
                  </Button>
                }
              />
            ) :
            (
              <DepositCard
                address={ADDRESS}
                status="waiting"
                footer={
                  <Button variant="ghost" size="sm" className="justify-self-start" onClick={actions.deposit}>
                    Simulate a deposit
                  </Button>
                }
              />
            )}
        </Section>
        <Section
          id="kill-switch"
          title="Kill switch"
          purpose="One button stops every agent at once. Pausing only takes power away, so it's one confirm. Resuming gives power back, so it needs Face ID."
          notes={[
            "Danger style, confirm in an alert dialog",
            "Banner stays until you resume",
            "Paused agents also hold the stop-loss demo"
          ]}
        >
          <KillSwitch
            paused={paused}
            agentCount={4}
            onPause={() => {
              setPaused(true)
              setLog({
                text: "Paused all agents. The stop-loss guard now waits instead of selling.",
                target: "kill-switch"
              })
            }}
            onResume={async () => {
              await wait(1200)
              setPaused(false)
              setLog({ text: "Resumed all agents with Face ID.", target: "kill-switch" })
            }}
          />
        </Section>
      </Group>
    </div>
  )
}

/* ---------- Demo controls ---------- */

function DemoControls(
  { market, log, actions, onShow }: {
    readonly market: "open" | "closed"
    readonly log: { readonly text: string; readonly target: string } | null
    readonly actions: Readonly<Record<"market" | "blocked" | "approval" | "drop" | "deposit", () => void>>
    readonly onShow: (target: string) => void
  }
) {
  const controls: ReadonlyArray<readonly [keyof typeof actions, IconName, string, string]> = [
    [
      "market",
      market === "open" ? "moon" : "sun",
      market === "open" ? "Close the market" : "Open the market",
      "Market pills, stock rows, marquee"
    ],
    ["drop", "chart-down", "Drop TSLA 10%", "Prices, holdings, donut, stop-loss"],
    ["deposit", "cash", "Deposit arrives", "Deposit card, balances, activity"],
    ["blocked", "stop-sign", "Trigger a blocked trade", "Blocked card, activity"],
    ["approval", "hand", "Request approval", "Approval sheet, activity"]
  ]
  return (
    <div className={cn(card, "mt-8 overflow-hidden")}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-g-100 px-4 py-3.5">
        <span className="grid size-[26px] place-items-center rounded-sm bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white">
          <Icon name="play" size={14} />
        </span>
        <b className="text-body-sm">Demo controls</b>
        <span className="text-label-sm text-g-500">Drives the components on this page</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2 p-3">
        {controls.map(([key, icon, title, touches]) => (
          <button
            key={key}
            type="button"
            onClick={actions[key]}
            className="flex cursor-pointer items-start gap-2.5 rounded-md px-3 py-[11px] text-left surface-secondary transition-[box-shadow,scale] duration-fast ease-brand hover:shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(0,0,255,.3),0_4px_10px_-4px_rgba(0,0,255,.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue active:scale-98"
          >
            <Icon name={icon} size={16} className="mt-0.5 text-blue" />
            <span className="grid gap-px">
              <b className="text-[13.5px] font-semibold">{title}</b>
              <span className="text-caption text-g-500">{touches}</span>
            </span>
          </button>
        ))}
      </div>
      <div aria-live="polite" className="flex min-h-[50px] items-center border-t border-g-100 bg-[#fafafb] px-4 py-2.5">
        {log ?
          (
            <span className="flex w-full flex-wrap items-center gap-2 text-label text-g-700">
              <Icon name="check-circle" size={14} className="text-gain" />
              <span className="flex-1">{log.text}</span>
              <Button variant="ghost" size="sm" onClick={() => onShow(log.target)}>
                Show me<Icon name="arrow-down" size={14} />
              </Button>
            </span>
          ) :
          <span className="text-label-sm text-g-500">Nothing yet. Try a control.</span>}
      </div>
    </div>
  )
}

/* ---------- Market & money ---------- */

function TickerSection({ prices }: { readonly prices: Readonly<Record<string, Quote>> }) {
  const [picked, setPicked] = useState<ReadonlyArray<string>>(["NVDA", "AAPL", "MSFT"])
  const tesla = prices["TSLA"] ?? START["TSLA"] as Quote
  return (
    <Section
      id="ticker-chip"
      title="Ticker chip"
      purpose="The stock's symbol in Doto, on its own color. The color is fixed per stock everywhere in the app, so people learn it. Cash is the one neutral chip."
      notes={["Doto 800, 13 px, +5% tracking", "Sizes: 11 / 13 / 16 px", "Selectable chips are toggle buttons"]}
      states={[
        [
          "Sizes",
          <>
            <TickerChip symbol="NVDA" size="sm" />
            <TickerChip symbol="NVDA" />
            <TickerChip symbol="NVDA" size="lg" />
          </>
        ],
        ["With price", <TickerChip key="p" symbol="TSLA" price={tesla.price} change={changeOf(tesla)} />],
        ["Not on bluechip", <TickerChip key="n" symbol="AMD" unavailable />],
        ["Disabled", <TickerToggle key="d" symbol="SPCX" name="SpaceX" disabled />]
      ]}
    >
      <div className="grid w-full gap-[22px]">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {[...Object.entries(START), [CASH_SYMBOL, { name: "Cash" }] as const].map(([symbol, q]) => (
            <div key={symbol} className="grid justify-items-start gap-1.5 rounded-md bg-white p-3 shadow-e1">
              <TickerChip symbol={symbol} size="lg" />
              <span className="text-label-sm text-g-600">{q.name}</span>
            </div>
          ))}
        </div>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 text-[11.5px] font-semibold text-g-500">Stocks this agent can trade</legend>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(START).map(([symbol, q]) => (
              <TickerToggle
                key={symbol}
                symbol={symbol}
                name={q.name}
                pressed={picked.includes(symbol)}
                onPressedChange={(on) => setPicked(on ? [...picked, symbol] : picked.filter((s) => s !== symbol))}
              />
            ))}
          </div>
          <p className={cn("text-label text-g-500", picked.length === 0 && "text-loss")}>
            {picked.length === 0 ?
              "Pick at least one stock." :
              `It can trade ${picked.length} stock${picked.length > 1 ? "s" : ""}: ${
                picked.map((s) => START[s]?.name).join(", ")
              }.`}
          </p>
        </fieldset>
      </div>
    </Section>
  )
}

function PriceSection({ quote, onTick }: { readonly quote: Quote; readonly onTick: (direction: 1 | -1) => void }) {
  const msft = START["MSFT"] as Quote, amzn = START["AMZN"] as Quote, googl = START["GOOGL"] as Quote
  return (
    <Section
      id="price"
      title="Price and change"
      purpose="Price in tabular figures, change in green or red with an arrow and a sign, never color alone. A new price flashes in the direction it moved."
      notes={["Change vs. last close", "Flat shows a dash and 0.00%", "Flash: gain or loss wash, fades over 900 ms"]}
      states={[
        ["Up", <Price key="u" price={msft.price} change={changeOf(msft)} />],
        ["Down", <Price key="d" price={amzn.price} change={changeOf(amzn)} />],
        ["Flat", <Price key="f" price={googl.price} change={changeOf(googl)} />],
        ["Small · stacked in a row", <Price key="s" price={612.3} change={1.19} size="sm" layout="stacked" />],
        ["Large · with amount", <Price key="l" price={12269.4} change={1.83} changeAmount={220.4} size="lg" />],
        ["Change alone", <PriceChange key="c" value={-0.6} size="lg" />]
      ]}
    >
      <div className="grid justify-items-center gap-[22px]">
        <div className="flex items-center gap-4 text-left">
          <TickerChip symbol="NVDA" size="lg" />
          <div className="grid gap-1">
            <span className="flex items-center gap-1.5 text-label-sm text-g-500">
              Nvidia <ExampleFlag />
            </span>
            <Price price={quote.price} change={changeOf(quote)} size="xl" />
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onTick(1)}>
            <Icon name="arrow-up" size={14} />Tick up
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onTick(-1)}>
            <Icon name="arrow-down" size={14} />Tick down
          </Button>
        </div>
      </div>
    </Section>
  )
}

function MoneySection({ cash, nvidia }: { readonly cash: number; readonly nvidia: number }) {
  return (
    <Section
      id="money-input"
      title="Money input"
      purpose="How much cash (USDC) to use. Formats as you type, shows what it buys, and explains every error in plain words. Max fills what you can spend."
      notes={["Large 32 px figures, tabular", "Max fills all your cash", "Errors say what to do next"]}
      states={[
        ["Empty", <MoneyInput key="e" size="md" label="Amount" showMax={false} available={cash} />],
        [
          "Over your cash",
          <MoneyInput key="c" size="md" label="Amount" showMax={false} available={cash} defaultValue={2000} />
        ],
        [
          "Over the agent's ask-me amount",
          <MoneyInput
            key="w"
            size="md"
            label="Amount"
            showMax={false}
            available={cash}
            approvalAbove={500}
            defaultValue={600}
          />
        ],
        ["USDC", <MoneyInput key="u" size="md" label="Send" currency="usdc" available={cash} defaultValue={250} />],
        [
          "Disabled · market closed",
          <MoneyInput
            key="d"
            size="md"
            label="Amount"
            showMax={false}
            defaultValue={250}
            disabled
            disabledReason="Buying opens Monday at 09:30 New York time."
          />
        ]
      ]}
    >
      <div className={cn(card, "max-w-[440px] rounded-xl p-5")}>
        <MoneyInput
          label="Buy Nvidia with"
          description={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Cash (USDC) · {formatMoney(cash)} available <ExampleFlag />
            </span>
          }
          available={cash}
          approvalAbove={500}
          defaultValue={250}
          quickAmounts={[50, 100, 250, 500]}
          hint={(amount) =>
            `About ${(amount / nvidia).toFixed(3)} shares at ${
              formatMoney(nvidia)
            }. Price checked: within 1% of the market price.`}
        />
      </div>
    </Section>
  )
}

function SparklineSection({ prices }: { readonly prices: Readonly<Record<string, Quote>> }) {
  const q = (symbol: string) => prices[symbol] ?? START[symbol] as Quote
  return (
    <Section
      id="sparkline"
      title="Sparkline"
      purpose="A day's shape in a glance. Green when up, red when down, grey when flat, with a dot on the latest price. A dashed tail means the market is closed and the price is the last close."
      notes={["1.6 px stroke, round joins", "Endpoint dot 2.6 px with white ring", "Optional area fill at 16%"]}
      states={[
        ["64 × 20", <Sparkline key="a" values={history("MSFT", q("MSFT"))} width={64} height={20} />],
        ["96 × 28 · area", <Sparkline key="b" values={history("META", q("META"))} area />],
        ["Market closed", <Sparkline key="c" values={history("TSLA", q("TSLA"))} closedFrom={24} />],
        [
          "Brand · no tone",
          <Sparkline key="d" values={walk("brand", 32, 10, 14, 0.25)} width={120} height={32} tone="brand" area />
        ]
      ]}
    >
      <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {["NVDA", "AMZN", "GOOGL"].map((symbol) => (
          <div key={symbol} className="grid justify-items-start gap-2.5 rounded-lg bg-white p-3.5 shadow-e2">
            <TickerChip symbol={symbol} />
            <Sparkline
              values={history(symbol, q(symbol))}
              width={160}
              height={44}
              className="h-11 w-full"
              preserveAspectRatio="none"
            />
            <Price price={q(symbol).price} change={changeOf(q(symbol))} size="sm" />
          </div>
        ))}
      </div>
    </Section>
  )
}

function AllocationBarSection() {
  const [nvidia, setNvidia] = useState(24)
  const state = capState(nvidia, CAP)
  return (
    <Section
      id="allocation-bar"
      title="Allocation bar with cap"
      purpose="How much of your money is in one stock, against your max. The black tick is your limit. Prices can push a stock over it; agents then stop buying it, but nothing is sold for you."
      notes={[
        "Under: blue · At (within 1%): amber · Over: red past the tick",
        "Scale is 0 to 100% of your money",
        "Label always states both numbers"
      ]}
      states={[
        ["Under", <Stacked key="u" bar={<AllocationBar weight={22} cap={CAP} size="md" />} text="22% · max 30%" />],
        [
          "At your max",
          <Stacked
            key="a"
            bar={<AllocationBar weight={29.6} cap={CAP} size="md" />}
            text="29.6% · at your max"
            tone="text-warn"
          />
        ],
        [
          "Over · prices moved",
          <Stacked
            key="o"
            bar={<AllocationBar weight={36} cap={CAP} size="md" />}
            text="36% · 6% over your max"
            tone="text-loss"
          />
        ],
        [
          "Cash reserve",
          <Stacked
            key="c"
            bar={<AllocationBar weight={12.2} cap={RESERVE} cash size="md" />}
            text="12.2% · keep at least 10%"
          />
        ]
      ]}
    >
      <div className={cn(card, "grid max-w-[520px] gap-3.5 p-5")}>
        <div className="flex items-center gap-3">
          <TickerChip symbol="NVDA" />
          <div className="grid min-w-0 flex-1 gap-1">
            <b className="text-[15px]">Nvidia</b>
            <span className="text-label-sm text-g-500">
              {state === "under" ?
                `Room for ${formatMoney(((CAP - nvidia) / 100) * 12269)} more before your max` :
                state === "at" ?
                "At your max. Agents won't buy more Nvidia." :
                `${
                  (nvidia - CAP).toFixed(1)
                }% over your max because the price rose. Agents won't buy more; nothing is sold for you.`}
            </span>
          </div>
          <span
            className={cn(
              "text-[24px] font-semibold tracking-[-0.03em] tabular-nums",
              state === "under" ? "text-blue" : state === "at" ? "text-[#b88400]" : "text-loss"
            )}
          >
            {nvidia.toFixed(1)}%
          </span>
        </div>
        <AllocationBar weight={nvidia} cap={CAP} size="lg" label="Nvidia" />
        <div className="relative flex h-[18px] justify-between text-[11.5px] text-g-500 tabular-nums">
          <span>0%</span>
          <span className="absolute left-[30%] -translate-x-1/2 font-semibold whitespace-nowrap text-ink">
            Your max 30%
          </span>
          <span>100%</span>
        </div>
        <label className="grid gap-1.5">
          <span className="text-label-sm text-g-600">Try a weight</span>
          <input
            type="range"
            min={0}
            max={50}
            step={0.5}
            value={nvidia}
            onChange={(event) => setNvidia(Number(event.currentTarget.value))}
            className="w-full accent-blue"
          />
        </label>
      </div>
    </Section>
  )
}

function Stacked({ bar, text, tone }: { readonly bar: ReactNode; readonly text: string; readonly tone?: string }) {
  return (
    <div className="grid w-full gap-1.5">
      {bar}
      <span className={cn("text-label-sm text-g-500", tone)}>{text}</span>
    </div>
  )
}

function StockList(
  { prices, market }: { readonly prices: Readonly<Record<string, Quote>>; readonly market: "open" | "closed" }
) {
  const [selected, setSelected] = useState("NVDA")
  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
        <b className="text-body-sm font-semibold">Stocks on bluechip</b>
        <MarketStatus state={market} closesAt={CLOSES} opensAt={OPENS} />
      </div>
      {["NVDA", "AAPL", "TSLA", "MSFT", "MSTR", "SPCX"].map((symbol) => {
        const q = prices[symbol] ?? START[symbol] as Quote
        return (
          <StockRow
            key={symbol}
            symbol={symbol}
            name={q.name}
            price={q.price}
            change={changeOf(q)}
            history={history(symbol, q)}
            market={symbol === "SPCX" ? "halted" : market}
            closedFrom={26}
            selected={selected === symbol}
            onClick={() => setSelected(symbol)}
          />
        )
      })}
    </div>
  )
}

const MARKET_COPY: Readonly<Record<MarketState, string>> = {
  open: "Prices are live. Your agents trade within their limits until 16:00 New York time.",
  closed: "Prices pause at today's close. Your agents start buying again at 09:30 New York time.",
  weekend: "Prices show Friday's close. Your agents start buying again Monday at 09:30 New York time.",
  halted: "The exchange paused SpaceX. bluechip shows the last price and no one can trade it until trading resumes."
}

function MarketSection({ live }: { readonly live: "open" | "closed" }) {
  const [state, setState] = useState<MarketState>("open")
  const pill = (s: MarketState) => (
    <MarketStatus state={s} closesAt={CLOSES} opensAt={OPENS} lastClose={FRIDAY_CLOSE} symbol="SPCX" />
  )
  return (
    <Section
      id="market-status"
      title="Market status pill"
      purpose="Whether US stocks are trading right now, and what that means for your agents. Shown on home, on every stock and in chat when it matters."
      notes={[
        "Open pulses gently (2.4 s)",
        "Closed and weekend say when it opens or last closed",
        "Halted is per stock, amber"
      ]}
      states={[
        ["Open", pill("open")],
        ["Closed", pill("closed")],
        ["Weekend", pill("weekend"), true],
        ["Halted", pill("halted")],
        ["Live · demo controls", pill(live)]
      ]}
    >
      <div className="grid justify-items-center gap-[22px]">
        <ToggleGroup
          aria-label="Market state"
          size="sm"
          value={[state]}
          onValueChange={(next) => next[0] !== undefined && setState(next[0] as MarketState)}
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="closed">Closed</ToggleGroupItem>
          <ToggleGroupItem value="weekend">Weekend</ToggleGroupItem>
          <ToggleGroupItem value="halted">Halted</ToggleGroupItem>
        </ToggleGroup>
        <div className={cn(card, "grid max-w-[440px] justify-items-center gap-3 p-5 text-center")}>
          {pill(state)}
          <p className="text-body-sm">{MARKET_COPY[state]}</p>
        </div>
      </div>
    </Section>
  )
}

/* ---------- Activity & approvals ---------- */

function ActivitySection(
  { activity, onGo }: { readonly activity: ReadonlyArray<Activity>; readonly onGo: (target: string) => void }
) {
  const [filter, setFilter] = useState<ActivityKind | "all">("all")
  const shown = activity.filter((a) => filter === "all" || a.kind === filter)
  return (
    <Section
      id="activity"
      title="Activity item"
      purpose="Everything that happened, newest first. Agent items carry the agent's butterfly; money and market items carry an icon. Blocked trades get a red wash so they're never missed."
      notes={[
        "Kinds: trade, blocked, approval, deposit, system",
        "Filters are toggle buttons",
        "New items land on top"
      ]}
    >
      <div className={cn(card, "max-w-[640px] overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
          <b className="flex items-center gap-2 text-body-sm font-semibold">
            Activity <ExampleFlag />
          </b>
          <ToggleGroup
            aria-label="Filter activity"
            size="sm"
            value={[filter]}
            onValueChange={(next) => next[0] !== undefined && setFilter(next[0] as ActivityKind | "all")}
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="trade">Trades</ToggleGroupItem>
            <ToggleGroupItem value="blocked">Blocked</ToggleGroupItem>
            <ToggleGroupItem value="approval">Approvals</ToggleGroupItem>
            <ToggleGroupItem value="deposit">Cash</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {shown.length === 0 ?
          (
            <div className="grid justify-items-center gap-1 px-4 py-8 text-center text-label text-g-500">
              <Icon name="activity" size={18} />
              <b className="text-body-sm text-ink">Nothing here yet</b>
              <span>Try another filter.</span>
            </div>
          ) :
          (
            <ul>
              {shown.map((a) => (
                <ActivityItem
                  key={a.id}
                  kind={a.kind}
                  title={a.title}
                  time={a.time}
                  className="animate-pop-in"
                  {...(a.agentId === undefined ? {} : { agentId: a.agentId })}
                  {...(a.icon === undefined ? {} : { icon: a.icon })}
                  {...(a.go === undefined ? {} : {
                    actions: a.go === "approval" ?
                      <Button size="sm" onClick={() => onGo("approval")}>Review and approve</Button> :
                      <Button variant="secondary" size="sm" onClick={() => onGo("blocked-trade")}>Review</Button>
                  })}
                >
                  {a.body}
                </ActivityItem>
              ))}
            </ul>
          )}
      </div>
    </Section>
  )
}

function OrderSection({ nvidia, tesla }: { readonly nvidia: number; readonly tesla: number }) {
  return (
    <Section
      id="order-preview"
      title="Order preview"
      purpose="Exactly what a trade will do before it happens: amount, price, shares, the fair price check, and where it leaves you against your limits."
      notes={[
        "Label left, value right, 13.5 px",
        "Fair price check always shown",
        "“After this trade” ties back to limits"
      ]}
    >
      <div className={cn(card, "grid max-w-[440px] gap-3 p-4")}>
        <Tabs variant="segmented" defaultValue="buy" className="gap-3">
          <TabsList aria-label="Order type">
            <TabsTab value="buy">Buy</TabsTab>
            <TabsTab value="sell">Sell</TabsTab>
            <TabsTab value="rebalance">Rebalance</TabsTab>
          </TabsList>
          <TabsPanel value="buy">
            <TradeOrderPreview order={APPROVAL_ORDER(nvidia)} />
          </TabsPanel>
          <TabsPanel value="sell">
            <TradeOrderPreview
              order={{
                side: "sell",
                symbol: "TSLA",
                name: "Tesla",
                amount: 400,
                price: tesla,
                after: "Tesla is 14% of your money",
                fee: 0.03
              }}
            />
          </TabsPanel>
          <TabsPanel value="rebalance">
            <OrderPreview>
              <OrderPreviewRow label="Sell">
                <TickerChip symbol="NVDA" size="sm" />Nvidia · $73.61
              </OrderPreviewRow>
              <OrderPreviewRow label="Buy">
                <TickerChip symbol="AAPL" size="sm" />Apple · $73.61
              </OrderPreviewRow>
              <OrderPreviewRow label="Fair price check">
                <FairPriceCheck>Both within 1%</FairPriceCheck>
              </OrderPreviewRow>
              <OrderPreviewRow label="Off target">3.4% → 0.6%</OrderPreviewRow>
              <OrderPreviewRow label="Fee">$0.06</OrderPreviewRow>
            </OrderPreview>
          </TabsPanel>
        </Tabs>
        <p className="flex items-center justify-center gap-1.5 text-label-sm text-g-500">
          <ExampleFlag /> Prices update until you approve.
        </p>
      </div>
    </Section>
  )
}

function TransactionSection() {
  const [state, setState] = useState<TransactionState>("sending")
  const run = useRef(0)
  const go = async (fail: boolean) => {
    const id = ++run.current
    setState("sending")
    await wait(900)
    if (id !== run.current) return
    setState("confirming")
    await wait(1100)
    if (id === run.current) setState(fail ? "failed" : "filled")
  }
  return (
    <Section
      id="transaction-status"
      title="Transaction status"
      purpose="Where a trade is after you approve it. Three steps, a couple of seconds each on Base. If it fails we say why and that your cash is back."
      notes={[
        "Row from 560 px wide, stacked below",
        "Current step spins; done steps check",
        "Failure names the reason"
      ]}
      states={[
        ["Sending", <TransactionStatus key="s" state="sending" orientation="vertical" />],
        ["Filled", <TransactionStatus key="f" state="filled" orientation="vertical" />],
        ["Failed", <TransactionStatus key="x" state="failed" orientation="vertical" />]
      ]}
    >
      <div className="grid w-full justify-items-center gap-[22px]">
        <TransactionStatus state={state} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void go(false)}>
            <Icon name="play" size={14} />Run trade
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void go(true)}>Run and fail</Button>
        </div>
      </div>
    </Section>
  )
}

function ApprovalSection({ nvidia }: { readonly nvidia: number }) {
  const [fail, setFail] = useState(false)
  const [round, setRound] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const failId = useId()
  // Simulates Face ID and Base: about 0.9 s for Face ID, then a couple of seconds on Base.
  const approve = async (progress: (step: ApprovalProgress) => void) => {
    await wait(900)
    progress("approved")
    await wait(1400)
    progress("sending")
    await wait(800)
    progress("confirming")
    await wait(1100)
    if (fail) {
      throw new Error(
        "The price moved more than 1% while confirming, so nothing was bought. Your $600.00 is still cash."
      )
    }
  }
  const props = {
    agentName: "Tech picker",
    order: APPROVAL_ORDER(nvidia),
    onApprove: approve,
    onDecline: () => wait(400)
  }
  return (
    <Section
      id="approval"
      title="Approval sheet"
      purpose="When a trade is over your ask-me amount, it waits here. You see the order, approve with Face ID, and watch it fill, all in one sheet."
      notes={[
        "Pending → approving → approved → sending → filled",
        "The Face ID seal forms on approval",
        "Decline is always one tap away"
      ]}
    >
      <div className="grid w-full justify-items-center gap-3">
        <div className="w-full max-w-[420px] rounded-[22px] bg-white px-[22px] pt-3 pb-[22px] shadow-e3">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-9 rounded-full bg-g-200" />
          <ApprovalCard key={round} {...props} onDone={() => setRound((r) => r + 1)} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Label htmlFor={failId} className="flex cursor-pointer items-center gap-2 font-normal text-g-600">
            <Checkbox id={failId} checked={fail} onCheckedChange={setFail} />
            Make this one fail at confirming
          </Label>
          <Button variant="secondary" size="sm" onClick={() => setSheetOpen(true)}>
            <Icon name="approvals" size={14} />Open as a sheet
          </Button>
        </div>
      </div>
      <ApprovalSheet
        key={`sheet-${round}`}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        {...props}
        onDone={() => {
          setSheetOpen(false)
          setRound((r) => r + 1)
        }}
      />
    </Section>
  )
}

/* ---------- Account & safety ---------- */

function PasskeySection() {
  const [failNext, setFailNext] = useState(false)
  const failId = useId()
  const faceId = async () => {
    await wait(1100)
    if (failNext) throw new Error("Face ID failed")
  }
  return (
    <Section
      id="passkey"
      title="Passkey button"
      purpose="The one button for anything that needs you: creating your account, signing in, approving a trade, locking limits. It always names Face ID and shows what's happening."
      notes={[
        "Primary, 46 px, Face ID glyph",
        "Waiting → done (seal) → back after 1.5 s",
        "Error says to try again; never a code"
      ]}
      states={[
        [
          "Sign in",
          <PasskeyButton key="s" variant="secondary" doneLabel="Signed in" onAuthenticate={() => wait(900)}>
            Sign in with Face ID
          </PasskeyButton>
        ],
        [
          "Fingerprint",
          <PasskeyButton key="f" method="fingerprint" doneLabel="Approved" onAuthenticate={() => wait(900)}>
            Approve with fingerprint
          </PasskeyButton>
        ],
        [
          "Always fails",
          <PasskeyButton
            key="e"
            doneLabel="Signed in"
            onAuthenticate={() => wait(700).then(() => Promise.reject(new Error("cancelled")))}
          >
            Sign in with Face ID
          </PasskeyButton>
        ],
        [
          "Disabled",
          <PasskeyButton key="d" disabled doneLabel="Approved" onAuthenticate={() => Promise.resolve()}>
            Approve with Face ID
          </PasskeyButton>
        ]
      ]}
    >
      <div className="grid w-full max-w-[420px] justify-items-center gap-3 text-center">
        <PasskeyButton size="lg" className="w-full" doneLabel="Account created" onAuthenticate={faceId}>
          Create account with Face ID
        </PasskeyButton>
        <Label htmlFor={failId} className="flex cursor-pointer items-center gap-2 font-normal text-g-600">
          <Checkbox id={failId} checked={failNext} onCheckedChange={setFailNext} />
          Make Face ID fail
        </Label>
        <p className="text-label-sm text-g-500">
          No password and no seed phrase. Your account lives on Base, and only your face or fingerprint can move money.
        </p>
      </div>
    </Section>
  )
}
