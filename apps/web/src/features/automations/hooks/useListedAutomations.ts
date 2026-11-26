import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { AutomationRun } from "@bluechip/domain/automations/Run"
import type { AgentId } from "@bluechip/domain/Ids"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useMemo } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { automationRunsAtom, automationsAtom } from "../atoms/automations.ts"
import { attentionOf, type Listed, standingOf } from "../model/standing.ts"

export interface ListedAutomation extends Listed {
  readonly automation: Automation
  /** Its latest runs, newest first, once its details load. */
  readonly runs: ReadonlyArray<AutomationRun> | undefined
  /** The agent it trades through: `null` for your own trades or an agent that's gone, `undefined` while loading. */
  readonly agent: Agent | null | undefined
}

/**
 * Your automations (`"all"`, or one agent's) with where each stands, whether it needs a look, its latest runs and its
 * agent; with Try again for the list.
 */
export function useListedAutomations(agentId: AgentId | "all") {
  const automations = useAtomValue(automationsAtom(agentId))
  const refresh = useAtomRefresh(automationsAtom(agentId))
  const runs = useAtomValue(automationRunsAtom(agentId))
  const agents = useAtomValue(agentsAtom)

  const listed = useMemo(
    () =>
      AsyncResult.map(automations, (list) =>
        list.map((automation): ListedAutomation => {
          const latest = runs.get(automation.id)
          const agent = automation.agentId === null ?
            null :
            AsyncResult.isSuccess(agents) ?
            agents.value.find((candidate) => candidate.id === automation.agentId) ?? null :
            undefined
          return {
            automation,
            runs: latest,
            agent,
            standing: standingOf(automation, latest ?? []),
            attention: attentionOf(automation, latest ?? [], agent)
          }
        })),
    [automations, runs, agents]
  )

  return { listed, refresh }
}
