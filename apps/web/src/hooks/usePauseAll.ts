import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom, pauseAllAgentsAtom, resumeAllAgentsAtom } from "../atoms/agents.ts"
import { agentsReactivityKey } from "../lib/api/client.ts"

/** Whether bluechip can pause it: anything locked or on its way to be, not a draft or a removed agent. */
export const isPausable = (agent: Agent): boolean => agent.status !== "draft" && agent.status !== "removed"

/**
 * The kill switch over every agent: shown once one can be paused, and offering to resume once all of them are.
 * Pausing and resuming are bluechip's alone, so neither asks for Face ID.
 */
export function usePauseAll() {
  const agents = useAtomValue(agentsAtom)
  const pauseAll = useAtomSet(pauseAllAgentsAtom, { mode: "promise" })
  const resumeAll = useAtomSet(resumeAllAgentsAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const pausable = AsyncResult.isSuccess(agents) ? agents.value.filter(isPausable) : []
  const allPaused = pausable.length > 0 && pausable.every((agent) => agent.paused)

  const toggle = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await (allPaused ? resumeAll : pauseAll)({ reactivityKeys: [agentsReactivityKey] })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return { shown: pausable.length > 0, allPaused, busy, failed, toggle }
}
