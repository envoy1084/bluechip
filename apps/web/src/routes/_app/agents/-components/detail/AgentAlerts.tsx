import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { lockAgentAtom } from "../../../../../atoms/agents.ts"
import { usePauseAgent } from "./usePauseAgent.ts"

/** A draft's lock, prepared again and signed with Face ID (after one that failed, expired or was never signed). */
function NotLockedAlert({ agent }: Readonly<{ agent: Agent }>) {
  const lock = useAtomSet(lockAgentAtom, { mode: "promise" })
  const { signing, run } = useAgentSigning()
  const busy = signing.status === "preparing" || signing.status === "signing"

  return (
    <Alert variant="warning" icon="unlock">
      <AlertTitle>{agent.name} isn't locked yet</AlertTitle>
      <AlertDescription>
        {signing.status === "failed" ?
          signing.message :
          "It can't trade until you lock its limits with Face ID. Nothing has been sent to Base."}
      </AlertDescription>
      <AlertAction>
        <Button
          size="sm"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() =>
            void run(() =>
              lock({ params: { id: agent.id }, payload: { requestId: crypto.randomUUID() as RequestId } })
            )}
        >
          {busy ? <Spinner size={14} /> : <Icon name="face-id" size={14} />}
          <TextMorph>{signing.status === "signing" ? "Waiting for Face ID…" : "Lock with Face ID"}</TextMorph>
        </Button>
      </AlertAction>
    </Alert>
  )
}

function PausedAlert({ agent }: Readonly<{ agent: Agent }>) {
  const { busy, failed, resume } = usePauseAgent(agent)

  return (
    <Alert variant="warning" icon="pause">
      <AlertTitle>{agent.name} is paused</AlertTitle>
      <AlertDescription>
        {failed ?
          "We couldn't resume it just now. Try again." :
          "It won't trade until you resume it. Nothing was sold."}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" loading={busy} onClick={() => void resume()}>
          <Icon name="play" size={14} />Resume
        </Button>
      </AlertAction>
    </Alert>
  )
}

function SendingAlert({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <Alert icon="clock">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}

/** What needs saying about the agent before anything else: removed, not locked, a change on its way, or paused. */
export function AgentAlerts({ agent }: Readonly<{ agent: Agent }>) {
  if (agent.status === "removed") {
    return (
      <Alert>
        <AlertTitle>{agent.name} was removed</AlertTitle>
        <AlertDescription>
          It can never trade again. This page keeps its history, read only. Your stocks and cash stayed in your account.
        </AlertDescription>
      </Alert>
    )
  }
  if (agent.status === "draft") return <NotLockedAlert agent={agent} />

  return (
    <>
      {agent.status === "locking" ?
        (
          <SendingAlert
            title={`Locking ${agent.name}`}
            description="Its limits are on their way to Base. It can trade once they land."
          />
        ) :
        null}
      {agent.status === "updating" ?
        (
          <SendingAlert
            title="New limits on their way"
            description="The change is on its way to Base. Its current limits stay in force until it lands."
          />
        ) :
        null}
      {agent.status === "removing" ?
        (
          <SendingAlert
            title={`Removing ${agent.name}`}
            description="The removal is on its way to Base. Once it lands, it can never trade again."
          />
        ) :
        null}
      {agent.paused ? <PausedAlert agent={agent} /> : null}
    </>
  )
}
