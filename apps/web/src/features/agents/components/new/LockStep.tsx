import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { Outcome } from "@bluechip/ui/bluechip/outcome"
import { PasskeyButton } from "@bluechip/ui/bluechip/passkey-button"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import { ButtonLink } from "@bluechip/ui/components/button"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import { lockAgentAtom } from "../../atoms/agents.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { useLanding } from "../../hooks/useLanding.ts"
import type { AutomationSlots, TemplateAutomation } from "../../model/templateAutomations.ts"
import { DoneStep } from "./DoneStep.tsx"
import { NewAgentShell } from "./NewAgentShell.tsx"

/** A lock that didn't land: the draft is still there, so Face ID can lock it again. */
function LockAgain({ agent, onSent }: Readonly<{ agent: Agent; onSent: (agent: Agent) => void }>) {
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const { signing, sign } = useAgentSigning()

  if (agent.status !== "draft") {
    return (
      <Outcome
        tone="failure"
        size="page"
        title={`${agent.name}'s rules weren't locked`}
        description="This draft was removed, so there's nothing to lock."
        actions={<ButtonLink variant="secondary" render={<Link to="/agents" />}>See your agents</ButtonLink>}
      />
    )
  }

  return (
    <Outcome
      tone="failure"
      size="page"
      title={`${agent.name}'s rules weren't locked`}
      description={`Base didn't take the lock, so nothing changed. ${agent.name} is saved as a draft until you lock it.`}
      actions={
        <PasskeyButton
          size="lg"
          doneLabel="Sent"
          onAuthenticate={async () =>
            onSent(
              await sign(() =>
                lock({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
              )
            )}
          className="w-full max-w-[340px]"
        >
          Lock again with Face ID
        </PasskeyButton>
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
 * After Face ID: a couple of seconds while Base takes the lock, followed through the live agent, then the agent at
 * work, or the lock that didn't land. Mount it once per send (a new `key`), so a retry follows its own lock.
 */
export function LockStep(
  { sent, onSent, Saved, automations }: Readonly<{
    sent: Agent
    onSent: (agent: Agent) => void
    /** Saves its automations once it's live. */
    Saved: AutomationSlots["Saved"]
    automations: ReadonlyArray<TemplateAutomation>
  }>
) {
  const { agent, landing } = useLanding(sent, (candidate) => candidate.status === "active")

  return (
    <NewAgentShell step={null}>
      {landing === "landed" ?
        <DoneStep agent={agent} automations={<Saved agent={agent} automations={automations} />} /> :
        (
          <div className="mx-auto w-full max-w-[460px] rounded-lg bg-white px-6 py-7 shadow-e2">
            {landing === "sending" ?
              (
                <Outcome
                  tone="pending"
                  size="page"
                  title={`Locking ${agent.name}'s rules`}
                  description="Base takes a couple of seconds. Once locked, every trade it makes is checked against them."
                />
              ) :
              <LockAgain agent={agent} onSent={onSent} />}
          </div>
        )}
    </NewAgentShell>
  )
}
