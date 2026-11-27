import type { Agent } from "@bluechip/domain/agents/Agent"
import { Conflict, Unavailable } from "@bluechip/domain/Errors"
import { type AgentId, RequestId } from "@bluechip/domain/Ids"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet, useAtomValue } from "@effect/atom-react/Hooks"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useState } from "react"
import { agentsAtom } from "../../../atoms/agents.ts"
import { SettingsRow } from "../../../components/layout/SettingsSection.tsx"
import { type Landing, SignedChangeDialog } from "../../../components/SignedChangeDialog.tsx"
import { passkeyProblem } from "../../../lib/passkeyProblem.ts"
import { unavailableProblem } from "../../../lib/unavailableProblem.ts"
import { removeAllAgentsAtom } from "../atoms/settings.ts"

/** Agents with a session in force, which a removal revokes. */
const removable = (agent: Agent) => agent.status === "active" || agent.status === "expired"

// The removal is through once none of its agents is listed (removed agents aren't); one back in force means Base
// refused it.
const landingOf = (sent: ReadonlyArray<AgentId> | undefined, agents: ReadonlyArray<Agent>): Landing | undefined => {
  if (sent === undefined) return undefined
  const left = agents.filter((agent) => sent.includes(agent.id))
  if (left.length === 0) return "landed"
  return left.some(removable) ? "failed" : "pending"
}

/** The kill switch's second half: every agent removed with one Face ID, their sessions revoked onchain at once. */
export function RemoveAllAgents(
  { onOpenChange }: Readonly<{ onOpenChange?: (open: boolean) => void }> = {}
) {
  const agents = useAtomValue(agentsAtom)
  const removeAll = useAtomSet(removeAllAgentsAtom, { mode: "promise" })
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState<ReadonlyArray<AgentId> | undefined>(undefined)
  // How many it asked about: the list counts none once they're on their way out.
  const [asked, setAsked] = useState(0)

  const list = AsyncResult.isSuccess(agents) ? agents.value : []
  const count = list.filter(removable).length
  // The agents read as removing before the removal's answer comes back: the open dialog stays through it.
  if (count === 0 && sent === undefined && !open) return null

  const send = async () => {
    try {
      const removed = await removeAll(RequestId.make(crypto.randomUUID()))
      setSent(removed.map((agent) => agent.id))
    } catch (error) {
      throw new Error(
        error instanceof Unavailable ?
          unavailableProblem(error) :
          error instanceof Conflict ?
          "An agent has another change on its way. Try again once it lands." :
          passkeyProblem(error, "Nothing changed.").text,
        { cause: error }
      )
    }
  }

  return (
    <SettingsRow
      title="Remove all agents"
      description="They can never trade again. Your stocks and cash stay in your account."
    >
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setSent(undefined)
          setAsked(count)
          setOpen(true)
          onOpenChange?.(true)
        }}
      >
        <Icon name="trash" size={14} />Remove all
      </Button>
      <SignedChangeDialog
        open={open}
        onClose={() => {
          setOpen(false)
          onOpenChange?.(false)
        }}
        send={send}
        landing={landingOf(sent, list)}
        words={{
          danger: true,
          keep: asked === 1 ? "Keep it" : "Keep them",
          title: asked === 1 ? "Remove your agent?" : `Remove all ${asked} agents?`,
          description: "One Face ID takes back every agent's key, so none of them can ever trade again, and deletes " +
            "their automations. Your stocks and cash stay where they are.",
          action: "Remove with Face ID",
          pending: "Removing your agents",
          done: "Every agent is removed",
          doneDescription: "None of them can trade again. Make a new one any time.",
          failed: "Your agents weren't removed"
        }}
      />
    </SettingsRow>
  )
}
