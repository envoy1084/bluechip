import { describeLeg } from "@bluechip/domain/intents/Describe"
import type { Intent } from "@bluechip/domain/intents/Intent"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { Portfolio } from "@bluechip/domain/portfolio/Portfolio"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { ChatCardNote } from "@bluechip/ui/bluechip/chat-card"
import { ChatResult, ChatResultHeadline, ChatResultRow, ChatResultRows } from "@bluechip/ui/bluechip/chat-result"
import { MixCompare } from "@bluechip/ui/bluechip/mix-bar"
import { PriceChange } from "@bluechip/ui/bluechip/price-change"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatMoney } from "@bluechip/ui/lib/format"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { useAgentName } from "../../hooks/useAgentName.ts"
import { actorLine, type DailyBrief, isQuietDay } from "../../model/dailyBrief.ts"
import { mixShifts } from "../../model/rebalancePlan.ts"
import type { ResultState } from "../../model/resultCards.ts"
import { INTENT_STATUS, RESULT_LOOK } from "../../model/resultText.ts"
import { LookedResult } from "./MoneyResults.tsx"
import { OpenLink } from "./OpenLink.tsx"

type NameOf = (symbol: StockSymbol) => string

function Pill({ intent }: Readonly<{ intent: Intent }>) {
  const status = INTENT_STATUS[intent.status]
  return (
    <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap", status.tone)}>
      {status.label}
    </span>
  )
}

/**
 * "How was my day?": what your money is worth and how it moved, what each agent (and you) traded, and the trades
 * waiting for you. A day with none says it was quiet.
 */
export function BriefResult({ brief, nameOf }: Readonly<{ brief: DailyBrief; nameOf: NameOf }>) {
  const agentName = useAgentName()

  return (
    <ChatResult
      title="Your day"
      icon="sun"
      action={<OpenLink label="Activity" to="/activity" />}
      {...(brief.waiting.length === 0 ? {} : { footer: <OpenLink label="Review approvals" to="/approvals" /> })}
    >
      <ChatResultHeadline
        value={formatMoney(usdcDollars(brief.value))}
        change={<PriceChange size="sm" value={brief.changePercent} amount={usdcDollars(brief.change)} />}
        detail="Since the previous close"
      />
      {isQuietDay(brief) ?
        <p className="text-label text-g-500">A quiet day: nothing traded, and nothing waits for you.</p> :
        (
          <ChatResultRows aria-label="What happened">
            {brief.actors.map((actor) => (
              <ChatResultRow
                key={actor.agentId ?? "you"}
                media={actor.agentId === null ?
                  <Icon name="user" size={16} className="mx-[5px] text-g-500" /> :
                  <AgentAvatar agentId={actor.agentId} size="sm" />}
                title={agentName(actor.agentId)}
                detail={actorLine(actor)}
              />
            ))}
            {brief.transfers === 0 ? null : (
              <ChatResultRow
                media={<Icon name="cash" size={16} className="mx-[5px] text-g-500" />}
                title="Cash"
                detail={`${brief.transfers} ${
                  brief.transfers === 1 ? "deposit or withdrawal" : "deposits and withdrawals"
                }`}
              />
            )}
            {brief.waiting.map((intent) => (
              <ChatResultRow
                key={intent.id}
                media={<TickerChip symbol={intent.leg.symbol} size="sm" />}
                title={describeLeg(intent.leg, nameOf)}
                detail={`${agentName(intent.agentId)} asked, waiting for your Face ID`}
                valueDetail={<Pill intent={intent} />}
              />
            ))}
          </ChatResultRows>
        )}
    </ChatResult>
  )
}

/**
 * A rebalance as one plan: its trades with where each stands as proposed, and the mix now and after them when the turn
 * read the portfolio. Each trade follows live in its own card under this one.
 */
export function RebalanceResult(
  { legs, portfolio, state, nameOf }: Readonly<{
    legs: ReadonlyArray<Intent>
    portfolio: Portfolio | null
    state: ResultState
    nameOf: NameOf
  }>
) {
  const agentName = useAgentName()
  const agentId = legs[0]?.agentId ?? null
  const shifts = portfolio === null ? null : mixShifts(portfolio, legs)

  return (
    <LookedResult
      look={RESULT_LOOK.proposeRebalance}
      state={state}
      {...(agentId === null ? {} : { action: <OpenLink to="/agents/$agentId" params={{ agentId }} /> })}
    >
      <p className="text-label-sm text-g-500">
        {`${agentName(agentId)}'s plan, ${legs.length} ${legs.length === 1 ? "trade" : "trades"} back to its mix`}
      </p>
      <ChatResultRows aria-label="Its trades">
        {legs.map((intent) => (
          <ChatResultRow
            key={intent.id}
            media={<TickerChip symbol={intent.leg.symbol} size="sm" />}
            title={describeLeg(intent.leg, nameOf)}
            {...(intent.batch === null ? {} : { detail: `Sent in step ${intent.batch.wave + 1}` })}
            valueDetail={<Pill intent={intent} />}
          />
        ))}
      </ChatResultRows>
      {shifts === null ? null : (
        <MixCompare
          changes={shifts.map((shift) => ({
            id: shift.id,
            label: shift.id === "cash" ? "Cash" : nameOf(shift.id),
            before: shift.before,
            after: shift.after
          }))}
        />
      )}
      <ChatCardNote icon="shield">Each trade is decided by its policies, in its own card below.</ChatCardNote>
    </LookedResult>
  )
}
