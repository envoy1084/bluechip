import type { Agent, AgentUsage } from "@bluechip/domain/agents/Agent"
import type { AgentState } from "@bluechip/ui/bluechip/agent-status"
import { useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { agentUsageAtom } from "../atoms/agents.ts"
import { agentState, hasSession } from "../lib/agentState.ts"
import { useAwaitingByAgent } from "./useAwaitingByAgent.ts"
import { useNow } from "./useNow.ts"

// Drafts and ended agents have no session to read usage from.
const noUsageAtom = Atom.make(AsyncResult.initial<AgentUsage, unknown>())

/**
 * An agent's state, the one every pill and dot shows: its status, today's usage and its trades waiting for you.
 * `undefined` until what it depends on has loaded, so a pill never shows "Active" before "Done for today".
 */
export function useAgentState(agent: Agent): AgentState | undefined {
  const session = hasSession(agent)
  const usageAtom: Atom.Atom<AsyncResult.AsyncResult<AgentUsage, unknown>> = session ?
    agentUsageAtom(agent.id) :
    noUsageAtom
  const usage = useAtomValue(usageAtom)
  const awaiting = useAwaitingByAgent()
  const now = useNow(60_000)

  if (awaiting === undefined || (session && AsyncResult.isInitial(usage))) return undefined
  return agentState(
    agent,
    now,
    session && AsyncResult.isSuccess(usage) ? usage.value : undefined,
    awaiting.get(agent.id) ?? 0
  )
}
