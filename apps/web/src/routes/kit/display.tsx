import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { AspectRatio } from "@bluechip/ui/components/aspect-ratio"
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup } from "@bluechip/ui/components/avatar"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@bluechip/ui/components/card"
import { AreaChart, BarChart, type ChartSeries, LineChart } from "@bluechip/ui/components/chart"
import { DataTable, type DataTableColumn } from "@bluechip/ui/components/data-table"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
import { Kbd, KbdGroup } from "@bluechip/ui/components/kbd"
import { Label } from "@bluechip/ui/components/label"
import { Progress, ProgressRing } from "@bluechip/ui/components/progress"
import { ScrollArea } from "@bluechip/ui/components/scroll-area"
import { Separator } from "@bluechip/ui/components/separator"
import { Skeleton } from "@bluechip/ui/components/skeleton"
import { Switch } from "@bluechip/ui/components/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@bluechip/ui/components/table"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney, formatPercent } from "@bluechip/ui/lib/format"
import { type TickerTone, tickerTone } from "@bluechip/ui/lib/tickers"
import { Halftone } from "@bluechip/ui/motion/halftone"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactNode, useId, useMemo, useState } from "react"

export const Route = createFileRoute("/kit/display")({ component: KitDisplay })

/* ---------- Example data from bluechip's world ---------- */

const STOCKS = [
  { symbol: "NVDA", name: "Nvidia", price: 181.42, change: 1.86 },
  { symbol: "AAPL", name: "Apple", price: 241.18, change: -0.6 },
  { symbol: "MSFT", name: "Microsoft", price: 455.6, change: 0.9 },
  { symbol: "META", name: "Meta", price: 612.3, change: 1.19 },
  { symbol: "TSLA", name: "Tesla", price: 352.75, change: 0.84 },
  { symbol: "GOOGL", name: "Alphabet", price: 178.9, change: 0 },
  { symbol: "AMZN", name: "Amazon", price: 214.36, change: -0.77 },
  { symbol: "MSTR", name: "Strategy", price: 318.2, change: 2.83 },
  { symbol: "SNDK", name: "Sandisk", price: 64.85, change: 2.74 },
  { symbol: "SPCX", name: "SpaceX", price: 98.4, change: 1.29 }
] as const

const stock = (symbol: string) => STOCKS.find((s) => s.symbol === symbol) ?? STOCKS[0]

const AGENTS = [
  { id: "rebalancer", name: "Rebalancer" },
  { id: "stock-picker", name: "Stock picker" },
  { id: "weekly-buyer", name: "Weekly buyer" },
  { id: "stop-loss", name: "Stop-loss guard" }
] as const

const HOLDINGS = [["NVDA", 12.4], ["AAPL", 8], ["MSFT", 3.2], ["TSLA", 2.5], ["GOOGL", 6]] as const

type TradeStatus = "Done" | "Stopped by limit" | "Waiting for you"

interface Trade {
  readonly id: number
  readonly symbol: string
  readonly agent: (typeof AGENTS)[number]
  readonly side: "Buy" | "Sell"
  readonly amount: number
  readonly status: TradeStatus
  readonly day: number
}

const TRADES: ReadonlyArray<Trade> = Array.from({ length: 23 }, (_, i) => ({
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
const DAY_LABELS = DAYS.map((i) =>
  new Date(Date.UTC(2026, 9, 26 + i)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
)
const VALUE_SERIES: ReadonlyArray<ChartSeries> = [
  { key: "stocks", label: "Stocks", values: STOCKS_VALUE },
  { key: "cash", label: "Cash", values: CASH_VALUE }
]
const CASH_SERIES: ReadonlyArray<ChartSeries> = [{ key: "cash", label: "Cash", values: CASH_VALUE }]
const WEEKS = ["Oct 6", "Oct 13", "Oct 20", "Oct 27", "Nov 3", "Nov 10", "Nov 17", "Nov 24"]
const FLOW_SERIES: ReadonlyArray<ChartSeries> = [
  { key: "bought", label: "Bought", values: [420, 380, 610, 290, 540, 470, 720, 380] },
  { key: "sold", label: "Sold", values: [120, 260, 180, 340, 90, 210, 160, 240] }
]

const FEE_SERIES: ReadonlyArray<ChartSeries> = [
  {
    key: "network",
    label: "Network",
    values: [1.2, 0.9, 1.6, 0.7, 1.3, 1.1, 1.9, 0.8],
    color: "var(--color-series-3)"
  },
  { key: "swap", label: "Swap", values: [2.4, 2.1, 3.2, 1.8, 2.7, 2.3, 3.6, 2], color: "var(--color-series-6)" }
]

const LIMITS: ReadonlyArray<readonly [string, ReactNode]> = [
  [
    "Stocks allowed",
    <span key="s" className="inline-flex flex-wrap justify-end gap-1">
      <Ticker symbol="NVDA" />
      <Ticker symbol="AAPL" />
      <Ticker symbol="MSFT" />
    </span>
  ],
  ["Spend per day", "$250"],
  ["Max per trade", "$100"]
]

/* ---------- Page scaffolding (mirrors the brand kit's section layout) ---------- */

const TONE: Readonly<Record<TickerTone, string>> = {
  blue: "bg-[linear-gradient(180deg,#4c76ff,#2a5bff)] text-white",
  yellow: "bg-[linear-gradient(180deg,#ffdc5c,#ffd12f)] text-[#3a2c00]",
  green: "bg-[linear-gradient(180deg,#7ad61a,#66c800)] text-[#0c2a00]",
  pink: "bg-[linear-gradient(180deg,#ffbdd9,#fea8cd)] text-[#4a0f2a]",
  ink: "bg-[linear-gradient(180deg,#2b2e35,#0a0b0d)] text-white",
  cerulean: "bg-[linear-gradient(180deg,#62a2ff,#3c8aff)] text-[#00163d]",
  lilac: "bg-[linear-gradient(180deg,#dcaefe,#cd99fd)] text-[#2c0a4d]",
  tan: "bg-[linear-gradient(180deg,#cbb995,#b8a581)] text-[#2a2111]"
}

function Ticker({ symbol, large = false }: { readonly symbol: string; readonly large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-pixel font-extrabold tracking-[.05em] whitespace-nowrap shadow-[inset_0_1px_0_rgba(255,255,255,.3)]",
        large
          ? "rounded-[7px] px-[9px] pt-[5px] pb-1 text-label"
          : "rounded-[5px] px-1.5 pt-[3px] pb-0.5 text-caption-sm",
        TONE[tickerTone(symbol)]
      )}
    >
      {symbol}
    </span>
  )
}

const STATUS_TONE = {
  running: "bg-gain-wash text-gain shadow-[inset_0_0_0_1px_var(--color-gain-line)]",
  waiting: "bg-blue-50 text-blue shadow-[inset_0_0_0_1px_var(--color-info-line)]",
  paused: "bg-warn-wash text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]",
  blocked: "bg-loss-wash text-loss shadow-[inset_0_0_0_1px_var(--color-loss-line)]",
  idle: "bg-g-50 text-g-600 shadow-[inset_0_0_0_1px_var(--color-g-200)]"
} as const

function Status({ tone, children }: { readonly tone: keyof typeof STATUS_TONE; readonly children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full py-[3px] pr-[9px] pl-[7px] text-label-sm font-[550] whitespace-nowrap",
        STATUS_TONE[tone]
      )}
    >
      <i className="size-1.5 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_srgb,currentColor_18%,transparent)]" />
      {children}
    </span>
  )
}

function ExampleFlag() {
  return (
    <span className="inline-flex items-center rounded-full bg-warn-wash px-2 py-0.5 text-[11.5px] font-semibold text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]">
      Example
    </span>
  )
}

function Change({ value }: { readonly value: number }) {
  return <span className={cn("tabular-nums", value >= 0 ? "text-gain" : "text-loss")}>{formatPercent(value)}</span>
}

function LimitList({ className }: { readonly className?: string }) {
  return (
    <dl className={cn("grid", className)}>
      {LIMITS.map(([term, value]) => (
        <div
          key={term}
          className="flex items-center justify-between gap-3 border-b border-g-100 py-[7px] text-label last:border-b-0"
        >
          <dt className="text-g-500">{term}</dt>
          <dd className="font-[550] tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Group({ n, title, children }: { readonly n: string; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="pt-10">
      <div className="flex items-baseline gap-3.5 pb-2">
        <span className="text-label font-semibold text-blue">{n}</span>
        <h2 className="text-[clamp(24px,3vw,30px)] font-semibold tracking-[-0.035em]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function Section(
  { title, purpose, base, children }: {
    readonly title: string
    readonly purpose: string
    readonly base: string
    readonly children: ReactNode
  }
) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-4 border-t border-ink/7 pt-9 pb-10">
      <header className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-4">
        <div>
          <h3 id={id} className="text-[19px] leading-tight font-semibold tracking-[-0.02em]">{title}</h3>
          <p className="mt-1 max-w-[64ch] text-body-sm text-g-600">{purpose}</p>
        </div>
        <span className="shrink-0 rounded-full bg-g-50 px-[9px] py-[3px] text-[11.5px] font-[550] whitespace-nowrap text-g-500 shadow-[inset_0_0_0_1px_var(--color-g-200)]">
          {base}
        </span>
      </header>
      {children}
    </section>
  )
}

function Demo(
  { label, className, children }: { readonly label?: string; readonly className?: string; readonly children: ReactNode }
) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-wrap items-center gap-3.5 rounded-lg bg-white p-5 shadow-e1 sm:p-7",
        label && "pt-[42px] sm:pt-12",
        className
      )}
    >
      {label && <span className="absolute top-3.5 left-4 text-[11.5px] font-[550] text-g-500">{label}</span>}
      {children}
    </div>
  )
}

const Caption = ({ children }: { readonly children: ReactNode }) => (
  <span className="text-[13.5px] font-[550]">{children}</span>
)

/* ---------- Page ---------- */

function KitDisplay() {
  return (
    <div className="mx-auto grid max-w-5xl px-4 pt-12 pb-24 md:px-10">
      <div className="grid gap-3">
        <span className="text-label font-medium text-blue">Interface</span>
        <h1 className="text-display-3 font-semibold">Data display</h1>
        <p className="max-w-[64ch] text-body-lg text-g-600">
          How bluechip shows what you own and what your agents did: cards, tables, charts and the small labels around
          them, plus the feedback and layout pieces that hold a screen together.
        </p>
      </div>
      <Group n="01" title="Data display">
        <CardSection />
        <TableSection />
        <DataTableSection />
        <ChartSection />
        <AvatarSection />
        <BadgeSection />
        <KbdSection />
      </Group>
      <Group n="02" title="Feedback">
        <AlertSection />
        <ProgressSection />
        <SkeletonSection />
        <EmptySection />
      </Group>
      <Group n="03" title="Layout">
        <SeparatorSection />
        <AspectRatioSection />
        <ScrollAreaSection />
      </Group>
    </div>
  )
}

/* ---------- Data display ---------- */

function CardSection() {
  return (
    <Section
      title="Card"
      purpose="Groups one thing's content and actions. Hairline edge and soft depth, never a heavy border."
      base="Card"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-2.5">
              <AgentAvatar agentId="rebalancer" />
              <div>
                <CardTitle>Rebalancer</CardTitle>
                <CardDescription>Only rebalances, never adds cash.</CardDescription>
              </div>
            </div>
            <CardAction>
              <Button variant="ghost" size="icon-sm" aria-label="Agent actions">
                <Icon name="more" size={16} />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <LimitList />
          </CardContent>
          <CardFooter>
            <Status tone="running">Running</Status>
            <Button variant="secondary" size="sm">View agent</Button>
          </CardFooter>
        </Card>
        <Card variant="flat">
          <CardHeader>
            <div>
              <CardDescription>Cash (USDC)</CardDescription>
              <p className="mt-0.5 text-[28px] leading-[1.15] font-semibold tracking-[-0.035em] tabular-nums">
                $1,240.50
              </p>
            </div>
            <CardAction>
              <ExampleFlag />
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-label-sm text-g-500">Ready for your agents. $200 is kept aside as your cash reserve.</p>
          </CardContent>
          <CardFooter>
            <Button size="sm">
              <Icon name="plus" size={16} />Deposit
            </Button>
            <Button variant="ghost" size="sm">Withdraw</Button>
          </CardFooter>
        </Card>
        <Card
          variant="interactive"
          render={({ children, ...props }) => <a {...props} href="#create-agent">{children}</a>}
        >
          <CardHeader>
            <span className="grid size-[38px] place-items-center rounded-[11px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_4px_10px_-3px_rgba(42, 91, 255,.4)]">
              <Icon name="plus" size={18} />
            </span>
          </CardHeader>
          <CardContent>
            <CardTitle>Create an agent</CardTitle>
            <CardDescription>
              Say what you want in plain words. You'll review its limits before it starts.
            </CardDescription>
          </CardContent>
          <CardFooter className="justify-start gap-1.5 text-[13.5px] font-[550] text-blue">
            Start in chat <Icon name="arrow-right" size={14} />
          </CardFooter>
        </Card>
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2.5">
        {(
          [
            ["Default · e2", "default"],
            ["Flat · e1", "flat"],
            ["Raised · e3", "raised"],
            ["Interactive hover", "interactive"],
            ["Well", "well"]
          ] as const
        ).map(([label, variant]) => (
          <li
            key={label}
            className="grid justify-items-center gap-2 rounded-md bg-g-50 px-2.5 pt-4 pb-2.5 shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]"
          >
            <Card
              variant={variant}
              className={cn("h-14 w-full p-0", variant === "interactive" && "-translate-y-0.5 shadow-e3")}
            />
            <span className="text-[11.5px] font-[550] text-g-500">{label}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function TableSection() {
  const total = HOLDINGS.reduce((sum, [symbol, shares]) => sum + shares * stock(symbol).price, 0)
  return (
    <Section
      title="Table"
      purpose="Rows of numbers you compare. Numbers align right and use tabular figures."
      base="Table"
    >
      <Table>
        <TableCaption>
          <span className="inline-flex items-center gap-2">
            Your stocks <ExampleFlag />
          </span>
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Stock</TableHead>
            <TableHead scope="col" numeric>Shares</TableHead>
            <TableHead scope="col" numeric>Price</TableHead>
            <TableHead scope="col" numeric>Today</TableHead>
            <TableHead scope="col" numeric>Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {HOLDINGS.map(([symbol, shares]) => {
            const s = stock(symbol)
            return (
              <TableRow key={symbol}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <Ticker symbol={symbol} />
                    {s.name}
                  </span>
                </TableCell>
                <TableCell numeric>{shares}</TableCell>
                <TableCell numeric>{formatMoney(s.price)}</TableCell>
                <TableCell numeric>
                  <Change value={s.change} />
                </TableCell>
                <TableCell numeric className="font-semibold">{formatMoney(shares * s.price)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableHead scope="row" colSpan={4}>Total</TableHead>
            <TableCell numeric>{formatMoney(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Section>
  )
}

const STATUS_OF: Readonly<Record<TradeStatus, keyof typeof STATUS_TONE>> = {
  "Done": "running",
  "Stopped by limit": "blocked",
  "Waiting for you": "waiting"
}

const DEFAULT_SELECTION: ReadonlySet<string> = new Set(["2858"])
const NO_TRADES: ReadonlyArray<Trade> = []

const TRADE_COLUMNS: ReadonlyArray<DataTableColumn<Trade>> = [
  {
    id: "stock",
    header: "Stock",
    cell: (t) => <Ticker symbol={t.symbol} />,
    sortValue: (t) => t.symbol,
    hideable: false
  },
  {
    id: "agent",
    header: "Agent",
    cell: (t) => (
      <span className="flex items-center gap-2">
        <AgentAvatar agentId={t.agent.id} size="sm" />
        {t.agent.name}
      </span>
    ),
    sortValue: (t) => t.agent.name
  },
  {
    id: "side",
    header: "Side",
    cell: (t) => <Badge variant={t.side === "Buy" ? "secondary" : "outline"}>{t.side}</Badge>,
    sortValue: (t) => t.side
  },
  { id: "amount", header: "Amount", cell: (t) => formatMoney(t.amount), sortValue: (t) => t.amount, numeric: true },
  {
    id: "status",
    header: "Status",
    cell: (t) => <Status tone={STATUS_OF[t.status]}>{t.status}</Status>,
    sortValue: (t) => t.status
  },
  {
    id: "day",
    header: "Date",
    cell: (t) => <span className="text-g-500 tabular-nums">Nov {t.day}</span>,
    sortValue: (t) => t.day
  }
]

function DataTableSection() {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(1)
  const q = query.trim().toLowerCase()
  // A stable array per query: the table keeps its page while you select rows.
  const rows = useMemo(
    () =>
      TRADES.filter((t) =>
        !q || t.symbol.toLowerCase().includes(q) || t.agent.name.toLowerCase().includes(q) ||
        stock(t.symbol).name.toLowerCase().includes(q)
      ),
    [q]
  )
  return (
    <Section
      title="Data table"
      purpose="A table you can work with: sort, filter, select rows, choose columns, page through."
      base="Table + TanStack Table"
    >
      <DataTable
        caption="Agent trades, sortable"
        columns={TRADE_COLUMNS}
        rows={rows}
        getRowId={(t) => String(t.id)}
        defaultSort={{ column: "day", direction: "descending" }}
        pageSize={6}
        selectable
        rowLabel={(t) => `Select trade ${t.id}`}
        defaultSelection={DEFAULT_SELECTION}
        onSelectionChange={(selection) => setSelected(selection.size)}
        toolbar={
          <>
            <InputGroup size="sm" className="w-[min(100%,300px)]">
              <Icon name="search" size={16} />
              <InputGroupInput
                aria-label="Filter trades"
                placeholder="Filter by stock or agent"
                value={query}
                onValueChange={setQuery}
              />
            </InputGroup>
            {selected > 0 && (
              <span className="ml-auto text-label font-[550] text-blue tabular-nums">{selected} selected</span>
            )}
          </>
        }
        empty={
          <Empty variant="plain" size="sm">
            <EmptyMedia variant="default">
              <Icon name="search" size={20} />
            </EmptyMedia>
            <EmptyTitle className="text-body-sm">No trades match “{query.trim()}”</EmptyTitle>
            <EmptyDescription>Try a ticker like NVDA or an agent name.</EmptyDescription>
            <EmptyContent>
              <Button variant="secondary" size="sm" onClick={() => setQuery("")}>Clear filter</Button>
            </EmptyContent>
          </Empty>
        }
      />
      <div className="grid gap-4">
        <Demo label="Read only · columns hidden at first" className="block">
          <DataTable
            caption="Recent trades, read only"
            columns={TRADE_COLUMNS}
            rows={TRADES.slice(0, 3)}
            getRowId={(t) => String(t.id)}
            pageSize={3}
            defaultHiddenColumns={["agent", "status"]}
          />
        </Demo>
        <Demo label="Empty" className="block">
          <DataTable
            caption="Trades, none yet"
            columns={TRADE_COLUMNS}
            rows={NO_TRADES}
            getRowId={(t) => String(t.id)}
            selectable
            empty={
              <Empty variant="plain" size="sm">
                <EmptyMedia variant="default">
                  <Icon name="activity" size={20} />
                </EmptyMedia>
                <EmptyTitle className="text-body-sm">No trades yet</EmptyTitle>
                <EmptyDescription>Your agents' trades show up here.</EmptyDescription>
              </Empty>
            }
          />
        </Demo>
      </div>
    </Section>
  )
}

function ChartSection() {
  const [kind, setKind] = useState<ReadonlyArray<string>>(["area"])
  const chart = kind[0] ?? "area"
  return (
    <Section
      title="Chart"
      purpose="Area, bar and line charts in the series colors. Hover, or focus a chart and use the arrow keys, to read exact values."
      base="Chart (Recharts)"
    >
      <Card className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardDescription className="flex items-center gap-2">
              {chart === "bar" ? "Bought and sold, per week" : "Portfolio, last 30 days"} <ExampleFlag />
            </CardDescription>
            <p className="mt-0.5 text-[28px] leading-[1.15] font-semibold tracking-[-0.035em] tabular-nums">
              $10,452.90 <span className="text-label font-semibold tracking-normal text-gain">+4.8%</span>
            </p>
          </div>
          <ToggleGroup
            aria-label="Chart type"
            size="sm"
            value={kind}
            onValueChange={(next) => next.length > 0 && setKind(next)}
          >
            <ToggleGroupItem value="area">Area</ToggleGroupItem>
            <ToggleGroupItem value="bar">Bar</ToggleGroupItem>
            <ToggleGroupItem value="line">Line</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {chart === "bar" && <BarChart title="Bought and sold by agents per week" labels={WEEKS} series={FLOW_SERIES} />}
        {chart === "line" && (
          <LineChart title="Stocks and cash value, last 30 days" labels={DAY_LABELS} series={VALUE_SERIES} />
        )}
        {chart === "area" && (
          <AreaChart title="Stocks and cash value, last 30 days" labels={DAY_LABELS} series={VALUE_SERIES} />
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-3 pb-4">
          <CardDescription>One series, no legend</CardDescription>
          <LineChart
            title="Cash, last 30 days"
            labels={DAY_LABELS}
            series={CASH_SERIES}
            height={180}
            showLegend={false}
          />
        </Card>
        <Card className="gap-3 pb-4">
          <CardDescription>Custom colors and ticks</CardDescription>
          <BarChart
            title="Agent fees per week"
            labels={WEEKS}
            series={FEE_SERIES}
            height={180}
            formatValue={(value) => formatMoney(value)}
            formatTick={(value) => `$${value}`}
          />
        </Card>
      </div>
    </Section>
  )
}

function AvatarSection() {
  return (
    <Section
      title="Avatar"
      purpose="A person or an agent at a glance. Agents get their own pixel butterfly, made from their id."
      base="Avatar"
    >
      <Demo className="items-start gap-x-10 gap-y-7">
        <div className="grid gap-3">
          <Caption>Agents</Caption>
          <div className="flex items-center gap-2.5">
            <AgentAvatar agentId="rebalancer" size="sm" />
            <AgentAvatar agentId="stock-picker" />
            <AgentAvatar agentId="weekly-buyer" size="lg" />
            <AgentAvatar agentId="stop-loss" size="xl" />
          </div>
        </div>
        <div className="grid gap-3">
          <Caption>People and fallbacks</Caption>
          <div className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>MK</AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>
                <Icon name="user" size={20} label="Guest" />
              </AvatarFallback>
            </Avatar>
            <Avatar size="lg">
              <AvatarFallback>JS</AvatarFallback>
              <AvatarBadge>Online</AvatarBadge>
            </Avatar>
          </div>
        </div>
        <div className="grid gap-3">
          <Caption>Group</Caption>
          <AvatarGroup>
            {AGENTS.map((agent) => <AgentAvatar key={agent.id} agentId={agent.id} label={agent.name} />)}
            <Avatar className="rounded-md text-caption">
              <AvatarFallback>+3</AvatarFallback>
            </Avatar>
          </AvatarGroup>
        </div>
      </Demo>
    </Section>
  )
}

function BadgeSection() {
  return (
    <Section title="Badge" purpose="A small label for a count, a category or a state." base="Badge">
      <Demo className="flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge>New</Badge>
          <Badge variant="secondary">Rebalance only</Badge>
          <Badge variant="outline">Paused</Badge>
          <Badge variant="success">
            <Icon name="check" size={12} />Within limits
          </Badge>
          <Badge variant="warning">Near daily limit</Badge>
          <Badge variant="destructive">
            <Icon name="stop-sign" size={12} />Blocked
          </Badge>
          <Badge variant="count" aria-label="3 to approve">3</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Status tone="running">Running</Status>
          <Status tone="waiting">Waiting for you</Status>
          <Status tone="paused">Paused</Status>
          <Status tone="blocked">Stopped by limit</Status>
          <Status tone="idle">Draft</Status>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {STOCKS.slice(0, 8).map((s) => <Ticker key={s.symbol} symbol={s.symbol} large />)}
        </div>
      </Demo>
    </Section>
  )
}

function KbdSection() {
  return (
    <Section title="Kbd" purpose="Shows a key or a shortcut, the way it appears on the keyboard." base="Kbd">
      <Demo className="flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {["⌘", "K", "Esc", "↵", "Tab", "⇧"].map((key) => <Kbd key={key}>{key}</Kbd>)}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-label-sm text-g-500">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>{" "}
          Search
          <KbdGroup>
            <Kbd>⇧</Kbd>
            <Kbd>⌘</Kbd>
            <Kbd>P</Kbd>
          </KbdGroup>{" "}
          Pause all agents
          <KbdGroup>
            <Kbd>Ctrl</Kbd>+<Kbd>B</Kbd>
          </KbdGroup>{" "}
          Toggle sidebar
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>
            Approve <Kbd variant="inverse" className="-mr-1 ml-0.5">↵</Kbd>
          </Button>
          <Button variant="secondary">
            <Icon name="search" size={16} />Search <Kbd variant="inset" className="-mr-1 ml-0.5">⌘K</Kbd>
          </Button>
          <span className="inline-flex items-center gap-2 rounded-sm bg-ink px-2.5 py-1.5 text-label-sm font-[550] text-white shadow-e2">
            Search <Kbd variant="inverse">⌘K</Kbd>
          </span>
        </div>
      </Demo>
    </Section>
  )
}

/* ---------- Feedback ---------- */

function AlertSection() {
  const [dismissed, setDismissed] = useState(false)
  return (
    <Section
      title="Alert"
      purpose="A message in the page that stays until it's resolved. Say what happened and what to do next."
      base="Alert"
    >
      <div className="grid gap-3">
        <Alert>
          <AlertTitle>Prices are a few seconds old</AlertTitle>
          <AlertDescription>
            Your agents always use a fresh price and the fair price check before they trade.
          </AlertDescription>
        </Alert>
        <Alert variant="success">
          <AlertTitle>Limits locked</AlertTitle>
          <AlertDescription>Rebalancer can trade now. Only you can change its limits, with Face ID.</AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTitle>Weekly buyer is close to its daily limit</AlertTitle>
          <AlertDescription>$212 of $250 spent today. Its next trade waits until tomorrow.</AlertDescription>
          <AlertAction>
            <Button variant="secondary" size="sm">Raise limit</Button>
          </AlertAction>
        </Alert>
        {dismissed ?
          (
            <Button variant="link" className="justify-self-start" onClick={() => setDismissed(false)}>
              Show the dismissed alert again
            </Button>
          ) :
          (
            <Alert variant="destructive">
              <AlertTitle>Your limit stopped this trade.</AlertTitle>
              <AlertDescription>
                Stock picker tried to put 31% in{" "}
                <Ticker symbol="TSLA" />. Your limit is 25% in one stock, so nothing happened.
              </AlertDescription>
              <AlertAction>
                <Button variant="secondary" size="sm">See details</Button>
                <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setDismissed(true)}>
                  <Icon name="close" size={16} />
                </Button>
              </AlertAction>
            </Alert>
          )}
      </div>
    </Section>
  )
}

function ProgressSection() {
  const ids = [useId(), useId(), useId()]
  return (
    <Section
      title="Progress"
      purpose="How far along something is. Determinate when we know, indeterminate when we don't."
      base="Progress"
    >
      <Demo>
        <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] items-start gap-x-6 gap-y-5">
          <ProgressField id={ids[0]!} label="Spent today" detail="$180 of $250">
            <Progress value={72} aria-labelledby={ids[0]} />
          </ProgressField>
          <ProgressField id={ids[1]!} label="Close to the limit" detail="$238 of $250">
            <Progress value={95} variant="warning" aria-labelledby={ids[1]} />
          </ProgressField>
          <ProgressField id={ids[2]!} label="Waiting for Base" detail="Usually a few seconds">
            <Progress value={null} aria-labelledby={ids[2]} />
          </ProgressField>
          <div className="grid gap-[7px]">
            <Caption>Rings</Caption>
            <div className="flex flex-wrap items-center gap-2.5">
              <ProgressRing value={72} aria-label="Spent today" />
              <ProgressRing value={95} variant="warning" aria-label="Close to the limit" />
              <ProgressRing value={100} variant="success" aria-label="Setup done" />
              <ProgressRing value={null} aria-label="Loading" />
            </div>
          </div>
        </div>
      </Demo>
    </Section>
  )
}

function ProgressField(
  { id, label, detail, children }: {
    readonly id: string
    readonly label: string
    readonly detail: string
    readonly children: ReactNode
  }
) {
  return (
    <div className="grid gap-[7px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span id={id} className="text-[13.5px] font-[550]">{label}</span>
        <span className="text-label-sm text-g-500 tabular-nums">{detail}</span>
      </div>
      {children}
    </div>
  )
}

function SkeletonSection() {
  const [loaded, setLoaded] = useState(false)
  return (
    <Section
      title="Skeleton"
      purpose="The shape of what's loading, in the same layout, so nothing jumps when it arrives."
      base="Skeleton"
    >
      <Label className="w-fit gap-3">
        Show loaded content
        <Switch checked={loaded} onCheckedChange={setLoaded} />
      </Label>
      <div aria-busy={!loaded} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
        <Card className="min-h-[236px]">
          {loaded ?
            (
              <>
                <div className="flex items-start gap-2.5">
                  <AgentAvatar agentId="weekly-buyer" />
                  <div>
                    <strong className="text-body-sm font-semibold">Weekly buyer</strong>
                    <p className="text-label-sm text-g-500">Buys $50 of NVDA every Friday.</p>
                  </div>
                </div>
                <LimitList />
              </>
            ) :
            (
              <>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-[34px] rounded-md" />
                  <div className="grid flex-1 gap-[7px]">
                    <Skeleton className="w-[55%]" />
                    <Skeleton className="h-2.5 w-4/5" />
                  </div>
                </div>
                <div className="grid gap-[7px]">
                  <Skeleton className="h-2.5 w-full" />
                  <Skeleton className="h-2.5 w-[90%]" />
                  <Skeleton className="h-2.5 w-[70%]" />
                </div>
                <Skeleton className="h-[30px] w-24 rounded-sm" />
              </>
            )}
        </Card>
        <Card className="min-h-[236px]">
          {HOLDINGS.slice(0, 4).map(([symbol, shares]) =>
            loaded ?
              (
                <div key={symbol} className="flex items-center gap-2.5">
                  <Ticker symbol={symbol} large />
                  <div className="grid min-w-0 flex-1">
                    <strong className="text-body-sm font-semibold">{stock(symbol).name}</strong>
                    <span className="text-label-sm text-g-500 tabular-nums">{shares} shares</span>
                  </div>
                  <b className="font-semibold tabular-nums">{formatMoney(shares * stock(symbol).price)}</b>
                </div>
              ) :
              (
                <div key={symbol} className="flex items-center gap-2.5">
                  <Skeleton className="h-6 w-[52px] rounded-[7px]" />
                  <div className="grid flex-1 gap-[7px]">
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-2.5 w-[30%]" />
                  </div>
                  <Skeleton className="w-16" />
                </div>
              )
          )}
        </Card>
        <Card className="min-h-[236px]">
          {loaded ?
            (
              <>
                <div>
                  <CardDescription className="flex items-center gap-2">
                    Portfolio <ExampleFlag />
                  </CardDescription>
                  <p className="mt-0.5 text-[28px] leading-[1.15] font-semibold tracking-[-0.035em] tabular-nums">
                    $10,452.90
                  </p>
                </div>
                <svg viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden className="h-24 w-full">
                  <path
                    d="M0,62 C20,58 30,40 50,44 S80,60 100,38 S140,30 160,22 S190,16 200,10 V80 H0Z"
                    className="fill-blue-50"
                  />
                  <path
                    d="M0,62 C20,58 30,40 50,44 S80,60 100,38 S140,30 160,22 S190,16 200,10"
                    className="fill-none stroke-blue stroke-2 [vector-effect:non-scaling-stroke]"
                  />
                </svg>
              </>
            ) :
            (
              <>
                <Skeleton className="w-2/5" />
                <Skeleton className="h-[26px] w-3/5" />
                <Skeleton className="h-24 w-full rounded-md" />
              </>
            )}
        </Card>
      </div>
    </Section>
  )
}

function EmptySection() {
  return (
    <Section title="Empty" purpose="What goes here, why it's empty, and the one thing to do next." base="Empty">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <Empty>
          <EmptyMedia>
            <Icon name="agents" size={24} />
          </EmptyMedia>
          <EmptyTitle>No agents yet</EmptyTitle>
          <EmptyDescription>
            Tell bluechip what you want in plain words, like “buy $50 of Nvidia every Friday”. You'll set its limits
            before it starts.
          </EmptyDescription>
          <EmptyContent>
            <Button>
              <Icon name="plus" size={16} />Create an agent
            </Button>
            <Button variant="ghost">See templates</Button>
          </EmptyContent>
        </Empty>
        <div className="grid gap-3">
          <Empty variant="outline" size="sm">
            <EmptyMedia>
              <Icon name="activity" size={18} />
            </EmptyMedia>
            <EmptyTitle>No activity this week</EmptyTitle>
            <EmptyDescription>Trades and stopped trades show up here.</EmptyDescription>
          </Empty>
          <Empty variant="outline" size="sm">
            <EmptyMedia>
              <Icon name="approvals" size={18} />
            </EmptyMedia>
            <EmptyTitle>Nothing to approve</EmptyTitle>
            <EmptyDescription>When an agent needs your OK, it'll wait here.</EmptyDescription>
          </Empty>
        </div>
      </div>
    </Section>
  )
}

/* ---------- Layout ---------- */

function SeparatorSection() {
  return (
    <Section
      title="Separator"
      purpose="A hairline between groups. Decorative unless it separates real sections."
      base="Separator"
    >
      <Demo>
        <div className="grid w-full max-w-[520px] gap-4">
          <div>
            <strong className="text-[15px] font-semibold">Rebalancer</strong>
            <p className="text-label-sm text-g-500">Keeps your mix on target.</p>
          </div>
          <Separator />
          <div className="flex h-4 items-center gap-3.5 text-[13.5px] text-g-600">
            <span>Limits</span>
            <Separator orientation="vertical" />
            <span>Activity</span>
            <Separator orientation="vertical" />
            <span>Settings</span>
          </div>
          <div className="flex items-center gap-3 text-caption text-g-400">
            <Separator className="flex-1" />
            <span>or</span>
            <Separator className="flex-1" />
          </div>
          <Button variant="secondary" className="w-full">
            <Icon name="face-id" size={16} />Continue with Face ID
          </Button>
        </div>
      </Demo>
    </Section>
  )
}

function AspectRatioSection() {
  return (
    <Section
      title="Aspect ratio"
      purpose="Keeps media at a fixed shape at any width: share cards, charts, art."
      base="AspectRatio"
    >
      <div className="grid grid-cols-2 items-end gap-4 md:grid-cols-[2fr_1fr_0.9fr]">
        <figure className="col-span-2 grid gap-2 md:col-span-1">
          <AspectRatio ratio={16 / 9} className="rounded-lg bg-white shadow-e1">
            <Halftone scene="market" still interactive={false} />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">16 : 9 · share card</figcaption>
        </figure>
        <figure className="grid gap-2">
          <AspectRatio ratio={1} className="rounded-lg bg-white shadow-e1">
            <Halftone scene="logo" still interactive={false} />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">1 : 1 · avatar art</figcaption>
        </figure>
        <figure className="grid gap-2">
          <AspectRatio
            ratio={4 / 5}
            className="grid place-items-center rounded-lg bg-sunken bg-[radial-gradient(rgba(10,11,13,.07)_1px,transparent_1px)] bg-size-[12px_12px] shadow-e1 *:size-auto"
          >
            <AgentAvatar agentId="weekly-buyer" size="xl" />
          </AspectRatio>
          <figcaption className="text-label-sm font-medium text-g-500">4 : 5 · story</figcaption>
        </figure>
      </div>
    </Section>
  )
}

function ScrollAreaSection() {
  return (
    <Section
      title="Scroll area"
      purpose="A scrolling region with a slim, quiet scrollbar that still works with keyboard and wheel."
      base="ScrollArea"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
        <ScrollArea aria-label="Recent activity" className="h-60 rounded-lg bg-white shadow-e1">
          <div className="px-3.5 py-1.5">
            {TRADES.slice(0, 14).map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2.5 border-b border-g-100 py-[9px] text-[13.5px] last:border-b-0"
              >
                <Ticker symbol={t.symbol} />
                <span className="min-w-0 flex-1">
                  {t.agent.name} · {t.side === "Buy" ? "bought" : "sold"} {formatMoney(t.amount)}
                </span>
                <span className="text-label-sm text-g-500 tabular-nums">Nov {t.day}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
        <ScrollArea aria-label="Stocks" orientation="horizontal" className="rounded-lg bg-white shadow-e1">
          <div className="flex w-max gap-2.5 p-3.5">
            {STOCKS.map((s) => (
              <div
                key={s.symbol}
                className="grid w-32 justify-items-start gap-1 rounded-[12px] bg-g-50 p-3 text-label shadow-[inset_0_0_0_1px_rgba(10,11,13,.05)]"
              >
                <Ticker symbol={s.symbol} large />
                <strong className="mt-1 font-semibold">{s.name}</strong>
                <span className="tabular-nums">{formatMoney(s.price)}</span>
                <Change value={s.change} />
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Section>
  )
}
