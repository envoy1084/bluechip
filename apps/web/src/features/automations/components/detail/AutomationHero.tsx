import type { Agent } from "@bluechip/domain/agents/Agent"
import type { AutomationDetail } from "@bluechip/domain/automations/Run"
import { AgentAvatar } from "@bluechip/ui/bluechip/agent-avatar"
import { StatGrid, StatTile } from "@bluechip/ui/bluechip/stat-tile"
import { Alert, AlertDescription } from "@bluechip/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@bluechip/ui/components/alert-dialog"
import { Button } from "@bluechip/ui/components/button"
import { Icon } from "@bluechip/ui/icons/icon"
import { formatDate, formatRelative } from "@bluechip/ui/lib/format"
import { Link, useNavigate } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import type { ComponentType } from "react"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { useAutomationActions } from "../../hooks/useAutomationActions.ts"
import { CREATED_BY, firesText, OUTCOME } from "../../model/automationText.ts"
import { catalogEntry } from "../../model/drafts.ts"
import { stocksIn } from "../../model/sentence.ts"
import { attentionOf, nowLine, standingOf, untilText } from "../../model/standing.ts"
import { AutomationSentence } from "../AutomationSentence.tsx"
import { StandingPill } from "../StatusPill.tsx"
import { TriggerArt } from "../TriggerArt.tsx"
import { EditAutomationSheet } from "./EditAutomationSheet.tsx"
import { SettingsChips } from "./SettingsChips.tsx"

/** Draws an agent's state beside its name; it comes from the agents feature, through the route. */
export type AgentStateView = ComponentType<{ agent: Agent }>

/** Who trades: you with Face ID, or the agent with its avatar, a link to it and its state. */
function Trader(
  { agentId, agent, AgentState }: Readonly<{
    agentId: string | null
    agent: Agent | null | undefined
    AgentState: AgentStateView
  }>
) {
  if (agentId === null) {
    return (
      <span className="flex items-center gap-2.5 text-label text-g-600">
        <span className="grid size-[34px] place-items-center rounded-md bg-[linear-gradient(180deg,#f4f7ff,#e8eeff)] text-blue shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgba(10,11,13,.08)]">
          <Icon name="face-id" size={18} />
        </span>
        <span>
          <b className="font-semibold text-ink">You</b>, with Face ID for each trade
        </span>
      </span>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2.5 text-label text-g-600">
      <AgentAvatar agentId={agentId} size="md" removed={agent === null} />
      {agent === null || agent === undefined ?
        <span>{agent === null ? "Through an agent that's gone" : "Through its agent"}</span> :
        (
          <>
            <span>
              Through{" "}
              <Link to="/agents/$agentId" params={{ agentId: agent.id }} className="font-semibold text-blue">
                {agent.name}
              </Link>, inside its rules
            </span>
            <AgentState agent={agent} />
          </>
        )}
    </span>
  )
}

/**
 * The top of an automation's page: its trigger in halftone, where it stands, what it does in a sentence, who trades,
 * why it needs a look, Pause or Resume, Edit and Delete; then how often and when it ran, when it runs next, and its
 * settings as chips.
 */
export function AutomationHero(
  { detail, agent, now, AgentState }: Readonly<{
    detail: AutomationDetail
    agent: Agent | null | undefined
    now: Date
    AgentState: AgentStateView
  }>
) {
  const { automation, runs } = detail
  const { busy, problem, setStatus, remove } = useAutomationActions(automation)
  const navigate = useNavigate()
  const zone = localTimeZone()

  const standing = standingOf(automation, runs)
  const attention = attentionOf(automation, runs, agent)
  const current = nowLine(automation, now, zone)
  const ended = standing === "ended"
  const last = runs[0]
  const lastAt = last?.firedAt ?? automation.lastFiredAt

  return (
    <section aria-label="What it does" className="overflow-hidden rounded-lg bg-white shadow-e2">
      <div className="grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
        <TriggerArt
          type={automation.trigger.type}
          size="hero"
          dimmed={standing === "paused" || ended}
          className="max-sm:justify-self-center"
        />

        <div className="grid min-w-0 content-start gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <StandingPill standing={standing} />
            <span className="inline-flex items-center gap-1 rounded-full bg-g-100 px-2 py-px text-[11.5px] font-medium text-g-700">
              <Icon name="zap" size={12} />
              {catalogEntry("trigger", automation.trigger.type).title}
            </span>
          </div>

          <p className="text-[20px] leading-[1.4] font-semibold tracking-[-0.02em] text-ink sm:text-[22px]">
            <AutomationSentence
              sentence={automation.description.sentence}
              symbols={stocksIn(automation)}
              className="[&_b]:text-blue-deep"
            />
          </p>

          <Trader agentId={automation.agentId} agent={agent} AgentState={AgentState} />

          {attention === null ?
            null :
            (
              <p className="flex items-start gap-2 rounded-md bg-warn-wash px-3 py-2.5 text-label-sm font-medium text-warn shadow-[inset_0_0_0_1px_var(--color-warn-line)]">
                <Icon name="warning" size={15} className="mt-px shrink-0" />
                <span>
                  {attention}
                  {last?.outcome === "failed" ? ` ${last.reason}` : ""}
                </span>
              </p>
            )}

          {ended ? null : (
            <div className="flex flex-wrap items-center gap-2">
              {automation.status === "paused" ?
                (
                  <Button size="sm" loading={busy} onClick={() => void setStatus("active")}>
                    <Icon name="play" size={14} />Resume
                  </Button>
                ) :
                (
                  <Button variant="secondary" size="sm" loading={busy} onClick={() => void setStatus("paused")}>
                    <Icon name="pause" size={14} />Pause
                  </Button>
                )}
              <EditAutomationSheet automation={automation} agent={agent} />
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="ghost" size="sm" className="text-loss hover:bg-loss-wash hover:text-loss" />}
                >
                  <Icon name="trash" size={14} />Delete
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogIcon name="trash" />
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{automation.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      It stops at once and won't run again. Trades it already proposed stay as they are.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void remove(() => navigate({ to: "/automations" }))}>
                      Delete automation
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {problem === null ? null : (
            <Alert variant="destructive">
              <AlertDescription>{problem}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="grid gap-4 border-t border-g-100 bg-g-50/50 px-5 py-4 sm:px-6">
        <StatGrid>
          <StatTile label="Ran" value={firesText(automation.fires)} />
          <StatTile
            label="Last ran"
            value={lastAt === null ? "Never" : formatRelative(DateTime.toDateUtc(lastAt), now, { timeZone: zone })}
            {...(last === undefined ? {} : { detail: OUTCOME[last.outcome].label })}
          />
          {automation.status !== "active" ? null : automation.nextRunAt === null ?
            <StatTile label="Runs" value="On its trigger" detail={current.text} /> :
            (
              <StatTile
                label="Next run"
                value={formatDate(DateTime.toDateUtc(automation.nextRunAt), { timeZone: zone })}
                detail={untilText(automation.nextRunAt, now)}
              />
            )}
          <StatTile
            label="Set up"
            value={formatDate(DateTime.toDateUtc(automation.createdAt), { timeZone: zone, time: false })}
            detail={CREATED_BY[automation.createdBy]}
          />
        </StatGrid>
        <SettingsChips automation={automation} />
      </div>
    </section>
  )
}
