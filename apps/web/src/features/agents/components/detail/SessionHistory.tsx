import type { Agent, AgentSession, SessionAuthor, SessionStatus } from "@bluechip/domain/agents/Agent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { compareSpecs, policyOf, type SpecChanges } from "@bluechip/domain/policies/Catalog"
import { Button } from "@bluechip/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@bluechip/ui/components/collapsible"
import { SkeletonBlock } from "@bluechip/ui/components/skeleton"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { IllustratedEmpty } from "../../../../components/IllustratedEmpty.tsx"
import { agentSessionsAtom } from "../../atoms/agents.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { SpecChangeRows } from "../spec/SpecChangeRows.tsx"

const STATUS: Readonly<Record<SessionStatus, { readonly label: string; readonly tone: string }>> = {
  draft: { label: "Not locked", tone: "bg-g-100 text-g-600" },
  locking: { label: "Locking", tone: "bg-blue-50 text-blue" },
  active: { label: "In force", tone: "bg-gain-wash text-gain" },
  replaced: { label: "Replaced", tone: "bg-g-100 text-g-600" },
  revoked: { label: "Revoked", tone: "bg-g-100 text-g-600" },
  expired: { label: "Ran out", tone: "bg-warn-wash text-warn" },
  failed: { label: "Didn't land", tone: "bg-loss-wash text-loss" }
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
    <li className="grid gap-1.5 border-b border-g-100 px-[18px] py-3.5 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-semibold">{when(session)}</span>
        <span className={cn("rounded-full px-2 py-px text-[11.5px] font-semibold whitespace-nowrap", status.tone)}>
          {status.label}
        </span>
      </div>
      <p className="text-label-sm text-g-600">{changeLine(changes)}</p>
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
        <div aria-busy className="grid gap-3 p-[18px]">
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-10 w-full" />
        </div>
      )
    }
    if (!AsyncResult.isSuccess(sessions)) {
      return (
        <div className="grid justify-items-start gap-2 p-[18px]">
          <p className="text-body-sm text-g-600">We couldn't load its history. Check your connection and try again.</p>
          <Button variant="secondary" size="sm" onClick={refresh}>Try again</Button>
        </div>
      )
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
      <ul className="grid">
        {newestFirst.map(({ previous, session }) => (
          <SessionRow key={session.id} session={session} previous={previous} nameOf={nameOf} />
        ))}
      </ul>
    )
  }

  return (
    <section aria-labelledby={`history-${agent.id}`} className="grid content-start gap-2.5">
      <h3 id={`history-${agent.id}`} className="px-0.5 text-label-sm font-semibold text-g-500">History</h3>
      <div className="overflow-hidden rounded-lg bg-white shadow-e2">{body()}</div>
    </section>
  )
}
