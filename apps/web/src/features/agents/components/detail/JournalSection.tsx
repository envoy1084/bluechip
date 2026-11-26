import type { Agent } from "@bluechip/domain/agents/Agent"
import type { JournalEntry, JournalKind } from "@bluechip/domain/journal/Journal"
import { ActivityItem } from "@bluechip/ui/bluechip/activity-item"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import type { IconName } from "@bluechip/ui/icons/icon"
import { formatRelative } from "@bluechip/ui/lib/format"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { agentJournalAtom } from "../../atoms/agents.ts"

const KIND: Readonly<Record<JournalKind, { readonly label: string; readonly icon: IconName }>> = {
  intent: { label: "Trade", icon: "activity" },
  automation: { label: "Automation", icon: "zap" },
  judgment: { label: "Judgment", icon: "scales" }
}

function JournalRow({ entry, now }: Readonly<{ entry: JournalEntry; now: Date }>) {
  const kind = KIND[entry.kind]
  return (
    <ActivityItem
      kind="system"
      icon={kind.icon}
      title={entry.entry}
      time={formatRelative(DateTime.toDateUtc(entry.at), now, { timeZone: localTimeZone() })}
    >
      <span className="mt-0.5 text-label-sm text-g-500">{kind.label}</span>
    </ActivityItem>
  )
}

/** One page of the journal; the last one loaded offers the next. */
function JournalPage(
  { agent, pageToken, last, now, onMore }: Readonly<{
    agent: Agent
    pageToken: string
    last: boolean
    now: Date
    onMore: (pageToken: string) => void
  }>
) {
  const page = useAtomValue(agentJournalAtom(`${agent.id} ${pageToken}`))
  const refresh = useAtomRefresh(agentJournalAtom(`${agent.id} ${pageToken}`))

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
        <p className="text-body-sm text-g-600">We couldn't load its journal. Check your connection and try again.</p>
        <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
      </div>
    )
  }

  const { items, nextPageToken } = page.value
  if (pageToken === "" && items.length === 0) {
    return (
      <p className="p-[18px] text-body-sm text-g-600">
        Nothing yet. What {agent.name}{" "}
        does and why, its automations' runs and the judgments they ask for, are written here as they happen.
      </p>
    )
  }

  return (
    <>
      <ul>{items.map((entry) => <JournalRow key={entry.id} entry={entry} now={now} />)}</ul>
      {last && nextPageToken !== null ?
        (
          <div className="grid border-t border-g-100 p-2.5">
            <Button variant="ghost" size="sm" onClick={() => onMore(nextPageToken)}>Show older entries</Button>
          </div>
        ) :
        null}
    </>
  )
}

/** The agent's journal: what it did and why, in bluechip's words, newest first, page by page. */
export function JournalSection({ agent }: Readonly<{ agent: Agent }>) {
  const [pageTokens, setPageTokens] = useState<ReadonlyArray<string>>([""])
  const [now] = useState(() => new Date())

  return (
    <section aria-labelledby={`journal-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`journal-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">Journal</h3>
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">
        {pageTokens.map((pageToken, index) => (
          <JournalPage
            key={pageToken}
            agent={agent}
            pageToken={pageToken}
            last={index === pageTokens.length - 1}
            now={now}
            onMore={(next) => setPageTokens((tokens) => [...tokens, next])}
          />
        ))}
      </div>
    </section>
  )
}
