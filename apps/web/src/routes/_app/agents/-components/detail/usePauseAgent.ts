import type { Agent } from "@bluechip/domain/agents/Agent"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { agentsReactivityKey } from "../../../../../api/client.ts"
import { pauseAgentAtom, resumeAgentAtom } from "../../../../../atoms/agents.ts"

/** Pausing or resuming one agent: instant and bluechip's alone, so neither asks for Face ID. */
export function usePauseAgent(agent: Agent) {
  const pause = useAtomSet(pauseAgentAtom, { mode: "promise" })
  const resume = useAtomSet(resumeAgentAtom, { mode: "promise" })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const setPaused = async (paused: boolean) => {
    setBusy(true)
    setFailed(false)
    try {
      await (paused ? pause : resume)({ params: { id: agent.id }, reactivityKeys: [agentsReactivityKey] })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return { busy, failed, pause: () => setPaused(true), resume: () => setPaused(false) }
}
