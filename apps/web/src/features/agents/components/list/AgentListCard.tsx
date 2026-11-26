import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { UsageBar } from "@bluechip/ui/bluechip/usage-meter"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import { AgentStatePill } from "../../../../components/AgentStatePill.tsx"
import { useNow } from "../../../../hooks/useNow.ts"
import { agentDot } from "../../../../lib/agentState.ts"
import { type Glance, glanceOf, tradesWord } from "../../model/agentGlance.ts"
import { type ListedAgent, stocksOf } from "../../model/agentList.ts"
import { toDollars } from "../../model/fieldText.ts"
import { dayGone } from "../../model/usage.ts"
import { RenewButton } from "../detail/RenewButton.tsx"

const SHOWN_STOCKS = 3

/** Today's budget as a meter with its words, or the line its state says. */
export function GlanceLine({ glance }: Readonly<{ glance: Glance }>) {
  const now = useNow(60_000)

  if (glance._tag === "line") {
    return (
      <span
        className={cn("truncate text-label-sm", glance.tone === "attention" ? "font-[550] text-blue" : "text-g-500")}
      >
        {glance.text}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-2.5">
      <UsageBar
        used={toDollars(glance.used)}
        limit={toDollars(glance.limit)}
        label="Spent today"
        valueText={glance.text}
        dayGone={dayGone(now)}
        className="h-1.5 flex-1"
      />
      <span className="shrink-0 text-label-sm text-g-500 tabular-nums">{glance.text}</span>
    </span>
  )
}

/**
 * One agent in the list, compact: its name and state, how it trades and which stocks, and the one thing worth knowing
 * now (today's budget, or what its state asks of you). The whole card opens the agent; one that ran out offers Renew.
 */
export function AgentListCard({ listed }: Readonly<{ listed: ListedAgent }>) {
  const { agent, state, settled } = listed
  const word = tradesWord(agent)
  const stocks = stocksOf(agent)
  const hidden = stocks.length - SHOWN_STOCKS

  // Renew sits outside the link: a button can't live inside one.
  return (
    <div className="grid content-start rounded-lg bg-white shadow-e2 transition-shadow duration-fast ease-brand has-[a:hover]:shadow-e3">
      <Link
        to="/agents/$agentId"
        params={{ agentId: agent.id }}
        className="grid gap-3 rounded-lg p-4 focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
      >
        <span className="flex items-center gap-3">
          <AgentAvatar agentId={agent.id} size="md" {...(settled ? { status: agentDot(state) } : {})} />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex items-center justify-between gap-2">
              <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{agent.name}</b>
              <AgentStatePill state={settled ? state : undefined} />
            </span>
            <span className="flex min-w-0 items-center gap-1 text-label-sm text-g-500">
              {word === null ? "Trades nothing yet" : <span className="mr-0.5 shrink-0">{word}</span>}
              {stocks.slice(0, SHOWN_STOCKS).map((symbol) => <TickerChip key={symbol} symbol={symbol} size="sm" />)}
              {hidden > 0 ? <span className="shrink-0 tabular-nums">+{hidden}</span> : null}
            </span>
          </span>
        </span>
        <GlanceLine glance={glanceOf(listed)} />
      </Link>
      {state === "expired" ?
        (
          <div className="-mt-1 px-4 pb-4">
            <RenewButton agent={agent} />
          </div>
        ) :
        null}
    </div>
  )
}
