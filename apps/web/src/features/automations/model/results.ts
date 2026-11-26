// What an automation's runs came to, in words, for its page's results.
import type { RunCount } from "@bluechip/domain/performance/Performance"
import { RUN_OUTCOME } from "../../../lib/automationWords.ts"

/** "4 runs: 3 traded, 1 skipped." or "No runs yet." */
export const runsSentence = (runs: number, outcomes: ReadonlyArray<RunCount>): string => {
  if (runs === 0) return "No runs yet."
  const parts = outcomes.map((row) => `${row.count} ${RUN_OUTCOME[row.outcome].word}`)
  return `${runs} ${runs === 1 ? "run" : "runs"}${parts.length === 0 ? "" : `: ${parts.join(", ")}`}.`
}
