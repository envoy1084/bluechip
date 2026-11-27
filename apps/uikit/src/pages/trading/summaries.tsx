import { HoldingDetail, HoldingDetailSkeleton } from "@bluechip/ui/bluechip/holding-detail"
import {
  MoneyCard,
  MoneyCardSkeleton,
  PortfolioSummary,
  PortfolioSummaryError,
  PortfolioSummarySkeleton
} from "@bluechip/ui/bluechip/portfolio-summary"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { TradeReceipt } from "@bluechip/ui/bluechip/trade-receipt"
import { Button } from "@bluechip/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { NumberRoll } from "@bluechip/ui/motion/number-roll"
import { useState } from "react"
import { Demo, Section, States } from "../agents/layout.tsx"

const POSITIONS = [
  { symbol: "NVDA", name: "Nvidia", value: 4820.5 },
  { symbol: "AAPL", name: "Apple", value: 3104.2 },
  { symbol: "MSFT", name: "Microsoft", value: 2210.75 },
  { symbol: "TSLA", name: "Tesla", value: 980.1 },
  { symbol: "AMZN", name: "Amazon", value: 640 },
  { symbol: "META", name: "Meta", value: 410.45 }
] as const

const ADD_CASH = (
  <Button size="sm" variant="secondary">
    <Icon name="plus" size={14} />Add cash
  </Button>
)

export function PortfolioSection() {
  const [cash, setCash] = useState(1250)
  const value = POSITIONS.reduce((sum, position) => sum + position.value, 0) + cash

  return (
    <Section
      title="Portfolio summary"
      purpose="Your money at a glance: what it's worth, how it moved today, and what it's in as one strip. The largest holdings are named; the rest fold into Others."
    >
      <Demo className="grid justify-items-center gap-3">
        <PortfolioSummary
          value={value}
          dayChange={184.3}
          dayChangePercent={1.37}
          cash={cash}
          positions={POSITIONS}
          addCash={ADD_CASH}
          className="w-full max-w-[520px]"
        />
        <Button variant="ghost" size="sm" onClick={() => setCash((amount) => amount + 200)}>
          <Icon name="plus" size={14} />Simulate $200 arriving
        </Button>
      </Demo>
      <States>
        <Demo label="Loading">
          <PortfolioSummarySkeleton className="w-full" />
        </Demo>
        <Demo label="Nothing yet">
          <PortfolioSummary
            value={0}
            dayChange={0}
            dayChangePercent={0}
            cash={0}
            positions={[]}
            addCash={ADD_CASH}
            className="w-full"
          />
        </Demo>
        <Demo label="Cash only">
          <PortfolioSummary
            value={500}
            dayChange={0}
            dayChangePercent={0}
            cash={500}
            positions={[]}
            className="w-full"
          />
        </Demo>
        <Demo label="Couldn't load">
          <PortfolioSummaryError onRetry={() => {}} className="w-full" />
        </Demo>
      </States>
      <Demo label="Money card, shared by home and the portfolio" className="grid gap-3">
        <MoneyCard
          value={value}
          dayChange={184.3}
          dayChangePercent={1.37}
          aside={<span className="text-label text-g-500">Aside: a sparkline or the profit in all</span>}
          className="w-full max-w-[520px]"
        >
          <div className="flex items-center justify-between gap-2 border-t border-g-100 pt-3 text-label text-g-500">
            <span>{formatMoney(cash)} in cash to invest</span>
            {ADD_CASH}
          </div>
        </MoneyCard>
        <MoneyCardSkeleton className="w-full max-w-[520px]" />
      </Demo>
    </Section>
  )
}

export function HoldingSection() {
  return (
    <Section
      title="Holding detail"
      purpose="One holding up close: its value, today's move, what it returned, how much of your money it is against your max, and the agents that trade it."
    >
      <Demo className="justify-center">
        <HoldingDetail
          symbol="AAPL"
          name="Apple"
          shares={16.284}
          price={190.62}
          dayChangePercent={0.84}
          cost={2875}
          weight={23}
          cap={30}
          agents={[{ id: "nimbus", name: "Nimbus" }, { id: "weekly", name: "Weekly buyer" }]}
          actions={
            <>
              <Button size="sm">Buy</Button>
              <Button size="sm" variant="secondary">Sell</Button>
            </>
          }
          className="w-full max-w-[560px]"
        />
      </Demo>
      <States>
        <Demo label="Loading">
          <HoldingDetailSkeleton className="w-full" />
        </Demo>
        <Demo label="Down today, no agents">
          <HoldingDetail
            symbol="TSLA"
            name="Tesla"
            shares={2.5}
            price={392.04}
            dayChangePercent={-2.1}
            weight={8}
            className="w-full"
          />
        </Demo>
      </States>
    </Section>
  )
}

export function ReceiptSection() {
  return (
    <Section
      title="Trade receipt"
      purpose="A filled trade, kept for its activity's detail: what moved, at what price, who sent it and when, with the transaction on Base."
    >
      <States>
        <Demo label="Your buy">
          <TradeReceipt
            side="buy"
            symbol="AAPL"
            name="Apple"
            shares={0.2623}
            price={190.62}
            total={50}
            by="You"
            when="Today at 09:41"
            txUrl="https://basescan.org/tx/0x5f1c2a7e4b9d03f6a1e8c2b7d4f9a0e3c6b1d8f2a5e7c9b3d0f4a6e8c1b2d3e4"
            className="w-full"
          />
        </Demo>
        <Demo label="An agent's sell">
          <TradeReceipt
            side="sell"
            symbol="NVDA"
            name="Nvidia"
            shares={0.4}
            price={181.42}
            total={72.57}
            by="Nimbus"
            when="Yesterday at 15:02"
            className="w-full"
          />
        </Demo>
      </States>
    </Section>
  )
}

export function StatSection() {
  const [value, setValue] = useState(12_165.99)

  return (
    <Section
      title="Stat tiles and empty states"
      purpose="One number with its label, in grids that wrap; numbers settle as they change. Every list has an empty state that says what goes there and the one next step."
    >
      <Demo className="grid gap-4">
        <StatGrid>
          <StatTile
            label="Your money"
            value={<NumberRoll value={value} format={formatMoney} />}
            detail="Holdings and cash"
          />
          <StatTile label="Cash" value="$1,250.00" detail="Ready to invest" />
          <StatTile label="Agents running" value="3" detail="1 paused" />
          <StatTile label="Waiting for you" value="1" detail="A trade over $100" />
        </StatGrid>
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setValue((amount) => amount + 184.3)}
        >
          <Icon name="refresh" size={14} />Move the price
        </Button>
      </Demo>
      <States>
        <Demo label="No holdings">
          <Empty size="sm" className="w-full">
            <EmptyMedia>
              <Icon name="portfolio" size={20} />
            </EmptyMedia>
            <EmptyTitle>No stocks yet</EmptyTitle>
            <EmptyDescription>Buy a stock, or start an agent to buy for you.</EmptyDescription>
            <EmptyContent>
              <Button size="sm">Browse stocks</Button>
            </EmptyContent>
          </Empty>
        </Demo>
        <Demo label="No activity">
          <Empty size="sm" className="w-full">
            <EmptyMedia>
              <Icon name="activity" size={20} />
            </EmptyMedia>
            <EmptyTitle>Nothing has happened yet</EmptyTitle>
            <EmptyDescription>Trades, deposits and your agents' moves show up here.</EmptyDescription>
          </Empty>
        </Demo>
        <Demo label="No agents">
          <Empty size="sm" className="w-full">
            <EmptyMedia>
              <Icon name="agents" size={20} />
            </EmptyMedia>
            <EmptyTitle>No agents yet</EmptyTitle>
            <EmptyDescription>
              Start one from a template. You lock its rules with Face ID before it can trade.
            </EmptyDescription>
            <EmptyContent>
              <Button size="sm">
                <Icon name="plus" size={14} />New agent
              </Button>
            </EmptyContent>
          </Empty>
        </Demo>
      </States>
    </Section>
  )
}
