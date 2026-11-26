import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useAwaitingByAgent } from "../../../hooks/useAwaitingByAgent.ts"
import { hasSession } from "../../../lib/agentState.ts"
import { agentsAtAGlanceAtom } from "../atoms/agents.ts"
import { type ListedAgent, listedAgent } from "../model/agentList.ts"

/**
 * Each agent as a list reads it at `now`: its state with today's usage and last filled trade, read for those with a
 * session, and how many of its trades wait for you; settled once its usage and the approvals have loaded.
 */
export function useListedAgents(agents: ReadonlyArray<Agent>, now: Date): ReadonlyArray<ListedAgent> {
  const awaiting = useAwaitingByAgent()
  const reads = useAtomValue(agentsAtAGlanceAtom(agents.filter(hasSession).map((agent) => agent.id).join(" ")))
  const readOf = new Map(reads.map((read) => [read.id, read]))

  return agents.map((agent) => {
    const read = readOf.get(agent.id)
    const lastTrade = read === undefined ?
      null :
      AsyncResult.isSuccess(read.lastTrade) ?
      read.lastTrade.value.items[0] ?? null :
      undefined
    return listedAgent(agent, now, {
      ...(read !== undefined && AsyncResult.isSuccess(read.usage) ? { usage: read.usage.value } : {}),
      lastTradeAt: lastTrade === undefined || lastTrade === null ? lastTrade : DateTime.toDateUtc(lastTrade.updatedAt),
      awaiting: awaiting?.get(agent.id) ?? 0,
      settled: awaiting !== undefined && (read === undefined || !AsyncResult.isInitial(read.usage))
    })
  })
}
