import type { Agent, AgentSession, SessionAuthor, SessionStatus } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { compareSpecs, policyOf, type SpecChanges } from "@bluechip/domain/policies/Catalog"
import { configOf } from "@bluechip/domain/policies/Policy"
import { trade } from "@bluechip/domain/policies/Trade"
import { StatusPill, type StatusTone } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { SectionHeader } from "../../../../components/layout/SectionHeader.tsx"
import { LoadProblem } from "../../../../components/LoadProblem.tsx"
import { agentSessionsAtom } from "../../atoms/agents.ts"
import { limitsLine } from "../../model/agentGlance.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { SpecChangeRows } from "../spec/SpecChangeRows.tsx"

const STATUS: Readonly<Record<SessionStatus, { readonly label: string; readonly tone: StatusTone }>> = {
  draft: { label: "Not locked yet", tone: "neutral" },
  locking: { label: "On its way", tone: "pending" },
  active: { label: "In force", tone: "positive" },
  replaced: { label: "Replaced", tone: "neutral" },
  revoked: { label: "Revoked", tone: "neutral" },
  expired: { label: "Ran out", tone: "neutral" },
  failed: { label: "Didn't land", tone: "negative" }
}

const AUTHOR: Readonly<Record<SessionAuthor, string>> = {
  owner: "by you",
  assistant: "asked by the assistant, signed by you",
  automation: "asked by an automation, signed by you"
}

/** "Locked 24 Aug by you, until 22 Nov", from what the session records. */
const when = (session: AgentSession): string => {
  const start = session.installedAt === null ?
    `Asked ${dayLabel(session.createdAt)}` :
    `Locked ${dayLabel(session.installedAt)}`
  const end = session.endedAt !== null ?
    `, ended ${dayLabel(session.endedAt)}` :
    session.validUntil !== null && session.status === "active" ?
    `, until ${dayLabel(session.validUntil)}` :
    ""
  return `${start} ${AUTHOR[session.createdBy]}${end}`
}

/** What a session changed, in a line: its first rules, a renewal, or each policy that moved. */
const changeLine = (changes: SpecChanges | null): string => {
  if (changes === null) return "Its first rules."
  const moved = changes.policies.filter((change) => !policyOf(change.policy).hidden)
  if (moved.length === 0) return "The same rules, renewed."
  return `${
    moved.map(({ policy, change }) => {
      const verb = change === "added" ? "added" : change === "removed" ? "removed" : change
      return `${policyOf(policy).title} ${verb}`
    }).join(", ")
  }.`
}

// The dot on the timeline for a session: the one in force green, one on its way blue, the rest grey.
const DOT: Readonly<Record<SessionStatus, string>> = {
  draft: "bg-g-300",
  locking: "bg-blue",
  active: "bg-gain shadow-[0_0_0_4px_var(--color-gain-wash)]",
  replaced: "bg-g-300",
  revoked: "bg-g-300",
  expired: "bg-warn",
  failed: "bg-loss"
}

/** Its stocks and the limits most people look for: "$100 a day, $100 a trade, 12 trades a day". */
function Rules({ spec, nameOf }: Readonly<{ spec: AgentSession["spec"]; nameOf: (symbol: StockSymbol) => string }>) {
  const traded = configOf(spec.policies, trade)
  const limits = limitsLine(spec)

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(traded?.stocks ?? []).map((symbol) => (
        <span key={symbol} title={nameOf(symbol)} className="inline-flex">
          <TickerChip symbol={symbol} size="sm" />
        </span>
      ))}
      {limits === null ? null : <span className="ml-1 text-label-sm text-g-600">{limits}</span>}
    </div>
  )
}

function SessionRow(
  { session, previous, nameOf }: Readonly<{
    session: AgentSession
    previous: AgentSession | undefined
    nameOf: (symbol: StockSymbol) => string
  }>
) {
  const changes = previous === undefined ? null : compareSpecs(previous.spec, session.spec)
  const detailed = previous !== undefined && changes !== null &&
    changes.policies.some((change) => !policyOf(change.policy).hidden)
  const status = STATUS[session.status]

  return (
    <li className="group/session relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      <span aria-hidden className="absolute top-5 bottom-0 left-[9px] w-px bg-g-200 group-last/session:hidden" />
      <span aria-hidden className={cn("relative mt-[7px] ml-[5px] size-2.5 rounded-full", DOT[session.status])} />
      <div className="grid gap-2.5 rounded-lg bg-white p-4 shadow-e2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-0.5">
            <span className="text-[14px] font-semibold tracking-[-0.01em]">{when(session)}</span>
            <p className="text-label-sm text-g-500">{changeLine(changes)}</p>
          </div>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
        <Rules spec={session.spec} nameOf={nameOf} />
        {detailed ?
          (
            <Collapsible>
              <CollapsibleTrigger className="group/chg inline-flex cursor-pointer items-center gap-1 text-label-sm font-semibold text-blue">
                What changed
                <Icon
                  name="chevron-down"
                  size={14}
                  className="transition-transform group-data-panel-open/chg:rotate-180"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_var(--color-g-100)]">
                  <SpecChangeRows before={previous.spec} after={session.spec} changes={changes} nameOf={nameOf} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) :
          null}
      </div>
    </li>
  )
}

/**
 * Every set of rules locked for the agent, newest first: when and by whom, whether it's in force, and what it changed
 * from the one before.
 */
export function SessionHistory(
  { agent, nameOf }: Readonly<{ agent: Agent; nameOf: (symbol: StockSymbol) => string }>
) {
  const sessions = useAtomValue(agentSessionsAtom(agent.id))
  const refresh = useAtomRefresh(agentSessionsAtom(agent.id))

  const body = () => {
    if (AsyncResult.isInitial(sessions)) {
      return (
        <div aria-busy className="grid gap-3 rounded-lg bg-white p-[18px] shadow-e2">
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      )
    }
    if (!AsyncResult.isSuccess(sessions)) {
      return <LoadProblem what="its history" onRetry={refresh} variant="card" size="sm" />
    }
    if (sessions.value.length === 0) {
      return (
        <IllustratedEmpty illustration="calendar" title="Nothing locked yet">
          Its history starts with its first lock.
        </IllustratedEmpty>
      )
    }

    const oldestFirst = sessions.value.toSorted((a, b) =>
      DateTime.toEpochMillis(a.createdAt) - DateTime.toEpochMillis(b.createdAt)
    )
    // Each session is compared with the last one that was locked before it; one that never landed changed nothing.
    const previousOf = (index: number) =>
      oldestFirst.slice(0, index).findLast((session) => session.installedAt !== null)

    const newestFirst = oldestFirst.map((session, index) => ({ session, previous: previousOf(index) })).toReversed()

    return (
      <ol className="grid">
        {newestFirst.map(({ previous, session }) => (
          <SessionRow key={session.id} session={session} previous={previous} nameOf={nameOf} />
        ))}
      </ol>
    )
  }

  return (
    <section aria-labelledby={`history-${agent.id}`} className="grid content-start gap-3">
      <SectionHeader
        id={`history-${agent.id}`}
        level="h3"
        title="Its rules over time"
        description="Each time its rules were locked with Face ID, newest first."
      />
      {body()}
    </section>
  )
}
