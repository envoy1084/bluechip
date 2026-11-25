import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import * as DateTime from "effect/DateTime"
import { dayLabel } from "../../../../../agents/spec/fieldText.ts"
import { useAgentSigning } from "../../../../../agents/useAgentSigning.ts"
import { lockAgentAtom } from "../../../../../atoms/agents.ts"
import { RenewButton } from "./RenewButton.tsx"
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
          "It can't trade until you lock its rules with Face ID. Nothing has been sent to Base."}
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

/** A session past its end: the agent stopped until it's renewed with Face ID. */
function ExpiredAlert({ agent, ended }: Readonly<{ agent: Agent; ended: Date }>) {
  return (
    <Alert variant="warning" icon="hourglass">
      <AlertTitle>Its rules ran out on {dayLabel(ended)}</AlertTitle>
      <AlertDescription>
        {agent.name} stopped trading. Renew it with Face ID to keep it running with the same rules.
      </AlertDescription>
      <AlertAction>
        <RenewButton agent={agent} variant="primary" />
      </AlertAction>
    </Alert>
  )
}

// A renewal locks the same policies again; anything else on its way is a change of them.
const renewing = (agent: Agent): boolean =>
  agent.pendingSpec !== null && compareSpecs(agent.spec, agent.pendingSpec).policies.length === 0

/**
 * What needs saying about the agent before anything else: removed, not locked, a change or renewal on its way, its
 * session ended, or paused.
 */
export function AgentAlerts({ agent, now }: Readonly<{ agent: Agent; now: Date }>) {
  const ended = agent.lockedUntil === null ? null : DateTime.toDateUtc(agent.lockedUntil)

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
            description="Its rules are on their way to Base. It can trade once they land."
          />
        ) :
        null}
      {agent.status === "updating" ?
        (
          renewing(agent) ?
            (
              <SendingAlert
                title={`Renewing ${agent.name}`}
                description="Its new session is on its way to Base, with the same rules for another 90 days."
              />
            ) :
            (
              <SendingAlert
                title="New rules on their way"
                description="The change is on its way to Base. Its current rules stay in force until it lands."
              />
            )
        ) :
        null}
      {agent.status === "active" && ended !== null && ended.getTime() <= now.getTime() ?
        <ExpiredAlert agent={agent} ended={ended} /> :
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
