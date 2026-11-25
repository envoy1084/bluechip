import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup } from "@bluechip/ui/components/avatar"
import { Badge } from "@bluechip/ui/components/badge"
import { Button } from "@bluechip/ui/components/button"
import { Card, CardDescription } from "@bluechip/ui/components/card"
import { AreaChart, BarChart, LineChart } from "@bluechip/ui/components/chart"
import { Kbd, KbdGroup } from "@bluechip/ui/components/kbd"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { useState } from "react"
import { AGENTS, CASH_SERIES, DAY_LABELS, FEE_SERIES, FLOW_SERIES, STOCKS, VALUE_SERIES, WEEKS } from "./data.ts"
import { Caption, Demo, Section, Status, Ticker } from "./layout.tsx"

export function ChartSection() {
  const [kind, setKind] = useState<ReadonlyArray<string>>(["area"])
  const chart = kind[0] ?? "area"
  return (
    <Section
      title="Chart"
      purpose="Area, bar and line charts in the series colors. Hover, or focus a chart and use the arrow keys, to read exact values."
      base="Chart (TanStack Charts)"
    >
      <Card className="gap-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardDescription className="flex items-center gap-2">
              {chart === "bar" ? "Bought and sold, per week" : "Portfolio, last 30 days"}
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

export function AvatarSection() {
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

export function BadgeSection() {
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

export function KbdSection() {
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
