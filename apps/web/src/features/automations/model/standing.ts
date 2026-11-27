// How automations read in their lists and page, beyond their standing (`lib/automationWords.ts`): whether one needs
// attention and why; the list's counts and filters; and when it runs next.
import type { Agent } from "@bluechip/domain/agents/Agent"
import { type Automation, triggerOf } from "@bluechip/domain/automations/Automation"
import type { AutomationRun, RunResult } from "@bluechip/domain/automations/Run"
import type { Watcher } from "@bluechip/domain/automations/Trigger"
import type { AgentId } from "@bluechip/domain/Ids"
import * as DateTime from "effect/DateTime"
import { RUN_RESULT, type Standing } from "../../../lib/automationWords.ts"
import { dayHeading, yourDateTime } from "../../../lib/localTime.ts"

/**
 * Why a running automation needs a look, or `null`: its last run failed (and why), or its agent can't trade for it (paused,
 * session ended, removed). `agent` is the agent it trades through: `null` when none of yours has its id, `undefined`
 * while your agents load. Your own trades have none to check.
 */
export const attentionOf = (
  automation: Pick<Automation, "status" | "agentId">,
  runs: ReadonlyArray<Pick<AutomationRun, "outcome" | "reason">>,
  agent: Pick<Agent, "status" | "paused"> | null | undefined
): string | null => {
  if (automation.status !== "active") return null
  if (runs[0]?.outcome === "failed") return `Its last run failed. ${runs[0].reason}`
  if (automation.agentId === null || agent === undefined) return null
  if (agent === null || agent.status === "removed") return "Its agent was removed, so it can't trade."
  if (agent.status === "expired") return "Its agent's session ended, so it can't trade until you renew it."
  if (agent.paused) return "Its agent is paused, so it won't trade until you resume it."
  return null
}

export type Filter = "all" | "active" | "paused" | "attention"

export const FILTERS: ReadonlyArray<{ readonly value: Filter; readonly label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "attention", label: "Needs attention" }
]

/** Fewer automations than this read at a glance, so a list shows no filters. */
export const FILTERS_FROM = 4

/** One automation as the list reads it: where it stands and whether it needs a look. */
export interface Listed {
  readonly standing: Standing
  readonly attention: string | null
}

/** Whether a listed automation shows under a filter; a failing one is still active. */
export const shows = (listed: Listed, filter: Filter): boolean => {
  switch (filter) {
    case "all":
      return true
    case "active":
      return listed.standing === "active" || listed.standing === "failing"
    case "paused":
      return listed.standing === "paused"
    case "attention":
      return listed.attention !== null
  }
}

/** Who an automation list shows: everyone's, your own trades (`"you"`), or one agent's. */
export type TraderFilter = "all" | "you" | AgentId

/** Whether an automation trades through the trader a list is filtered to. */
export const tradesThrough = (automation: Pick<Automation, "agentId">, trader: TraderFilter): boolean =>
  trader === "all" ? true : trader === "you" ? automation.agentId === null : automation.agentId === trader

const RANK: Readonly<Record<Standing, number>> = { failing: 1, active: 1, paused: 2, expired: 3, ended: 3 }

/**
 * Automations in the order a list shows them: those that need a look first, then the running ones by their next run
 * (soonest first, then those that run on a live trigger), then paused, then ended; by name within each.
 */
export const sortListed = <A extends Listed & { readonly automation: Pick<Automation, "name" | "nextRunAt"> }>(
  rows: ReadonlyArray<A>
): Array<A> => {
  const rank = (row: A) => row.attention === null ? RANK[row.standing] : 0
  const next = (row: A) =>
    row.standing === "active" && row.automation.nextRunAt !== null ?
      DateTime.toEpochMillis(row.automation.nextRunAt) :
      Number.POSITIVE_INFINITY

  return rows.toSorted((a, b) =>
    rank(a) - rank(b) ||
    (next(a) === next(b) ? 0 : next(a) < next(b) ? -1 : 1) ||
    a.automation.name.localeCompare(b.automation.name)
  )
}

/** How many automations each filter shows. */
export const filterCounts = (listed: ReadonlyArray<Listed>): Readonly<Record<Filter, number>> => ({
  all: listed.length,
  active: listed.filter((each) => shows(each, "active")).length,
  paused: listed.filter((each) => shows(each, "paused")).length,
  attention: listed.filter((each) => shows(each, "attention")).length
})

/** The runs that fired today in the viewer's zone. */
export const runsToday = (runs: ReadonlyArray<Pick<AutomationRun, "firedAt">>, now: Date, zone: string): number =>
  runs.filter((run) => dayHeading(run.firedAt, now, zone) === "Today").length

/** The list's headline: how many are running, or that none are. */
export const summaryHeadline = (counts: Readonly<Record<Filter, number>>): string => {
  if (counts.active === 0) return counts.all === 0 ? "No automations yet" : "Nothing running right now"
  return `${counts.active} ${counts.active === 1 ? "automation" : "automations"} watching for you`
}

/**
 * The line under it: which need attention ("Weekly Apple needs attention." or "2 need attention: Weekly Apple and
 * Stop-loss."),
 * else how often they ran today.
 */
export const summaryDetail = (needLook: ReadonlyArray<string>, today: number): string => {
  if (needLook.length === 1) return `${needLook[0]} needs attention.`
  if (needLook.length > 1) {
    const names = `${needLook.slice(0, -1).join(", ")} and ${needLook.at(-1)}`
    return `${needLook.length} need attention: ${names}.`
  }
  if (today === 0) return "Nothing has run yet today."
  return today === 1 ? "They ran once today." : `They ran ${today} times today.`
}

/** "in 12 min", "in 3 h", "tomorrow", "in 4 days"; "now" once it's due, never before. */
export const untilText = (at: DateTime.Utc, now: Date): string => {
  const minutes = (DateTime.toEpochMillis(at) - now.getTime()) / 60_000
  if (minutes <= 0) return "now"
  // Rounded up: the last seconds before it's due still say "in 1 min".
  if (Math.ceil(minutes) < 60) return `in ${Math.ceil(minutes)} min`
  if (minutes < 24 * 60) return `in ${Math.round(minutes / 60)} h`
  const days = Math.round(minutes / (24 * 60))
  return days === 1 ? "tomorrow" : `in ${days} days`
}

const WATCHING: Readonly<Record<Watcher, string>> = {
  schedule: "Waiting for its next time",
  price: "Watching prices live",
  portfolio: "Watching your portfolio",
  news: "Watching the news"
}

/**
 * What it's doing now, in a line: when a schedule runs next ("Next run Mon 30 Nov, 10:00, in 2 days"), what a running
 * trigger watches, or that it's paused or over. Times are the viewer's, in `zone`, and say so.
 */
export const nowLine = (
  automation: Pick<Automation, "status" | "nextRunAt" | "trigger">,
  now: Date,
  zone: string
): { readonly kind: "next" | "watching" | "paused" | "ended"; readonly text: string } => {
  switch (automation.status) {
    case "active":
      return automation.nextRunAt === null ?
        { kind: "watching", text: WATCHING[triggerOf(automation.trigger).watcher] } :
        {
          kind: "next",
          text: `Next run ${yourDateTime(DateTime.toDateUtc(automation.nextRunAt), zone)}, ${
            untilText(automation.nextRunAt, now)
          }`
        }
    case "paused":
      return { kind: "paused", text: "Paused, nothing runs until you resume it" }
    case "done":
      return { kind: "ended", text: "Done, it ran as many times as it may" }
    case "expired":
      return { kind: "ended", text: "Ended on its end date" }
    case "deleted":
      return { kind: "ended", text: "Deleted" }
  }
}

/** The recent runs' results in words, for a strip of dots: "Last 3 runs: 2 traded, 1 blocked". */
export const stripLabel = (results: ReadonlyArray<RunResult>): string => {
  if (results.length === 0) return "No runs yet"
  const counts = new Map<RunResult, number>()
  for (const result of results) counts.set(result, (counts.get(result) ?? 0) + 1)
  const parts = [...counts].map(([result, count]) => `${count} ${RUN_RESULT[result].word}`)
  return `${results.length === 1 ? "Last run" : `Last ${results.length} runs`}: ${parts.join(", ")}`
}
