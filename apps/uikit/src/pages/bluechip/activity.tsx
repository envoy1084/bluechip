import { ActivityItem, type ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import { ApprovalCard, type ApprovalProgress, ApprovalSheet } from "@bluechip/ui/bluechip/approval-sheet"
import { FairPriceCheck, OrderPreview, OrderPreviewRow, TradeOrderPreview } from "@bluechip/ui/bluechip/order-preview"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { type TransactionState, TransactionStatus } from "@bluechip/ui/bluechip/transaction-status"
import { Button } from "@bluechip/ui/components/button"
import { Checkbox } from "@bluechip/ui/components/checkbox"
import { Label } from "@bluechip/ui/components/label"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@bluechip/ui/components/tabs"
import { ToggleGroup, ToggleGroupItem } from "@bluechip/ui/components/toggle-group"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useId, useRef, useState } from "react"
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

export function TransactionSection() {
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

export function ApprovalSection({ nvidia }: { readonly nvidia: number }) {
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
