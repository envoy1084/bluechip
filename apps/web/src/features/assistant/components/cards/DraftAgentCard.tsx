import { type AgentRequest, SESSION_DAYS } from "@bluechip/domain/agents/Agent"
import type { Card } from "@bluechip/domain/assistant/Card"
import type { RequestId } from "@bluechip/domain/Ids"
import { AgentDraftCard } from "@bluechip/ui/bluechip/agent-draft-card"
import { AGENT_STATES } from "@bluechip/ui/bluechip/agent-status"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { WorstCaseCard } from "@bluechip/ui/bluechip/worst-case-card"
import { ButtonLink } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { useAgentState } from "../../../../hooks/useAgentState.ts"
import { confirmAgentAtom, lockAgentAtom } from "../../atoms/assistant.ts"
import { useLiveAgent } from "../../hooks/useLiveAgent.ts"
import { agentOutcome, hasExpired, signingProblem } from "../../model/cardText.ts"
import { worstCaseLines, worstCaseOf } from "../../model/worstCase.ts"
import { DraftAutomations } from "./DraftAutomations.tsx"
import { SpecGlance } from "./SpecGlance.tsx"

/**
 * An agent drafted from chat: its limits at a glance, what it can and never does, the most it could do on its worst
 * day, the automations its template comes with (kept or left out,
 * started once it's live), Customize to change its policies in the new-agent flow, and Face ID to lock it. The lock
 * request runs out after two minutes and is prepared again when you approve.
 */
export function DraftAgentCard({ card }: Readonly<{ card: Extract<Card, { _tag: "DraftAgent" }> }>) {
  const agent = useLiveAgent(card.agent)
  const standing = useAgentState(agent)
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const confirm = useAtomSet(confirmAgentAtom, { mode: "promise" })
  const [request, setRequest] = useState<AgentRequest>(card.request)
  const [problem, setProblem] = useState<string | null>(null)
  const draft = agent.status === "draft"
  const landed = draft ? null : agentOutcome("lock", agent.status, agent.name)

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
    <AgentDraftCard
      tag={draft ? "Draft agent" : "New agent"}
      agentId={agent.id}
      name={agent.name}
      detail={`Runs for ${SESSION_DAYS} days once locked. Pause it any time.`}
      can={card.description.can}
      never={card.description.never}
      glance={<SpecGlance spec={agent.spec} />}
      worstCase={<WorstCaseCard tone="quiet">{worstCaseLines(worstCaseOf(agent.spec)).join(" ")}</WorstCaseCard>}
      state={standing === undefined ? undefined : AGENT_STATES[standing].label}
      tone={draft ? "waiting" : agent.status === "active" ? "done" : "quiet"}
      problem={problem}
      automations={<DraftAutomations card={card} agent={agent} />}
      footer={draft ?
        (
          <>
            <ButtonLink variant="ghost" render={<Link to="/agents/new" search={{ draft: agent.id }} />}>
              Customize
            </ButtonLink>
            <PasskeyButton doneLabel="Sent" onAuthenticate={approve}>Lock with Face ID</PasskeyButton>
          </>
        ) :
        (
          <ButtonLink
            variant="secondary"
            render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}
          >
            Open agent
            <Icon name="arrow-right" size={16} />
          </ButtonLink>
        )}
    >
      {landed === null
        ? undefined
        : <Outcome tone={landed.tone} title={landed.title} description={landed.description} />}
    </AgentDraftCard>
  )
}
