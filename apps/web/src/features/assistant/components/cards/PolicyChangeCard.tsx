import { AgentRequest } from "@bluechip/domain/agents/Agent"
import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { changeAgentAtom, confirmAgentAtom, removeAgentAtom, renewAgentAtom } from "../../atoms/assistant.ts"
import { useLiveAgent } from "../../hooks/useLiveAgent.ts"
import { AGENT_STANDING, hasExpired, signingProblem } from "../../model/cardText.ts"
import { CardFrame, CardProblem, RuleList } from "./CardFrame.tsx"

type PolicyChange = Extract<Card, { _tag: "PolicyChange" }>

const ACTION: Readonly<
  Record<PolicyChange["action"], { readonly tag: string; readonly button: string; readonly note: string }>
> = {
  update: {
    tag: "Change of policies",
    button: "Approve with Face ID",
    note: "Its new policies are locked onchain once you approve."
  },
  renew: {
    tag: "Renewal",
    button: "Renew with Face ID",
    note: "Locks the same policies with a new key for 90 more days."
  },
  remove: {
    tag: "Removal",
    button: "Remove with Face ID",
    note: "It stops for good. Your stocks and cash stay in your account."
  }
}

const CHANGE: Readonly<Record<string, { readonly label: string; readonly tone: string }>> = {
  tighter: { label: "Tighter", tone: "text-gain" },
  added: { label: "New", tone: "text-gain" },
  looser: { label: "Looser", tone: "text-warn" },
  removed: { label: "Removed", tone: "text-warn" },
  same: { label: "Same", tone: "text-g-500" }
}

/**
 * A change, renewal or removal of an agent, signed with Face ID here. A request that ran out (after two minutes) is
 * prepared again when you approve. A draft's removal needs no Face ID, so the card only says it happened.
 */
export function PolicyChangeCard({ card }: Readonly<{ card: PolicyChange }>) {
  const agent = useLiveAgent(card.agent)
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
      <CardFrame tag="Removal" icon="trash" state="Done">
        <p className="text-[13.5px] text-g-700">
          {card.agent.name} was a draft, so it was removed right away. Nothing was onchain.
        </p>
      </CardFrame>
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

  const waiting = !sent && agent.status === "active"

  return (
    <CardFrame
      tag={action.tag}
      icon={card.action === "remove" ? "trash" : "face-id"}
      state={waiting ? "Waiting for your Face ID" : AGENT_STANDING[agent.status]}
      footer={waiting ?
        <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>{action.button}</PasskeyButton> :
        (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
          >
            Open {agent.name}
            <Icon name="arrow-right" size={16} />
          </Button>
        )}
    >
      <div className="flex items-center gap-3">
        <AgentAvatar agentId={agent.id} />
        <div className="grid min-w-0">
          <b className="truncate text-[15px] font-semibold">{agent.name}</b>
          <span className="text-label-sm text-g-500">{action.note}</span>
        </div>
      </div>

      {card.changes === null ? null : (
        <ul className="grid gap-1">
          {card.changes.policies.filter(({ policy }) => !policyOf(policy).hidden).map(({ policy, change }) => (
            <li key={policy} className="flex items-center justify-between gap-2 text-[13.5px]">
              <span>{policyOf(policy).title}</span>
              <span className={cn("text-label-sm font-semibold", CHANGE[change]?.tone)}>{CHANGE[change]?.label}</span>
            </li>
          ))}
        </ul>
      )}
      {card.changes?.overall === "looser" ?
        (
          <p className="inline-flex items-start gap-1.5 text-label-sm font-[550] text-warn">
            <Icon name="warning" size={14} className="mt-px shrink-0" />
            This gives the agent more room than it has now.
          </p>
        ) :
        null}
      {card.description === null ? null : <RuleList can={card.description.can} never={card.description.never} />}
      <CardProblem message={problem} />
    </CardFrame>
  )
}
