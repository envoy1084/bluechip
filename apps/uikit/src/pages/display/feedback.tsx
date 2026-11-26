import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Card, CardDescription } from "@bluechip/ui/components/card"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@bluechip/ui/components/empty"
import { Label } from "@bluechip/ui/components/label"
import { Progress, ProgressRing } from "@bluechip/ui/components/progress"
import { Skeleton } from "@bluechip/ui/components/skeleton"
import { Switch } from "@bluechip/ui/components/switch"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatMoney } from "@bluechip/ui/lib/format"
import { type ReactNode, useId, useState } from "react"
import { HOLDINGS, stock } from "./data.ts"
import { Caption, Demo, LimitList, Section, Ticker } from "./layout.tsx"

export function AlertSection() {
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

export function ProgressSection() {
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

export function SkeletonSection() {
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
                    Portfolio
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

export function EmptySection() {
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
            <EmptyDescription>When an agent needs your approval, it'll wait here.</EmptyDescription>
          </Empty>
        </div>
      </div>
    </Section>
  )
}
