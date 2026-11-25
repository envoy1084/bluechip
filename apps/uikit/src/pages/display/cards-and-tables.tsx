import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
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
import { DataTable, type DataTableColumn } from "@bluechip/ui/components/data-table"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { InputGroup, InputGroupInput } from "@bluechip/ui/components/input-group"
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
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useMemo, useState } from "react"
import { HOLDINGS, stock, type Trade, TRADES, type TradeStatus } from "./data.ts"
import { Change, Demo, LimitList, Section, Status, type STATUS_TONE, Ticker } from "./layout.tsx"

export function CardSection() {
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
            <span className="grid size-[38px] place-items-center rounded-[11px] bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.3),0_3px_6px_-3px_rgba(42,91,255,.22)]">
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

export function TableSection() {
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
            Your stocks
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

export function DataTableSection() {
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
