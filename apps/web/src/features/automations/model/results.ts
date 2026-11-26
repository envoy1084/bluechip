// What an automation's runs came to, in words, for its page's hero and results. Every count reads the ledger's runs
// (`AutomationPerformance`), so the page says one number.
import type { RunCount } from "@bluechip/domain/performance/Performance"
import { RUN_OUTCOME } from "../../../lib/automationWords.ts"

/** How many times it ran: "Not yet", "Once", "12 times". */
export const timesText = (runs: number): string => runs === 0 ? "Not yet" : runs === 1 ? "Once" : `${runs} times`

/** How its runs ended, by outcome: "3 traded, 1 skipped". */
export const outcomesText = (outcomes: ReadonlyArray<RunCount>): string =>
  outcomes.map((row) => `${row.count} ${RUN_OUTCOME[row.outcome].word}`).join(", ")

/** "4 runs: 3 traded, 1 skipped." or "No runs yet." */
export const runsSentence = (runs: number, outcomes: ReadonlyArray<RunCount>): string => {
  if (runs === 0) return "No runs yet."
  return `${runs} ${runs === 1 ? "run" : "runs"}${outcomes.length === 0 ? "" : `: ${outcomesText(outcomes)}`}.`
}
