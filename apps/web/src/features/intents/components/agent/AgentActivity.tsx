import type { Agent } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as Array from "effect/Array"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { agentIntentsAtom } from "../../atoms/intents.ts"
import { askedOn } from "../../model/intentText.ts"
import { ActivityRow } from "./ActivityRow.tsx"

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
      <IllustratedEmpty illustration="certificate" title="No trades yet">
        What {agent.name} is asked to do, and what its policies decide, shows up here.
      </IllustratedEmpty>
    )
  }

  // Each day's trades under its heading; a day split across pages keeps its heading on each.
  const days = Array.groupBy(items, (intent) => askedOn(intent, now))
  return (
    <>
      {Object.entries(days).map(([day, intents]) => (
        <section key={day} aria-label={day}>
          <h4 className="border-b border-g-100 bg-g-50/70 px-5 py-2 text-caption font-semibold tracking-[0.02em] text-g-500 uppercase">
            {day}
          </h4>
          <ul>
            {intents.map((intent) => (
              <ActivityRow
                key={intent.id}
                intent={intent}
                plannedWith={intent.batch === null ?
                  [] :
                  items.filter((other) => other.id !== intent.id && other.batch?.id === intent.batch!.id)}
                nameOf={nameOf}
              />
            ))}
          </ul>
        </section>
      ))}
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
    <section aria-labelledby={`activity-${agent.id}`} className="grid content-start gap-3">
      <div className="grid gap-0.5 px-0.5">
        <h3 id={`activity-${agent.id}`} className="text-[16px] font-semibold tracking-[-0.015em]">Activity</h3>
        <p className="text-label-sm text-g-500">
          Every trade it was asked for, what its policies decided, and how it ended.
        </p>
      </div>
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
