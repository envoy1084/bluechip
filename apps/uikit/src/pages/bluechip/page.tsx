import { AddressChip } from "@bluechip/ui/bluechip/address-chip"
import { AllocationDonut, type AllocationSlice } from "@bluechip/ui/bluechip/allocation-donut"
import { AllocationEditor } from "@bluechip/ui/bluechip/allocation-editor"
import { BlockedTradeCard } from "@bluechip/ui/bluechip/blocked-trade-card"
import { DepositCard } from "@bluechip/ui/bluechip/deposit-card"
import { CashHoldingRow, HoldingRow } from "@bluechip/ui/bluechip/holding-row"
import { KillSwitch } from "@bluechip/ui/bluechip/kill-switch"
import { PortfolioChart } from "@bluechip/ui/bluechip/portfolio-chart"
import { TickerMarquee } from "@bluechip/ui/bluechip/ticker-marquee"
import { Button } from "@bluechip/ui/components/button"
import { Skeleton } from "@bluechip/ui/components/skeleton"
import { Toaster } from "@bluechip/ui/components/toast"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useRef, useState } from "react"
import { ActivitySection, ApprovalSection, OrderSection, TradeOutcomeSection } from "./activity.tsx"
import { DemoControls } from "./controls.tsx"
import { card, Group, Section } from "./layout.tsx"
import {
  type Activity,
  ADDRESS,
  CAP,
  changeOf,
  FIRST_ACTIVITY,
  HOLDINGS,
  portfolioRanges,
  type Quote,
  RESERVE,
  SENDER,
  START,
  START_CASH,
  TARGET,
  wait
} from "./market.ts"
import {
  AllocationBarSection,
  MarketSection,
  MoneySection,
  PriceSection,
  SparklineSection,
  StockList,
  TickerSection
} from "./money.tsx"
import { PasskeySection } from "./safety.tsx"

/* ---------- Page ---------- */

export function KitBluechip() {
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
          move them all at once.
        </p>
      </div>

      <DemoControls market={market} log={log} actions={actions} onShow={show} />

      <Group
        id="market-money"
        title="Market & money"
        intro="Prices, balances and how your money is split. Numbers are tabular, changes are never color alone."
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
            "Keyboard: focus the chart, ← → Home End",
            "measure=\"profit\": signed amounts and no percent, for profit and loss"
          ]}
          states={[
            ["Loading", <PortfolioChart key="l" ranges={[]} loading className="shadow-none" />, true],
            [
              "Empty · new account",
              <PortfolioChart key="e" ranges={[{ id: "All", description: "", points: [] }]} className="shadow-none" />,
              true
            ],
            [
              "Profit and loss",
              <PortfolioChart
                key="p"
                title="Profit and loss"
                measure="profit"
                ranges={[{
                  id: "All",
                  description: "Since your first trade",
                  points: [
                    { value: 0, label: "Mon 16 Nov" },
                    { value: -12.4, label: "Tue 17 Nov" },
                    { value: 8.15, label: "Wed 18 Nov" },
                    { value: 31.62, label: "Thu 19 Nov" },
                    { value: 24.9, label: "Fri 20 Nov" }
                  ]
                }]}
                className="shadow-none"
              />,
              true
            ]
          ]}
        >
          <PortfolioChart ranges={portfolioRanges(total, dayChange)} defaultRange="1M" />
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
            ],
            [
              "Loading: measured from a sample row",
              <div key="l" className="w-full overflow-hidden rounded-md">
                <Skeleton loading label="Loading holdings">
                  <HoldingRow
                    symbol="XXXX"
                    name="Company name"
                    shares={10.5}
                    value={2000}
                    weight={18}
                    cap={CAP}
                    change={1.5}
                  />
                </Skeleton>
              </div>,
              true
            ]
          ]}
        >
          <div className={cn(card, "overflow-hidden")}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-g-100 px-4 py-[13px]">
              <b className="text-body-sm font-semibold">Holdings</b>
              <span className="flex items-center gap-1.5 text-caption text-g-500">
                Share of your money · your max
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
        <TradeOutcomeSection />
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
          </div>
        </Section>
        <Section
          id="deposit"
          title="Deposit card"
          purpose="How to add cash. Send USDC on Base to your address; while it's open, it shows the moment the cash lands. The warning is loud because other coins or networks can be lost."
          notes={[
            "The QR here is a pixel pattern, not a real code",
            "Arrival sweeps and rolls in",
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
