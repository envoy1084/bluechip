import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { AgentGlance } from "@bluechip/ui/bluechip/agent-glance"
import {
  ChatResult,
  ChatResultHeadline,
  ChatResultRow,
  ChatResultRows,
  ChatResultStat,
  ChatResultStats
} from "@bluechip/ui/bluechip/chat-result"
import { MixBar, MixCompare } from "@bluechip/ui/bluechip/mix-bar"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { UsageRing } from "@bluechip/ui/bluechip/usage-ring"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { Demo, Section, States } from "../agents/layout.tsx"

const OPEN = (
  <Button variant="ghost" size="xs" className="gap-1 text-g-600">
    Open<Icon name="arrow-right" size={14} />
  </Button>
)

const usd = (value: number) => `$${value.toLocaleString("en-US")}`

export function ResultSection() {
  return (
    <Section
      title="What a tool read"
      purpose="A read tool's answer, compact under its tool row: a quiet title with the way to its page, the number that matters, then a few rows or numbers. It shimmers while the tool runs, and says in a line when it found nothing or failed."
    >
      <Demo className="justify-center">
        <ChatResult title="Your portfolio" icon="portfolio" action={OPEN}>
          <ChatResultHeadline
            value="$4,212.40"
            change={<PriceChange size="sm" value={1.24} amount={51.6} />}
            detail="$1,240.00 in cash, $2,972.40 in stocks"
          />
          <MixBar
            label="Your mix"
            parts={[
              { id: "NVDA", label: "Nvidia", percent: 38 },
              { id: "AAPL", label: "Apple", percent: 22 },
              { id: "MSFT", label: "Microsoft", percent: 11 },
              { id: "cash", label: "Cash", percent: 29 }
            ]}
          />
          <ChatResultRows aria-label="Biggest holdings">
            <ChatResultRow
              media={<TickerChip symbol="NVDA" size="sm" />}
              title="Nvidia"
              detail="8.8 shares, 38% of your money"
              value="$1,600.70"
              valueDetail={<PriceChange size="sm" value={1.52} />}
            />
            <ChatResultRow
              media={<TickerChip symbol="AAPL" size="sm" />}
              title="Apple"
              detail="4.9 shares, 22% of your money"
              value="$931.20"
              valueDetail={<PriceChange size="sm" value={-0.4} />}
            />
          </ChatResultRows>
        </ChatResult>
      </Demo>
      <States>
        <Demo label="Results, below zero">
          <ChatResult title="Agent's results" icon="chart-line" action={OPEN}>
            <ChatResultHeadline
              value={<span className="text-loss">−$64.00</span>}
              detail="In all, over 9 trades"
              aside={<Sparkline values={[0, -8, -20, -18, -40, -52, -64]} width={88} height={28} tone="down" area />}
            />
            <ChatResultStats>
              <ChatResultStat label="Bought" value="$450.00" />
              <ChatResultStat label="Sold" value="$60.00" />
              <ChatResultStat label="Blocked" value="3 of 12" />
            </ChatResultStats>
          </ChatResult>
        </Demo>
        <Demo label="Agents as mini rows">
          <ChatResult title="Your agents" icon="agents" action={OPEN}>
            <ChatResultRows>
              <ChatResultRow
                media={<AgentAvatar agentId="nimbus" size="sm" status="active" />}
                title="Nimbus"
                detail="Running, trades Nvidia and Apple"
              />
              <ChatResultRow
                media={<AgentAvatar agentId="keeper" size="sm" status="paused" />}
                title="Keeper"
                detail="Paused, trades Microsoft"
              />
            </ChatResultRows>
          </ChatResult>
        </Demo>
        <Demo label="Usage, small rings">
          <ChatResult title="Today's usage" icon="timer" action={OPEN}>
            <div className="flex flex-wrap justify-around gap-3">
              <UsageRing size="sm" label="Spent today" used={180} limit={250} format={usd} detail="of $250" />
              <UsageRing size="sm" label="Trades today" used={4} limit={5} detail="of 5" />
            </div>
            <p className="text-label-sm text-g-500">Starts again at midnight UTC, in 5 h 20 min</p>
          </ChatResult>
        </Demo>
        <Demo label="Being read">
          <ChatResult title="Prices" icon="chart-up" state="loading" />
        </Demo>
        <Demo label="Found nothing">
          <ChatResult title="Your agents" icon="agents" state="empty" message="No agents yet." action={OPEN} />
        </Demo>
        <Demo label="Failed">
          <ChatResult
            title="Quote"
            icon="receipt"
            state="error"
            message="Couldn't get a quote. Prices are paused."
          />
        </Demo>
      </States>
    </Section>
  )
}

export function PlanSection() {
  return (
    <Section
      title="Mix before and after"
      purpose="A rebalance's plan: the mix now and after its trades as two strips in the stocks' own colors, cash in grey, then each part's share going from one to the other."
    >
      <Demo className="justify-center">
        <div className="w-full max-w-[520px]">
          <MixCompare
            changes={[
              { id: "NVDA", label: "Nvidia", before: 44, after: 35 },
              { id: "AAPL", label: "Apple", before: 21, after: 30 },
              { id: "MSFT", label: "Microsoft", before: 15, after: 15 },
              { id: "cash", label: "Cash", before: 20, after: 20 }
            ]}
          />
        </div>
      </Demo>
    </Section>
  )
}

export function GlanceSection() {
  return (
    <Section
      title="Limits at a glance"
      purpose="An agent's limits, compact for a card: its stocks, which way it trades, and its three numbers. On draft, change and agent cards."
    >
      <Demo className="justify-center">
        <div className="w-full max-w-[520px]">
          <AgentGlance
            stocks={["NVDA", "AAPL", "MSFT"]}
            direction="Buys and sells"
            stats={[{ label: "A day", value: "$250" }, { label: "Per trade", value: "$100" }, {
              label: "Trades a day",
              value: "5"
            }]}
          />
        </div>
      </Demo>
      <States>
        <Demo label="Sells only, no stocks yet">
          <AgentGlance
            stocks={[]}
            direction="Only sells"
            stats={[{ label: "A day", value: "None" }, { label: "Per trade", value: "Any" }, {
              label: "Trades a day",
              value: "Any"
            }]}
          />
        </Demo>
      </States>
    </Section>
  )
}
