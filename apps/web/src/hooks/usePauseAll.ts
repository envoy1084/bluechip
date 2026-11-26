import type { Agent } from "@bluechip/domain/agents/Agent"
import { toast } from "@bluechip/ui/components/toast"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom, pauseAllAgentsAtom, resumeAllAgentsAtom } from "../atoms/agents.ts"
import { agentsReactivityKey } from "../lib/api/client.ts"

/**
 * Whether pausing all of them pauses it: what the server's pause all pauses, an agent locked or with a lock, change or
 * removal on its way. Not a draft, an agent that ran out or a removed one, which can't trade anyway.
 */
export const isPausable = (agent: Agent): boolean =>
  agent.status === "locking" || agent.status === "active" || agent.status === "updating" ||
  agent.status === "removing"

const agentsWord = (count: number) => count === 1 ? "1 agent" : `${count} agents`

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
    const resuming = allPaused
    const count = pausable.filter((agent) => agent.paused === resuming).length
    setBusy(true)
    setFailed(false)
    try {
      await (resuming ? resumeAll : pauseAll)({ reactivityKeys: [agentsReactivityKey] })
      toast.success(
        resuming ? `Resumed ${agentsWord(count)}` : `Paused ${agentsWord(count)}`,
        { description: resuming ? "They trade again within their rules." : "None of them trade until you resume them." }
      )
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return { shown: pausable.length > 0, allPaused, busy, failed, toggle }
}
