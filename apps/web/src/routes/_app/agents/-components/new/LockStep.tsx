import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { LandingCard } from "../../../../../agents/LandingCard.tsx"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { useLanding } from "../../../../../agents/useLanding.ts"
import { lockAgentAtom } from "../../../../../atoms/agents.ts"
import { DoneStep } from "./DoneStep.tsx"
import { NewAgentShell } from "./NewAgentShell.tsx"

/** A lock that didn't land: the draft is still there, so Face ID can lock it again. */
function LockAgain({ agent, onSent }: Readonly<{ agent: Agent; onSent: (agent: Agent) => void }>) {
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()

  if (agent.status !== "draft") {
    return (
      <>
        <p className="max-w-[40ch] text-body-sm text-g-600">This draft was removed, so there's nothing to lock.</p>
        <Button variant="secondary" nativeButton={false} render={<Link to="/agents" />}>See your agents</Button>
      </>
    )
  }

  return (
    <>
      <p className="max-w-[40ch] text-body-sm text-g-600">
        Base didn't take the lock, so nothing changed. {agent.name} is saved as a draft until you lock it.
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
              lock({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
            )
          )}
        className="w-full"
      >
        Lock again with Face ID
      </PasskeyButton>
    </>
  )
}

/**
 * Steps four and five: the lock on its way to Base, followed through the live agent, then the agent at work. Mount it
 * once per send (a new `key`), so a retry follows its own lock.
 */
export function LockStep({ sent, onSent }: Readonly<{ sent: Agent; onSent: (agent: Agent) => void }>) {
  const { agent, landing } = useLanding(sent, (candidate) => candidate.status === "active")

  if (landing === "landed") {
    return (
      <NewAgentShell step="Done">
        <DoneStep agent={agent} />
      </NewAgentShell>
    )
  }

  return (
    <NewAgentShell step="Face ID">
      {landing === "sending" ?
        (
          <LandingCard landing="sending" title={`Locking ${agent.name}'s rules`}>
            <p className="max-w-[40ch] text-body-sm text-g-600">
              Face ID is the only way its rules can be set or loosened. Once locked, every trade is checked against them
              on Base.
            </p>
          </LandingCard>
        ) :
        (
          <LandingCard landing="failed" title={`${agent.name}'s rules weren't locked`}>
            <LockAgain agent={agent} onSent={onSent} />
          </LandingCard>
        )}
    </NewAgentShell>
  )
}
