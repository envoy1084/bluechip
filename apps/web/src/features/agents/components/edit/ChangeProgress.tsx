import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { ButtonLink } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { changeAgentAtom } from "../../atoms/agents.ts"
import { agentMomentAtom } from "../../atoms/moment.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useLanding } from "../../hooks/useLanding.ts"

function BackToAgent({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <ButtonLink variant="ghost" render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}>
      Back to {agent.name}
    </ButtonLink>
  )
}

/** A change that didn't land: the old rules still apply, and Face ID can send it again. */
function ChangeAgain(
  { agent, spec, onSent }: Readonly<{ agent: Agent; spec: AgentSpec; onSent: (agent: Agent) => void }>
) {
  const change = useAtomSet(changeAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()

  if (agent.status !== "active") {
    return (
      <Outcome
        tone="failure"
        size="page"
        title={`${agent.name}'s new rules weren't locked`}
        description="Base didn't take the change, and nothing changed."
        actions={<BackToAgent agent={agent} />}
      />
    )
  }

  return (
    <Outcome
      tone="failure"
      size="page"
      title={`${agent.name}'s new rules weren't locked`}
      description={`Base didn't take the change, so ${agent.name}'s old rules still apply.`}
      actions={
        <div className="grid w-full max-w-[340px] gap-2">
          <PasskeyButton
            size="lg"
            doneLabel="Sent"
            onAuthenticate={async () =>
              onSent(
                await sign(() =>
                  change({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId, spec } })
                )
              )}
            className="w-full"
          >
            Try again with Face ID
          </PasskeyButton>
          <BackToAgent agent={agent} />
        </div>
      }
    >
      {signing.status === "failed" && (
        <Alert variant="destructive">
          <AlertDescription>{signing.message}</AlertDescription>
        </Alert>
      )}
    </Outcome>
  )
}

/**
 * A change on its way to Base (a couple of seconds), followed through the live agent; once its new rules are in force,
 * back to the agent, whose page says they're locked. Mount it once per send (a new `key`), so a retry follows its own
 * change.
 */
export function ChangeProgress(
  { sent, spec, onSent }: Readonly<{ sent: Agent; spec: AgentSpec; onSent: (agent: Agent) => void }>
) {
  const navigate = useNavigate()
  const handOver = useAtomSet(agentMomentAtom)
  const { agent, landing } = useLanding(
    sent,
    (candidate) => candidate.status === "active" && compareSpecs(candidate.spec, spec).policies.length === 0
  )

  useEffect(() => {
    if (landing !== "landed") return
    handOver({ agentId: agent.id, name: agent.name, moment: "changed" })
    void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } })
  }, [landing, navigate, agent.id, agent.name, handOver])

  return (
    <div className="mx-auto w-full max-w-[460px] rounded-lg bg-white px-6 py-7 shadow-e2">
      {landing === "failed" ?
        <ChangeAgain agent={agent} spec={spec} onSent={onSent} /> :
        (
          <Outcome
            tone="pending"
            size="page"
            title={`Locking ${agent.name}'s new rules`}
            description="Its old rules apply until Base takes the new ones, in a couple of seconds."
          />
        )}
    </div>
  )
}
