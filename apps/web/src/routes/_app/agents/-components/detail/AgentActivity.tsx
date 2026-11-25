import type { Agent } from "@bluechip/domain/agents/Agent"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ActivityItem, type ActivityKind } from "@bluechip/ui/bluechip/activity-item"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentIntentsAtom } from "../../../../../atoms/intents.ts"
import { DecisionLine } from "../../../../../intents/DecisionLine.tsx"
import { askedAt, nothingMoved, STATUS } from "../../../../../intents/intentText.ts"
import { useLatestIntent } from "../../../../../intents/useLatestIntent.ts"
import { CancelIntentButton } from "./CancelIntentButton.tsx"

const kindOf = (intent: Intent): ActivityKind => {
  if (intent.status === "blocked" || intent.status === "failed") return "blocked"
  if (intent.status === "needsApproval" || intent.status === "awaitingSignature") return "approval"
  return "trade"
}

/** One trade the agent was asked for: the trade in words, where it stands, and what its policies decided. */
function IntentRow(
  { intent: listed, now, nameOf }: Readonly<{ intent: Intent; now: Date; nameOf: (symbol: StockSymbol) => string }>
) {
  const intent = useLatestIntent(listed)
  const status = STATUS[intent.status]
  const trade = describeLeg(intent.leg, nameOf)
  const stopped = intent.status === "blocked" || intent.status === "failed" || intent.status === "declined" ||
    intent.status === "expired" || intent.status === "cancelled"

  const actions = intent.status === "waiting" || intent.status === "proposed" ?
    <CancelIntentButton intent={intent} /> :
    intent.status === "needsApproval" || intent.status === "awaitingSignature" ?
    (
      <Button size="sm" nativeButton={false} render={<Link to="/approvals" />}>
        <Icon name="face-id" size={14} />Review and approve
      </Button>
    ) :
    undefined

  return (
    <ActivityItem
      kind={kindOf(intent)}
      icon={intent.leg.side === "buy" ? "arrow-down-right" : "arrow-up-right"}
      title={intent.status === "blocked" ? `${trade}, blocked` : trade}
      time={askedAt(intent, now)}
      {...(actions === undefined ? {} : { actions })}
    >
      <span className="mt-0.5 grid gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", status.tone)}>
            {status.label}
          </span>
          {intent.reason === "" ? null : <span className="text-label-sm text-g-500">{intent.reason}</span>}
        </span>
        {intent.decision === null ? null : <DecisionLine decision={intent.decision} />}
        {stopped ? <span className="text-label-sm text-g-600">{nothingMoved(intent.leg.side)}</span> : null}
      </span>
    </ActivityItem>
  )
}

/** One page of the agent's intents; the last one loaded offers the next. */
function IntentPage(
  { agent, pageToken, last, now, nameOf, onMore }: Readonly<{
    agent: Agent
    pageToken: string
    last: boolean
    now: Date
    nameOf: (symbol: StockSymbol) => string
    onMore: (pageToken: string) => void
  }>
) {
  const page = useAtomValue(agentIntentsAtom(`${agent.id} ${pageToken}`))
  const refresh = useAtomRefresh(agentIntentsAtom(`${agent.id} ${pageToken}`))

  if (AsyncResult.isInitial(page)) {
    return (
      <div aria-busy className="grid gap-3 p-[18px]">
        <SkeletonBlock className="h-10 w-full" />
        <SkeletonBlock className="h-10 w-full" />
      </div>
    )
  }
  if (!AsyncResult.isSuccess(page)) {
    return (
      <div className="grid justify-items-center gap-2.5 p-[18px] text-center">
        <p className="text-body-sm text-g-600">We couldn't load its trades. Check your connection and try again.</p>
        <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }

  const { items, nextPageToken } = page.value
  if (pageToken === "" && items.length === 0) {
    return (
      <p className="p-[18px] text-body-sm text-g-600">
        No trades yet. What {agent.name} is asked to do, and what its policies decide, shows up here.
      </p>
    )
  }

  return (
    <>
      <ul>
        {items.map((intent) => <IntentRow key={intent.id} intent={intent} now={now} nameOf={nameOf} />)}
      </ul>
      {last && nextPageToken !== null ?
        (
          <div className="grid border-t border-g-100 p-2.5">
            <Button variant="ghost" size="sm" onClick={() => onMore(nextPageToken)}>Show older trades</Button>
          </div>
        ) :
        null}
    </>
  )
}

/** The agent's trades, newest first, page by page: each with where it stands and what its policies decided. */
export function AgentActivity(
  { agent, nameOf }: Readonly<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>
) {
  const [pageTokens, setPageTokens] = useState<ReadonlyArray<string>>([""])
  const [now] = useState(() => new Date())

  return (
    <section aria-labelledby={`activity-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`activity-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">Activity</h3>
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        {pageTokens.map((pageToken, index) => (
          <IntentPage
            key={pageToken}
            agent={agent}
            pageToken={pageToken}
            last={index === pageTokens.length - 1}
            now={now}
            nameOf={nameOf}
            onMore={(next) => setPageTokens((tokens) => [...tokens, next])}
          />
        ))}
      </div>
    </section>
  )
}
