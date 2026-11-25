import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { removeAgentAtom } from "../atoms/agents.ts"
import { useAgentSigning } from "./useAgentSigning.ts"

/**
 * Removing an agent: a draft goes at once, a locked agent's session is revoked once Face ID signs it. Once it is
 * removed (straight away, or when the revocation lands), the page goes back to the list.
 */
export function useRemoveAgent(agent: Agent) {
  const remove = useAtomSet(removeAgentAtom, { mode: "promise" })
  const { signing, run, reset } = useAgentSigning()
  const navigate = useNavigate()

  const sent = signing.status === "sent"
  const removed = agent.status === "removed" || (signing.status === "sent" && signing.agent.status === "removed")
  useEffect(() => {
    if (sent && removed) void navigate({ to: "/agents" })
  }, [sent, removed, navigate])

  const start = () =>
    run(() => remove({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } }))

  return { signing, remove: start, reset }
}
