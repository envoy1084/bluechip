import { type Agent, AgentRequest } from "@bluechip/domain/agents/Agent"
import { Conflict, InvalidLimits, Unavailable } from "@bluechip/domain/Errors"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useState } from "react"
import { confirmAgentAtom } from "../atoms/agents.ts"

export type AgentSigning =
  | { readonly status: "idle" }
  | { readonly status: "preparing" }
  | { readonly status: "signing" }
  | { readonly status: "sent"; readonly agent: Agent }
  | { readonly status: "failed"; readonly message: string }

/** Why a lock, change or removal didn't start, in words: nothing changed onchain in any of these. */
const problemOf = (error: unknown): string => {
  if (error instanceof InvalidLimits) return error.problems.map((problem) => problem.message).join(" ")
  if (error instanceof Conflict) return "This agent has another change on its way. Try again once it lands."
  if (error instanceof Unavailable) return "We couldn't reach Base just now. Nothing changed, so try again in a moment."
  return "Face ID was cancelled or the request couldn't be sent. Nothing changed."
}

/**
 * Locking, changing or removing an agent with Face ID: `run` prepares it on the server (or, for a draft's removal,
 * does it at once), the passkey signs the owner operation, and the server sends it. The agent then moves on through
 * live `AgentChanged` events.
 */
export function useAgentSigning() {
  const confirm = useAtomSet(confirmAgentAtom, { mode: "promise" })
  const [signing, setSigning] = useState<AgentSigning>({ status: "idle" })

  const run = async (prepare: () => Promise<AgentRequest | Agent>): Promise<AgentSigning> => {
    const settle = (next: AgentSigning) => {
      setSigning(next)
      return next
    }

    setSigning({ status: "preparing" })
    try {
      const prepared = await prepare()
      if (!(prepared instanceof AgentRequest)) return settle({ status: "sent", agent: prepared })

      setSigning({ status: "signing" })
      return settle({ status: "sent", agent: await confirm({ id: prepared.id, options: prepared.options }) })
    } catch (error) {
      return settle({ status: "failed", message: problemOf(error) })
    }
  }

  // For a `PasskeyButton`, which shows done or "try again" from a promise: the agent once sent, or the reason.
  const sign = async (prepare: () => Promise<AgentRequest | Agent>): Promise<Agent> => {
    const done = await run(prepare)
    if (done.status === "sent") return done.agent
    throw new Error(done.status === "failed" ? done.message : "The request didn't finish.")
  }

  return { signing, run, sign, reset: () => setSigning({ status: "idle" }) }
}
