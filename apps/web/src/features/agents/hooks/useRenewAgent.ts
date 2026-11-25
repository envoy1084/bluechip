import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { renewAgentAtom } from "../atoms/agents.ts"
import { useAgentSigning } from "./useAgentSigning.ts"

/** Renewing an agent's session with Face ID: a new key with the same rules, for another 90 days. */
export function useRenewAgent(agent: Agent) {
  const renew = useAtomSet(renewAgentAtom, { mode: "promise" })
  const { signing, run } = useAgentSigning()
  const busy = signing.status === "preparing" || signing.status === "signing"

  const start = () =>
    run(() => renew({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } }))

  return { signing, busy, renew: start }
}
