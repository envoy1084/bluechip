import { AgentRequest, transition } from "@bluechip/domain/agents/Agent"
import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { AGENT_STATES } from "@bluechip/ui/bluechip/agent-status"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { PolicyChangeCard as PolicyChangeView } from "@bluechip/ui/bluechip/policy-change-card"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as Result from "effect/Result"
import { useState } from "react"
import { useAgentState } from "../../../../hooks/useAgentState.ts"
import { changeAgentAtom, confirmAgentAtom, removeAgentAtom, renewAgentAtom } from "../../atoms/assistant.ts"
import { useLiveAgent } from "../../hooks/useLiveAgent.ts"
import { agentOutcome, hasExpired, signingProblem } from "../../model/cardText.ts"
import { SpecGlance } from "./SpecGlance.tsx"

type PolicyChange = Extract<Card, { _tag: "PolicyChange" }>

const ACTION: Readonly<
  Record<PolicyChange["action"], { readonly button: string; readonly note: string }>
> = {
  update: {
    button: "Approve with Face ID",
    note: "Its new rules are locked onchain once you approve."
  },
  renew: {
    button: "Renew with Face ID",
    note: "Locks the same rules with a new key for 90 more days."
  },
  remove: {
    button: "Remove with Face ID",
    note: "It stops for good. Your stocks and cash stay in your account."
  }
}

/**
 * A change, renewal or removal of an agent, signed with Face ID here, with its limits at a glance as they'll be locked
 * (a change's new ones, a renewal's same ones). A request that ran out (after two minutes) is
 * prepared again when you approve. A draft's removal needs no Face ID, so the card only says it happened.
 */
export function PolicyChangeCard({ card }: Readonly<{ card: PolicyChange }>) {
  const agent = useLiveAgent(card.agent)
  const standing = useAgentState(agent)
  const change = useAtomSet(changeAgentAtom, { mode: "promise" })
  const renew = useAtomSet(renewAgentAtom, { mode: "promise" })
  const remove = useAtomSet(removeAgentAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmAgentAtom, { mode: "promise" })
  const [request, setRequest] = useState(card.request)
  const [sent, setSent] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const action = ACTION[card.action]

  if (request === null) {
    return (
      <PolicyChangeView
        action="remove"
        agentId={agent.id}
        name={agent.name}
        note=""
        state="Done"
        tone="done"
        footer={undefined}
      >
        <Outcome
          tone="success"
          title={`${card.agent.name} is removed`}
          description="It was a draft, so it was removed right away. Nothing was onchain."
        />
      </PolicyChangeView>
    )
  }

  const prepareAgain = async (): Promise<AgentRequest | null> => {
    const params = { id: agent.id }
    const requestId = crypto.randomUUID() as RequestId
    if (card.action === "update") {
      const spec = request.agent.pendingSpec ?? request.agent.spec
      return change({ params, payload: { requestId, spec } })
    }
    if (card.action === "renew") return renew({ params, payload: { requestId } })
    const removed = await remove({ params, payload: { requestId } })
    return removed instanceof AgentRequest ? removed : null
  }

  const approve = async () => {
    setProblem(null)
    try {
      let ready: AgentRequest | null = request
      if (hasExpired(request.expiresAt)) {
        ready = await prepareAgain()
        if (ready !== null) setRequest(ready)
      }
      if (ready !== null) await confirm({ id: ready.id, options: ready.options })
      setSent(true)
    } catch (error) {
      setProblem(signingProblem(error))
      throw error
    }
  }

  // Still to sign while the agent can take it: a change only while active, a renewal or removal once it ran out too.
  const waiting = !sent && Result.isSuccess(transition(agent.status, { _tag: "Sent", action: card.action }))

  const landed = sent ? agentOutcome(card.action, agent.status, agent.name) : null
  const locking = request.agent.pendingSpec ?? request.agent.spec

  return (
    <PolicyChangeView
      action={card.action}
      agentId={agent.id}
      name={agent.name}
      note={action.note}
      changes={(card.changes?.policies ?? []).filter(({ policy }) => !policyOf(policy).hidden).map((
        { policy, change }
      ) => ({ title: policyOf(policy).title, change }))}
      looser={card.changes?.overall === "looser"}
      glance={card.action === "remove" ? undefined : <SpecGlance spec={locking} />}
      can={card.description?.can ?? []}
      never={card.description?.never ?? []}
      state={waiting ? "Waiting for Face ID" : standing === undefined ? undefined : AGENT_STATES[standing].label}
      tone={waiting ? "waiting" : landed?.tone === "success" ? "done" : "quiet"}
      problem={problem}
      footer={waiting ?
        <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>{action.button}</PasskeyButton> :
        (
          <ButtonLink
            variant="secondary"
            render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
          >
            Open {agent.name}
            <Icon name="arrow-right" size={16} />
          </ButtonLink>
        )}
    >
      {landed === null
        ? undefined
        : <Outcome tone={landed.tone} title={landed.title} description={landed.description} />}
    </PolicyChangeView>
  )
}
