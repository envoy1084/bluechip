import { ActivityItem, type ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import { FairPriceCheck, OrderPreview, OrderPreviewRow, TradeOrderPreview } from "@bluechip/ui/bluechip/order-preview"
import { Outcome, type OutcomeTone } from "@bluechip/ui/bluechip/outcome"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Button } from "@bluechip/ui/components/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useRef, useState } from "react"
import { card, Section } from "./layout.tsx"
import { type Activity, APPROVAL_ORDER, wait } from "./market.ts"

/* ---------- Activity & approvals ---------- */

export function ActivitySection(
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
            Activity
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
                      <Button size="sm" onClick={() => onGo("activity")}>Review and approve</Button> :
                      <Button variant="secondary" size="sm" onClick={() => onGo("activity")}>Review</Button>
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

export function OrderSection({ nvidia, tesla }: { readonly nvidia: number; readonly tesla: number }) {
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
                <TickerChip symbol="NVDA" size="sm" />$73.61 of Nvidia
              </OrderPreviewRow>
              <OrderPreviewRow label="Buy">
                <TickerChip symbol="AAPL" size="sm" />$73.61 of Apple
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
          Prices update until you approve.
        </p>
      </div>
    </Section>
  )
}

export function TradeOutcomeSection() {
  const [tone, setTone] = useState<OutcomeTone>("pending")
  const run = useRef(0)
  const go = async (fail: boolean) => {
    const id = ++run.current
    setTone("pending")
    await wait(2000)
    if (id === run.current) setTone(fail ? "failure" : "success")
  }
  const copy: Readonly<Record<OutcomeTone, readonly [string, string]>> = {
    pending: ["Buying $50.00 of Apple", "Base confirms it in a couple of seconds."],
    success: ["Bought $50.00 of Apple", "It's in your portfolio."],
    failure: ["Your buy didn't go through", "Base didn't take it. Nothing was bought. Your cash is where it was."],
    neutral: ["Declined", "Nothing was bought."]
  }
  const [title, description] = copy[tone]
  return (
    <Section
      id="trade-outcome"
      title="Trade end state"
      purpose="Where a trade is after you approve it. Base takes about two seconds, so it's one short wait in place, then the fill or what happened to the money. No step tracker."
      notes={[
        "One element from the send to the end",
        "The spinner turns into a check that draws",
        "A failure says nothing moved and what to do"
      ]}
    >
      <div className="grid w-full justify-items-center gap-[22px]">
        <div className={cn(card, "max-w-[400px] px-5 py-6")}>
          <Outcome
            tone={tone}
            title={title}
            description={description}
            actions={tone === "pending" ?
              undefined :
              (
                <Button variant="secondary" className="w-full">
                  {tone === "failure" ? "Try again" : "Buy more Apple"}
                </Button>
              )}
          >
            {tone === "success" ?
              (
                <OrderPreview>
                  <OrderPreviewRow label="Shares bought">0.2623 shares</OrderPreviewRow>
                  <OrderPreviewRow label="Price">$190.62 a share</OrderPreviewRow>
                  <OrderPreviewRow label="You paid">$50.00</OrderPreviewRow>
                </OrderPreview>
              ) :
              undefined}
          </Outcome>
        </div>
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
