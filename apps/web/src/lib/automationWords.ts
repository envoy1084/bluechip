// Where an automation stands and how its runs ended, in the words every screen and chat card uses.
import type { Automation } from "@bluechip/domain/automations/Automation"
import type { AutomationRun, RunOutcome } from "@bluechip/domain/automations/Run"
import type { StatusWords } from "./intentStatus.ts"

/** Running and watching, its last run failed, paused by you, or over (done, expired or deleted). */
export type Standing = "active" | "failing" | "paused" | "ended"

export const STANDING: Readonly<Record<Standing, StatusWords>> = {
  active: { label: "Active", tone: "positive" },
  failing: { label: "Needs attention", tone: "attention" },
  paused: { label: "Paused", tone: "neutral" },
  ended: { label: "Ended", tone: "neutral" }
}

/** Where an automation stands, from its status and its latest run first. */
export const standingOf = (
  automation: Pick<Automation, "status">,
  runs: ReadonlyArray<Pick<AutomationRun, "outcome">>
): Standing => {
  if (automation.status === "paused") return "paused"
  if (automation.status !== "active") return "ended"
  return runs[0]?.outcome === "failed" ? "failing" : "active"
}

/** How a run ended: as its pill, and as the word a sentence counts it by ("2 traded, 1 skipped"). */
export const RUN_OUTCOME: Readonly<Record<RunOutcome, StatusWords & { readonly word: string }>> = {
  proposed: { label: "Traded", word: "traded", tone: "positive" },
  asked: { label: "Asked you", word: "asked you", tone: "pending" },
  notified: { label: "Told you", word: "told you", tone: "info" },
  skipped: { label: "Skipped", word: "skipped", tone: "neutral" },
  failed: { label: "Failed", word: "failed", tone: "negative" }
}
