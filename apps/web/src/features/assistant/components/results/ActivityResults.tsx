import type { ActivityItem } from "@bluechip/domain/activity/Activity"
import type { AgentId } from "@bluechip/domain/Ids"
import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { JournalEntry } from "@bluechip/domain/journal/Journal"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import { ChatResultRow, ChatResultRows } from "@bluechip/ui/bluechip/chat-result"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate, formatTime } from "@bluechip/ui/lib/format"
import { UsdcLogo } from "@bluechip/ui/logos/usdc"
import * as DateTime from "effect/DateTime"
import { activityAt, activityDetail, activityStatus, activityTitle } from "../../../../lib/activityText.ts"
import { INTENT_STATUS } from "../../../../lib/intentStatus.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { useAgentName } from "../../hooks/useAgentName.ts"
import { decisionFacts } from "../../model/decisionText.ts"
import type { ResultState } from "../../model/resultCards.ts"
import { RESULT_LOOK } from "../../model/resultText.ts"
import { LookedResult } from "./MoneyResults.tsx"
import { more, OpenLink } from "./OpenLink.tsx"

type NameOf = (symbol: StockSymbol) => string

const SHOWN = 5

const when = (at: DateTime.Utc) => formatDate(DateTime.toDateUtc(at), { timeZone: localTimeZone() })

/** Your latest trades and transfers, a few rows with their stocks, who traded and where each stands. */
export function ActivityResult(
  { items, state, nameOf }: Readonly<{ items: ReadonlyArray<ActivityItem>; state: ResultState; nameOf: NameOf }>
) {
  const agentName = useAgentName()
  const names = new Map(
    items.flatMap((item) => item._tag === "Trade" ? [[item.trade.symbol, nameOf(item.trade.symbol)] as const] : [])
  )
  const shown = items.slice(0, SHOWN)

  return (
    <LookedResult
      look={RESULT_LOOK.getActivity}
      state={state}
      action={<OpenLink label="See all" to="/activity" />}
      {...more(items.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((item) => {
          const status = activityStatus(item)
          return (
            <ChatResultRow
              key={item._tag === "Trade" ? item.trade.id : item.transfer.id}
              media={item._tag === "Trade" ?
                <TickerChip symbol={item.trade.symbol} size="sm" /> :
                <UsdcLogo size={22} />}
              title={activityTitle(item, names)}
              detail={item._tag === "Trade" ?
                `${agentName(item.trade.agentId)}, ${when(activityAt(item))}` :
                `${activityDetail(item)}, ${when(activityAt(item))}`}
              valueDetail={<StatusPill tone={status.tone}>{status.label}</StatusPill>}
            />
          )
        })}
      </ChatResultRows>
    </LookedResult>
  )
}

/** An agent's latest trades, each with its stock, why and where it stands. */
export function HistoryResult(
  { intents, agentId, state, nameOf }: Readonly<{
    intents: ReadonlyArray<Intent>
    agentId: AgentId | null
    state: ResultState
    nameOf: NameOf
  }>
) {
  const shown = intents.slice(0, SHOWN)
  return (
    <LookedResult
      look={RESULT_LOOK.getAgentHistory}
      state={state}
      {...(agentId === null ?
        {} :
        { action: <OpenLink label="See all" to="/agents/$agentId/history" params={{ agentId }} /> })}
      {...more(intents.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((intent) => (
          <ChatResultRow
            key={intent.id}
            media={<TickerChip symbol={intent.leg.symbol} size="sm" />}
            title={describeLeg(intent.leg, nameOf)}
            detail={intent.reason === "" ? when(intent.createdAt) : intent.reason}
            valueDetail={
              <StatusPill tone={INTENT_STATUS[intent.status].tone}>{INTENT_STATUS[intent.status].label}</StatusPill>
            }
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

/** An agent's journal, newest first: when, and what it did and why. */
export function JournalResult(
  { entries, agentId, state }: Readonly<{
    entries: ReadonlyArray<JournalEntry>
    agentId: AgentId | null
    state: ResultState
  }>
) {
  const shown = entries.slice(0, SHOWN)
  return (
    <LookedResult
      look={RESULT_LOOK.getAgentJournal}
      state={state}
      {...(agentId === null ?
        {} :
        { action: <OpenLink label="See all" to="/agents/$agentId/journal" params={{ agentId }} /> })}
      {...more(entries.length - shown.length)}
    >
      <ol className="grid gap-2">
        {shown.map((entry) => (
          <li key={entry.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 text-[13px] leading-normal">
            <span className="text-caption text-g-500 tabular-nums">
              {formatTime(DateTime.toDateUtc(entry.at), { timeZone: localTimeZone() })}
            </span>
            <span className="text-g-800">{entry.entry}</span>
          </li>
        ))}
      </ol>
    </LookedResult>
  )
}

/** Why a trade was blocked, waits or needs you: the trade, the policy and its limit, and what would go through. */
export function DecisionResult(
  { intent, explanation, nameOf }: Readonly<{ intent: Intent; explanation: string; nameOf: NameOf }>
) {
  const facts = intent.decision === null ? null : decisionFacts(intent.decision)
  return (
    <LookedResult
      look={RESULT_LOOK.explainDecision}
      state="ready"
      action={intent.agentId === null ?
        <OpenLink label="Activity" to="/activity" /> :
        <OpenLink label="Its trades" to="/agents/$agentId/history" params={{ agentId: intent.agentId }} />}
    >
      <div className="flex items-center gap-2.5">
        <TickerChip symbol={intent.leg.symbol} size="sm" />
        <b className="min-w-0 flex-1 truncate text-[14px] font-semibold">{describeLeg(intent.leg, nameOf)}</b>
        <StatusPill tone={INTENT_STATUS[intent.status].tone}>{INTENT_STATUS[intent.status].label}</StatusPill>
      </div>
      <p className="text-label text-g-700">{explanation}</p>
      {facts === null || (facts.policy === null && facts.limit === null && facts.wouldPass === null) ?
        null :
        (
          <dl className="grid gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] surface-well">
            {facts.policy === null ? null : (
              <div className="flex gap-2">
                <dt className="w-[84px] shrink-0 text-g-500">Policy</dt>
                <dd className="font-semibold">{facts.policy}</dd>
              </div>
            )}
            {facts.limit === null ? null : (
              <div className="flex gap-2">
                <dt className="w-[84px] shrink-0 text-g-500">Its limit</dt>
                <dd className="text-g-800">{facts.limit}</dd>
              </div>
            )}
            {facts.wouldPass === null ? null : (
              <div className="flex gap-2">
                <dt className="inline-flex w-[84px] shrink-0 items-start gap-1 text-g-500">
                  <Icon name="check" size={13} className="mt-[3px] text-gain" />Would pass
                </dt>
                <dd className="text-g-800">{facts.wouldPass}</dd>
              </div>
            )}
          </dl>
        )}
    </LookedResult>
  )
}
