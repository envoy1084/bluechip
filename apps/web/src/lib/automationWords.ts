// Where an automation stands and how its runs ended, in the words every screen and chat card uses.
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { AutomationRun, RunOutcome, RunResult } from "@bluechip/domain/automations/Run"
import { policyOf } from "@bluechip/domain/policies/Catalog"
import type { StatusWords } from "./intentStatus.ts"

/** Running and watching, its last run failed, paused by you, past its end date, or over (done or deleted). */
export type Standing = "active" | "failing" | "paused" | "expired" | "ended"

export const STANDING: Readonly<Record<Standing, StatusWords>> = {
  active: { label: "Active", tone: "positive" },
  failing: { label: "Needs attention", tone: "attention" },
  paused: { label: "Paused", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" }
}

/** Where an automation stands, from its status and its latest run first. */
export const standingOf = (
  automation: Pick<Automation, "status">,
  runs: ReadonlyArray<Pick<AutomationRun, "outcome">>
): Standing => {
  if (automation.status === "paused") return "paused"
  if (automation.status === "expired") return "expired"
  if (automation.status !== "active") return "ended"
  return runs[0]?.outcome === "failed" ? "failing" : "active"
}

/** Whether it is over and won't run again: expired, done or deleted. */
export const hasEnded = (standing: Standing): boolean => standing === "expired" || standing === "ended"

/**
 * How a run ended when it fired, as its journal entry tells it: its trades were only proposed then, so a proposed run
 * never reads as traded.
 */
export const RUN_OUTCOME: Readonly<Record<RunOutcome, StatusWords>> = {
  proposed: { label: "Proposed", tone: "info" },
  asked: { label: "Asked you", tone: "pending" },
  notified: { label: "Told you", tone: "info" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "negative" }
}

/** What a run came to: as its pill, and as the word a sentence counts it by ("2 traded, 1 blocked"). */
export const RUN_RESULT: Readonly<Record<RunResult, StatusWords & { readonly word: string }>> = {
  traded: { label: "Traded", word: "traded", tone: "positive" },
  partlyTraded: { label: "Partly traded", word: "partly traded", tone: "attention" },
  blocked: { label: "Blocked", word: "blocked", tone: "negative" },
  notTraded: { label: "Nothing traded", word: "traded nothing", tone: "neutral" },
  working: { label: "Trading", word: "trading", tone: "pending" },
  asked: { label: "Asked you", word: "asked you", tone: "pending" },
  notified: { label: "Told you", word: "told you", tone: "info" },
  skipped: { label: "Skipped", word: "skipped", tone: "neutral" },
  failed: { label: "Failed", word: "failed", tone: "negative" }
}

/**
 * A run's result in a sentence, when its trades say more than its pill: which policies blocked them, and whether
 * others filled. `null` for every other result.
 */
export const runResultText = (run: Pick<AutomationRun, "result" | "blockedBy">): string | null => {
  const policies = run.blockedBy.map((id) => policyOf(id).title)
  const by = policies.length === 0 ? "" : ` by ${policies.join(" and ")}`
  if (run.result === "blocked") return `Its trades were blocked${by}, so nothing was traded.`
  if (run.result === "partlyTraded") {
    return `Some of its trades filled; the others didn't go through${policies.length === 0 ? "" : `, blocked${by}`}.`
  }
  return null
}
