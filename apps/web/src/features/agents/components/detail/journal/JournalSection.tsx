import type { Agent } from "@bluechip/domain/agents/Agent"
import { Button } from "@bluechip/ui/components/button"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as Array from "effect/Array"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { FilterTabs } from "../../../../../components/FilterTabs.tsx"
import { IllustratedEmpty } from "../../../../../components/IllustratedEmpty.tsx"
import { SectionHeader } from "../../../../../components/layout/SectionHeader.tsx"
import { LoadProblem } from "../../../../../components/LoadProblem.tsx"
import { dayHeading } from "../../../../../lib/localTime.ts"
import {
  agentAutomationsAtom,
  agentJournalAtom,
  agentJournalPagesAtom,
  agentSessionsAtom
} from "../../../atoms/agents.ts"
import { EMPTY_FILTER } from "../../../model/journalText.ts"
import {
  filterOf,
  JOURNAL_FILTERS,
  type JournalFilter,
  journalLines,
  rulesMoments
} from "../../../model/journalTimeline.ts"
import { useAgentPage } from "../AgentPageContext.ts"
import { type AutomationTrigger, JournalLineRow } from "./JournalLines.tsx"

function Loading() {
  return (
    <div aria-busy className="grid gap-3 p-[18px]">
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="h-12 w-full" />
      <SkeletonBlock className="h-12 w-full" />
    </div>
  )
}

/** A page that didn't load, with a way to ask again. */
function PageProblem({ pageKey, what }: Readonly<{ pageKey: string; what: string }>) {
  const refresh = useAtomRefresh(agentJournalAtom(pageKey))
  return <LoadProblem what={what} onRetry={refresh} size="sm" />
}

/**
 * The agent's journal as a story, newest first, by day: its trades with their moments, its automations' runs and
 * judgments, and each time its rules changed, each with why; filtered by kind, older entries page by page.
 */
export function JournalSection({ agent }: Readonly<{ agent: Agent }>) {
  const { nameOf } = useAgentPage()
  const [pageTokens, setPageTokens] = useState<ReadonlyArray<string>>([""])
  const [filter, setFilter] = useState<JournalFilter>("all")
  const [now] = useState(() => new Date())

  const pages = useAtomValue(agentJournalPagesAtom(`${agent.id} ${pageTokens.join(" ")}`))
  const sessions = useAtomValue(agentSessionsAtom(agent.id))
  const refreshSessions = useAtomRefresh(agentSessionsAtom(agent.id))
  const automations = useAtomValue(agentAutomationsAtom(agent.id))

  const loadedCount = pages.findIndex((page) => !AsyncResult.isSuccess(page))
  const loaded = (loadedCount === -1 ? pages : pages.slice(0, loadedCount)).flatMap((page) =>
    AsyncResult.isSuccess(page) ? [page.value] : []
  )
  const pending = loadedCount === -1 ? undefined : pages[loadedCount]
  const nextPageToken = pending === undefined ? (loaded.at(-1)?.nextPageToken ?? null) : null
  const complete = pending === undefined && nextPageToken === null

  const lines = journalLines(
    loaded.flatMap((page) => page.items),
    AsyncResult.isSuccess(sessions) ? rulesMoments(sessions.value) : [],
    { complete, nameOf }
  )
  const shown = filter === "all" ? lines : lines.filter((line) => filterOf(line) === filter)
  // Runs say what set them off once their automations load; until then (or if they don't) they lead with a bolt.
  const triggers = new Map<string, AutomationTrigger>(
    AsyncResult.isSuccess(automations) ?
      automations.value.map((automation) => [
        automation.id,
        { type: automation.trigger.type, when: automation.description.trigger }
      ]) :
      []
  )
  // Each day's lines under its heading, in the order they came.
  const days = Array.groupBy(shown, (line) => dayHeading(line.at, now))

  const body = () => {
    if (loaded.length === 0 && pending !== undefined) {
      return AsyncResult.isInitial(pending) ?
        <Loading /> :
        <PageProblem pageKey={`${agent.id} ${pageTokens[0]}`} what="its journal" />
    }
    if (complete && lines.length === 0) {
      return (
        <IllustratedEmpty illustration="notebook" title="Nothing written yet">
          What {agent.name}{" "}
          does and why, its automations' runs and each change to its rules are written here as they happen.
        </IllustratedEmpty>
      )
    }

    return (
      <>
        {shown.length === 0 && filter !== "all" ?
          (
            <IllustratedEmpty illustration="notebook" variant="plain" compact title={EMPTY_FILTER[filter].title}>
              {EMPTY_FILTER[filter].description}
            </IllustratedEmpty>
          ) :
          null}
        {Object.entries(days).map(([day, dayLines]) => (
          <section key={day} aria-label={day}>
            <h4 className="border-b border-g-100 bg-g-50/70 px-5 py-2 text-caption font-semibold tracking-[0.02em] text-g-500 uppercase">
              {day}
            </h4>
            <ul>
              {dayLines.map((line) => (
                <JournalLineRow
                  key={line.id}
                  line={line}
                  agentId={agent.id}
                  nameOf={nameOf}
                  triggerOf={(id) => triggers.get(id)}
                />
              ))}
            </ul>
          </section>
        ))}
        {pending === undefined ?
          null :
          AsyncResult.isInitial(pending) ?
          <Loading /> :
          <PageProblem pageKey={`${agent.id} ${pageTokens[loadedCount]}`} what="its older entries" />}
        {nextPageToken === null ?
          null :
          (
            <div className="grid border-t border-g-100 p-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPageTokens((tokens) => [...tokens, nextPageToken])}
              >
                Show older entries
              </Button>
            </div>
          )}
      </>
    )
  }

  return (
    <section aria-labelledby={`journal-${agent.id}`} className="grid content-start gap-3">
      <SectionHeader
        id={`journal-${agent.id}`}
        level="h3"
        title="Journal"
        description="What it did and why, in bluechip's words, as it happened."
        actions={
          <FilterTabs
            label="Show"
            value={filter}
            onChange={setFilter}
            options={JOURNAL_FILTERS.map((option) => ({
              ...option,
              ...(option.value === "all"
                ? {}
                : { count: lines.filter((line) => filterOf(line) === option.value).length })
            }))}
          />
        }
      />

      {AsyncResult.isFailure(sessions) && (filter === "all" || filter === "rules") ?
        <LoadProblem what="the changes to its rules" onRetry={refreshSessions} /> :
        null}

      <div className="overflow-hidden rounded-lg bg-white shadow-e2">{body()}</div>
    </section>
  )
}
