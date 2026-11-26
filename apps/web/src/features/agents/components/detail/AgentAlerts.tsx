import type { Agent } from "@bluechip/domain/agents/Agent"
import type { RequestId } from "@bluechip/domain/Ids"
import { compareSpecs } from "@bluechip/domain/policies/Catalog"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@bluechip/ui/components/alert"
import { Button, ButtonLink } from "@bluechip/ui/components/button"
import { Spinner } from "@bluechip/ui/components/spinner"
import { TextMorph } from "@bluechip/ui/components/text-morph"
import { Icon } from "@bluechip/ui/icons/icon"
import { useAtomSet } from "@effect/atom-react/Hooks"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { useAwaitingByAgent } from "../../../../hooks/useAwaitingByAgent.ts"
import { lockAgentAtom } from "../../atoms/agents.ts"
import { useAgentMoment } from "../../hooks/useAgentMoment.ts"
import { useAgentSigning } from "../../hooks/useAgentSigning.ts"
import { momentText } from "../../model/agentMoment.ts"
import { dayLabel } from "../../model/fieldText.ts"
import { RenewButton } from "./RenewButton.tsx"

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

/** Its trades waiting for your approval, with the way to them. */
function ApprovalsAlert({ awaiting }: Readonly<{ awaiting: number }>) {
  return (
    <Alert variant="info" icon="hand">
      <AlertTitle>
        {awaiting === 1 ? "1 trade waits for your approval" : `${awaiting} trades wait for your approval`}
      </AlertTitle>
      <AlertDescription>
        {awaiting === 1 ? "It's over what this agent may do alone" : "They're over what this agent may do alone"}, so it
        sends nothing until you approve or decline with Face ID.
      </AlertDescription>
      <AlertAction>
        <ButtonLink size="sm" render={<Link to="/approvals" />}>Review</ButtonLink>
      </AlertAction>
    </Alert>
  )
}

/** What just landed (live, new rules locked, renewed, trading again), said once until you dismiss it. */
function MomentAlert({ agent }: Readonly<{ agent: Agent }>) {
  const { moment, dismiss } = useAgentMoment(agent)
  if (moment === null) return null

  const text = momentText(moment, agent)
  return (
    <Alert variant="success" className="animate-pop-in">
      <AlertTitle>{text.title}</AlertTitle>
      <AlertDescription>{text.description}</AlertDescription>
      <AlertAction>
        <Button variant="ghost" size="sm" onClick={dismiss}>Done</Button>
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
function ExpiredAlert({ agent, ended }: Readonly<{ agent: Agent; ended: Date | null }>) {
  return (
    <Alert variant="warning" icon="hourglass">
      <AlertTitle>{ended === null ? "Its rules ran out" : `Its rules ran out on ${dayLabel(ended)}`}</AlertTitle>
      <AlertDescription>
        {agent.name} stopped trading. Renew it with Face ID to keep it running with the same rules.
      </AlertDescription>
      <AlertAction>
        <RenewButton agent={agent} variant="primary" />
      </AlertAction>
    </Alert>
  )
}

/**
 * What needs saying about the agent before anything else: removed, not locked, a change or renewal on its way, its
 * session ended, or trades waiting for your approval. Paused is said in the header, beside its Resume.
 */
export function AgentAlerts({ agent, now }: Readonly<{ agent: Agent; now: Date }>) {
  const awaiting = useAwaitingByAgent()?.get(agent.id) ?? 0
  const ended = agent.lockedUntil === null ? null : DateTime.toDateUtc(agent.lockedUntil)
  // A renewal locks the same policies again; anything else on its way is a change of them.
  const renewing = agent.pendingSpec !== null && compareSpecs(agent.spec, agent.pendingSpec).policies.length === 0

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
      <MomentAlert agent={agent} />
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
          renewing ?
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
      {agent.status === "expired" || (agent.status === "active" && ended !== null && ended.getTime() <= now.getTime()) ?
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
      {awaiting > 0 ? <ApprovalsAlert awaiting={awaiting} /> : null}
    </>
  )
}
