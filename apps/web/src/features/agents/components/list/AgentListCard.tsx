import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { TickerChip } from "@bluechip/ui/bluechip/ticker-chip"
import { usageLevel } from "@bluechip/ui/bluechip/usage-meter"
import { cn } from "@bluechip/ui/lib/cn"
import { Link } from "@tanstack/react-router"
import { type Glance, glanceOf, tradesWord } from "../../model/agentGlance.ts"
import { type ListedAgent, stocksOf } from "../../model/agentList.ts"
import { agentDot } from "../../model/agentState.ts"
import { toDollars } from "../../model/fieldText.ts"
import { AgentStatePill } from "../AgentStatePill.tsx"
import { RenewButton } from "../detail/RenewButton.tsx"

const SHOWN_STOCKS = 3

const FILL = {
  normal: "bg-[linear-gradient(180deg,var(--color-blue-hi),var(--color-blue))]",
  near: "bg-[linear-gradient(180deg,#ffd84d,#f5b800)]",
  full: "bg-[linear-gradient(180deg,#ef5a3a,var(--color-loss))]"
} as const

function GlanceLine({ glance }: Readonly<{ glance: Glance }>) {
  if (glance._tag === "line") {
    return (
      <span
        className={cn("truncate text-label-sm", glance.tone === "attention" ? "font-[550] text-blue" : "text-g-500")}
      >
        {glance.text}
      </span>
    )
  }

  const [used, limit] = [toDollars(glance.used), toDollars(glance.limit)]
  const level = usageLevel(used, limit)
  return (
    <span className="flex items-center gap-2.5">
      <span
        // A native <meter> can't take the kit's gradient fill in every browser, so a span carries the meter role.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="meter"
        aria-label="Spent today"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-valuetext={glance.text}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-g-100"
      >
        <span
          className={cn("block h-full rounded-full transition-[width] duration-slow ease-brand", FILL[level])}
          style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
        />
      </span>
      <span className="shrink-0 text-label-sm text-g-500 tabular-nums">{glance.text}</span>
    </span>
  )
}

/**
 * One agent in the list, compact: its name and state, how it trades and which stocks, and the one thing worth knowing
 * now (today's budget, or what its state asks of you). The whole card opens the agent; one that ran out offers Renew.
 */
export function AgentListCard({ listed }: Readonly<{ listed: ListedAgent }>) {
  const { agent, state } = listed
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
          <AgentAvatar agentId={agent.id} size="md" status={agentDot(state)} />
          <span className="grid min-w-0 flex-1 gap-1">
            <span className="flex items-center justify-between gap-2">
              <b className="truncate text-[15px] font-semibold tracking-[-0.01em]">{agent.name}</b>
              <AgentStatePill state={state} />
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
