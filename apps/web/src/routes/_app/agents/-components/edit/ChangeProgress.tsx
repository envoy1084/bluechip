import type { Agent } from "@bluechip/domain/agents/Agent"
import type { Limits } from "@bluechip/domain/agents/Limits"
import { compare } from "@bluechip/domain/agents/Rules"
import type { RequestId } from "@bluechip/domain/Ids"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { LandingCard } from "../../../../../agents/LandingCard.tsx"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { useLanding } from "../../../../../agents/useLanding.ts"
import { changeLimitsAtom } from "../../../../../atoms/agents.ts"

function BackToAgent({ agent }: Readonly<{ agent: Agent }>) {
  return (
    <Button variant="ghost" nativeButton={false} render={<Link to="/agents/$agentId" params={{ agentId: agent.id }} />}>
      Back to {agent.name}
    </Button>
  )
}

/** A change that didn't land: the old limits still apply, and Face ID can send it again. */
function ChangeAgain(
  { agent, limits, onSent }: Readonly<{ agent: Agent; limits: Limits; onSent: (agent: Agent) => void }>
) {
  const changeLimits = useAtomSet(changeLimitsAtom, { mode: "promise" })
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
        Base didn't take the change, so {agent.name}'s old limits still apply.
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
              changeLimits({
                params: { id: agent.id },
                payload: { requestId: crypto.randomUUID() as RequestId, limits }
              })
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
 * A change on its way to Base, followed through the live agent; once its new limits are in force, back to the
 * agent. Mount it once per send (a new `key`), so a retry follows its own change.
 */
export function ChangeProgress(
  { sent, limits, onSent }: Readonly<{ sent: Agent; limits: Limits; onSent: (agent: Agent) => void }>
) {
  const navigate = useNavigate()
  const { agent, landing } = useLanding(
    sent,
    (candidate) => candidate.status === "active" && compare(candidate.limits, limits).overall === "same"
  )

  useEffect(() => {
    if (landing === "landed") void navigate({ to: "/agents/$agentId", params: { agentId: agent.id } })
  }, [landing, navigate, agent.id])

  if (landing === "failed") {
    return (
      <LandingCard landing="failed" title={`${agent.name}'s new limits weren't locked`}>
        <ChangeAgain agent={agent} limits={limits} onSent={onSent} />
      </LandingCard>
    )
  }

  return (
    <LandingCard landing="sending" title={`Locking ${agent.name}'s new limits`}>
      <p className="max-w-[40ch] text-body-sm text-g-600">
        Its old limits apply until the new ones land on Base. This takes a few seconds.
      </p>
    </LandingCard>
  )
}
