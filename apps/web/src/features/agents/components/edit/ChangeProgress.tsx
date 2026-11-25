import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import type { AgentSpec } from "@bluechip/domain/policies/AgentSpec"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { changeAgentAtom } from "../../atoms/agents.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useLanding } from "../../hooks/useLanding.ts"
import { LandingCard } from "../LandingCard.tsx"

function BackToAgent({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <Button variant="ghost" nativeButton={false} render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}>
      Back to {agent.name}
    </Button>
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
      <>
        <p className="max-w-[40ch] text-body-sm text-g-600">Base didn't take the change, and nothing changed.</p>
        <BackToAgent agent={agent} />
      </>
    )
  }

  return (
    <>
      <p className="max-w-[40ch] text-body-sm text-g-600">
        Base didn't take the change, so {agent.name}'s old rules still apply.
      </p>
      {signing.status === "failed" && (
        <Alert variant="destructive" className="w-full text-left">
          <AlertDescription>{signing.message}</AlertDescription>
        </Alert>
      )}
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
    </>
  )
}

/**
 * A change on its way to Base, followed through the live agent; once its new rules are in force, back to the
 * agent. Mount it once per send (a new `key`), so a retry follows its own change.
 */
export function ChangeProgress(
  { sent, spec, onSent }: Readonly<{ sent: Agent; spec: AgentSpec; onSent: (agent: Agent) => void }>
) {
  const navigate = useNavigate()
  const { agent, landing } = useLanding(
    sent,
    (candidate) => candidate.status === "active" && compareSpecs(candidate.spec, spec).policies.length === 0
  )

  useEffect(() => {
    if (landing === "landed") void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } })
  }, [landing, navigate, agent.id])

  if (landing === "failed") {
    return (
      <LandingCard landing="failed" title={`${agent.name}'s new rules weren't locked`}>
        <ChangeAgain agent={agent} spec={spec} onSent={onSent} />
      </LandingCard>
    )
  }

  return (
    <LandingCard landing="sending" title={`Locking ${agent.name}'s new rules`}>
      <p className="max-w-[40ch] text-body-sm text-g-600">
        Its old rules apply until the new ones land on Base. This takes a few seconds.
      </p>
    </LandingCard>
  )
}
