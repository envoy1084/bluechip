import { type AgentRequest, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { confirmAgentAtom, lockAgentAtom } from "../../atoms/assistant.ts"
import { useLiveAgent } from "../../hooks/useLiveAgent.ts"
import { AGENT_STANDING, hasExpired, signingProblem } from "../../model/cardText.ts"
import { CardFrame, CardProblem, RuleList } from "./CardFrame.tsx"

/**
 * An agent drafted from chat: what it can and never does, Customize to change its policies in the new-agent flow, and
 * Face ID to lock it. The lock request runs out after two minutes and is prepared again when you approve.
 */
export function DraftAgentCard({ card }: Readonly<{ card: Extract<Card, { _tag: "DraftAgent" }> }>) {
  const agent = useLiveAgent(card.agent)
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmAgentAtom, { mode: "promise" })
  const [request, setRequest] = useState<AgentRequest>(card.request)
  const [problem, setProblem] = useState<string | null>(null)
  const draft = agent.status === "draft"

  const approve = async () => {
    setProblem(null)
    try {
      let ready = request
      if (hasExpired(request.expiresAt)) {
        ready = await lock({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
        setRequest(ready)
      }
      await confirm({ id: ready.id, options: ready.options })
    } catch (error) {
      setProblem(signingProblem(error))
      throw error
    }
  }

  return (
    <CardFrame
      tag="Draft from chat"
      icon="edit"
      state={AGENT_STANDING[agent.status]}
      footer={draft ?
        (
          <>
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/agents/new" search={{ draft: agent.id }} />}
            >
              Customize
            </Button>
            <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>Lock with Face ID</PasskeyButton>
          </>
        ) :
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
        <AgentAvatar agentId={agent.id} size="lg" />
        <div className="grid min-w-0">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.015em]">{agent.name}</h3>
          <span className="text-label-sm text-g-500">
            {draft
              ? `Lasts ${SESSION_DAYS} days once locked. You can pause it any time.`
              : AGENT_STANDING[agent.status]}
          </span>
        </div>
      </div>
      <RuleList can={card.description.can} never={card.description.never} />
      <CardProblem message={problem} />
    </CardFrame>
  )
}
