import type { Automation } from "@bluechip/domain/automations/Automation"
import { StatusPill } from "@bluechip/ui/bluechip/status-pill"
import { Button } from "@bluechip/ui/components/button"
import { Icon, type IconName } from "@bluechip/ui/icons/icon"
import { cn } from "@bluechip/ui/lib/cn"
import { formatRelative } from "@bluechip/ui/lib/format"
import { Link } from "@tanstack/react-router"
import * as DateTime from "effect/DateTime"
import { StandingPill } from "../../../../components/StandingPill.tsx"
import { WhoChip } from "../../../../components/WhoChip.tsx"
import { RUN_OUTCOME } from "../../../../lib/automationWords.ts"
import { localTimeZone } from "../../../../lib/localTime.ts"
import { useAutomationActions } from "../../hooks/useAutomationActions.ts"
import type { ListedAutomation } from "../../hooks/useListedAutomations.ts"
import { stocksIn } from "../../model/sentence.ts"
import { nowLine } from "../../model/standing.ts"
import { AutomationSentence } from "../AutomationSentence.tsx"
import { RunStrip } from "../RunStrip.tsx"
import { TriggerArt } from "../TriggerArt.tsx"

const NOW_ICON: Readonly<Record<ReturnType<typeof nowLine>["kind"], IconName>> = {
  next: "clock",
  watching: "eye",
  paused: "pause",
  ended: "flag"
}

/** Who trades, as the chip rows use: you with Face ID, or the agent with its butterfly. */
function Trader({ row }: Readonly<{ row: ListedAutomation }>) {
  const { agentId } = row.automation
  if (agentId === null) return <WhoChip who={{ _tag: "source", source: "owner" }}>You, with Face ID</WhoChip>
  return (
    <WhoChip who={{ _tag: "agent", id: agentId, name: row.agent?.name }}>
      {row.agent === null ? "A removed agent" : undefined}
    </WhoChip>
  )
}

/** Pause or Resume in one tap, for an automation that hasn't ended. */
function PauseToggle({ automation }: Readonly<{ automation: Automation }>) {
  const { busy, problem, setStatus } = useAutomationActions(automation)
  const paused = automation.status === "paused"

  return (
    <span className="grid justify-items-end gap-1">
      <Button
        variant="secondary"
        size="xs"
        loading={busy}
        aria-label={`${paused ? "Resume" : "Pause"} ${automation.name}`}
        onClick={() => void setStatus(paused ? "active" : "paused")}
      >
        <Icon name={paused ? "play" : "pause"} size={13} />
        {paused ? "Resume" : "Pause"}
      </Button>
      {problem === null
        ? null
        : <span role="alert" className="max-w-[24ch] text-right text-caption text-loss">{problem}</span>}
    </span>
  )
}

/**
 * One automation in a list: its trigger's illustration, its name and where it stands, what it does in a sentence,
 * what it's doing now and how it last ran, why it needs a look, its latest runs as marks, and Pause or Resume.
 * With `showTrader`, who trades: the agent's avatar and name, or you with Face ID.
 */
export function AutomationRow(
  { row, showTrader, now, index }: Readonly<{
    row: ListedAutomation
    /** Say who trades on the row, for a list of everyone's automations. */
    showTrader: boolean
    now: Date
    /** Its place in the list, to stagger the rows in. */
    index: number
  }>
) {
  const { automation, runs, standing, attention } = row
  const zone = localTimeZone()
  const current = nowLine(automation, now, zone)
  const last = runs?.[0]
  const lastAt = last?.firedAt ?? automation.lastFiredAt
  const quiet = standing === "paused" || standing === "ended"

  return (
    <li
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-b border-g-100 px-5 py-4 last:border-b-0",
        "transition-colors duration-fast ease-brand hover:bg-g-50/60 motion-safe:animate-slide-up",
        "sm:grid-cols-[auto_minmax(0,1fr)_auto]",
        standing === "failing" && "bg-[linear-gradient(180deg,#fffcf2,#fff8e1)] hover:bg-warn-wash"
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: "both" }}
    >
      <TriggerArt type={automation.trigger.type} dimmed={quiet} className="mt-0.5" />

      <Link
        to="/automations/$automationId"
        params={{ automationId: automation.id }}
        className="-m-1 grid min-w-0 gap-1.5 rounded-md p-1 focus-visible:shadow-[0_0_0_2px_var(--color-blue)] focus-visible:outline-none"
      >
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{automation.name}</b>
          <StandingPill standing={standing} />
        </span>
        <AutomationSentence
          sentence={automation.description.sentence}
          symbols={stocksIn(automation)}
          className={cn("text-label leading-relaxed", quiet ? "text-g-500" : "text-g-700")}
        />
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-g-500">
          {showTrader ? <Trader row={row} /> : null}
          <span className="inline-flex items-center gap-1.5">
            <Icon name={NOW_ICON[current.kind]} size={13} className="text-g-400" />
            {current.text}
          </span>
          {lastAt === null ?
            (standing === "active" ? <span>Hasn't run yet</span> : null) :
            (
              <span className="inline-flex items-center gap-1.5">
                Last ran {formatRelative(DateTime.toDateUtc(lastAt), now, { timeZone: zone })}
                {last === undefined ?
                  null :
                  <StatusPill tone={RUN_OUTCOME[last.outcome].tone}>{RUN_OUTCOME[last.outcome].label}</StatusPill>}
              </span>
            )}
        </span>
        {attention === null ? null : (
          <span className="flex items-start gap-1.5 text-label-sm font-medium text-warn">
            <Icon name="warning" size={14} className="mt-px shrink-0" />
            {attention}
          </span>
        )}
      </Link>

      <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-start">
        {runs === undefined ? null : <RunStrip runs={runs} />}
        {standing === "ended" ? null : <PauseToggle automation={automation} />}
      </div>
    </li>
  )
}
