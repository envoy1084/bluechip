import type { Agent, AgentUsage, PolicyUsage } from "@bluechip/domain/agents/Agent"
import type { AgentId } from "@bluechip/domain/Ids"
import type { StockSymbol } from "@bluechip/domain/market/Market"
import type { AgentPerformance } from "@bluechip/domain/performance/Performance"
import type { SpecDescription } from "@bluechip/domain/policies/Catalog"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { listNames } from "@bluechip/domain/policies/Format"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { ChatCardRules } from "@bluechip/ui/bluechip/chat-card"
import {
  ChatResultHeadline,
  ChatResultRow,
  ChatResultRows,
  ChatResultStat,
  ChatResultStats
} from "@bluechip/ui/bluechip/chat-result"
import { Sparkline } from "@bluechip/ui/bluechip/sparkline"
import { UsageRing } from "@bluechip/ui/bluechip/usage-ring"
import { formatChange, formatDate, formatMoney } from "@bluechip/ui/lib/format"
import * as DateTime from "effect/DateTime"
import { useNow } from "../../../../hooks/useNow.ts"
import { usdcDollars } from "../../../../lib/amounts.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { agentGlance } from "../../model/agentGlance.ts"
import type { ResultState } from "../../model/resultCards.ts"
import { agentDot, agentStanding, resetText, RESULT_LOOK } from "../../model/resultText.ts"
import { SpecGlance } from "../cards/SpecGlance.tsx"
import { LookedResult } from "./MoneyResults.tsx"
import { more, OpenLink } from "./OpenLink.tsx"

type NameOf = (symbol: StockSymbol) => string

const stocksOf = (agent: Agent) => agentGlance(agent.spec).stocks

/** One agent: its butterfly and where it stands, its limits at a glance and what it can and never does. */
export function AgentResult(
  { agent, description }: Readonly<{ agent: Agent; description: SpecDescription }>
) {
  const until = agent.lockedUntil === null ?
    "Not locked yet" :
    `Locked until ${formatDate(DateTime.toDateUtc(agent.lockedUntil), { timeZone: localTimeZone(), time: false })}`

  return (
    <LookedResult
      look={{ ...RESULT_LOOK.getAgent, title: agent.name }}
      state="ready"
      action={<OpenLink to="/agents/$agentId" params={{ agentId: agent.id }} />}
    >
      <div className="flex items-center gap-2.5">
        <AgentAvatar agentId={agent.id} status={agentDot(agent)} />
        <span className="grid min-w-0 gap-px">
          <b className="truncate text-[14.5px] font-semibold">{agent.name}</b>
          <span className="text-label-sm text-g-500">{`${agentStanding(agent)}. ${until}.`}</span>
        </span>
      </div>
      <SpecGlance spec={agent.spec} />
      <ChatCardRules can={description.can.slice(0, 3)} never={description.never.slice(0, 2)} />
    </LookedResult>
  )
}

/** Your agents as mini rows: butterfly, name, where it stands and what it trades. */
export function AgentsResult(
  { agents, state, nameOf }: Readonly<{ agents: ReadonlyArray<Agent>; state: ResultState; nameOf: NameOf }>
) {
  const shown = agents.slice(0, 5)
  return (
    <LookedResult
      look={RESULT_LOOK.listAgents}
      state={state}
      action={<OpenLink label="See all" to="/agents" />}
      {...more(agents.length - shown.length)}
    >
      <ChatResultRows>
        {shown.map((agent) => (
          <ChatResultRow
            key={agent.id}
            media={<AgentAvatar agentId={agent.id} size="sm" status={agentDot(agent)} />}
            title={agent.name}
            detail={stocksOf(agent).length === 0 ?
              agentStanding(agent) :
              `${agentStanding(agent)}, trades ${listNames(stocksOf(agent).map(nameOf))}`}
            value={<OpenLink label="Open" to="/agents/$agentId" params={{ agentId: agent.id }} />}
          />
        ))}
      </ChatResultRows>
    </LookedResult>
  )
}

const RING_LABEL: Readonly<Partial<Record<PolicyUsage["policy"], string>>> = {
  trade: "Spent today",
  tradesPerDay: "Trades today",
  slippageBudget: "Lost to prices"
}

const amount = (usage: PolicyUsage) => (value: number) =>
  usage.unit === "usd" ? formatMoney(value).replace(/\.00$/u, "") : String(value)

const asNumber = (usage: PolicyUsage, value: bigint) => usage.unit === "usd" ? usdcDollars(value) : Number(value)

/** What an agent has used of its limits today, as small rings, and when they start again. Gas is bluechip's to watch. */
export function UsageResult(
  { usage, agentId, state }: Readonly<{ usage: AgentUsage; agentId: AgentId | null; state: ResultState }>
) {
  const now = useNow(60_000)
  const rings = usage.policies.filter((policy) => policy.policy !== "gasBudget").slice(0, 3)

  return (
    <LookedResult
      look={RESULT_LOOK.getAgentUsage}
      state={state}
      {...(agentId === null ? {} : { action: <OpenLink to="/agents/$agentId/usage" params={{ agentId }} /> })}
    >
      <div className="flex flex-wrap justify-around gap-3">
        {rings.map((policy) => (
          <UsageRing
            key={policy.policy}
            size="sm"
            label={RING_LABEL[policy.policy] ?? policyOf(policy.policy).title}
            used={asNumber(policy, policy.used)}
            limit={policy.limit === null ? null : asNumber(policy, policy.limit)}
            format={amount(policy)}
            detail={policy.limit === null ?
              "No limit" :
              `of ${amount(policy)(asNumber(policy, policy.limit))}`}
          />
        ))}
      </div>
      <p className="text-label-sm text-g-500">{resetText(now)}</p>
    </LookedResult>
  )
}

/** What one agent contributed: its profit with the shape of it, what it bought and sold, and what its policies stopped. */
export function AgentPerformanceResult(
  { performance, state }: Readonly<{ performance: AgentPerformance; state: ResultState }>
) {
  const total = performance.realised + performance.unrealised
  const losing = total < BigInt(0)
  const series = performance.series.map((point) => usdcDollars(point.total))
  const blockedBy = performance.blockedBy.map((row) => `${policyOf(row.policy).title} ${row.count}`)

  return (
    <LookedResult
      look={RESULT_LOOK.getAgentPerformance}
      state={state}
      action={<OpenLink to="/agents/$agentId/results" params={{ agentId: performance.agentId }} />}
    >
      <ChatResultHeadline
        value={<span className={losing ? "text-loss" : "text-gain"}>{formatChange(usdcDollars(total))}</span>}
        detail={`In all, over ${performance.trades} ${performance.trades === 1 ? "trade" : "trades"}`}
        aside={series.length < 2 ?
          undefined :
          <Sparkline values={series} width={88} height={28} tone={losing ? "down" : "up"} area />}
      />
      <ChatResultStats>
        <ChatResultStat label="Bought" value={formatMoney(usdcDollars(performance.bought))} />
        <ChatResultStat label="Sold" value={formatMoney(usdcDollars(performance.sold))} />
        <ChatResultStat label="Blocked" value={`${performance.blocked} of ${performance.decided}`} />
      </ChatResultStats>
      {blockedBy.length === 0 ?
        null :
        <p className="text-label-sm text-g-500">{`Its policies blocked it: ${blockedBy.join(", ")}.`}</p>}
    </LookedResult>
  )
}
