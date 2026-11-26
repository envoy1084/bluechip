// What an automation's runs came to, in words, for its page's results.
import type { RunCount } from "@bluechip/domain/performance/Performance"

const OUTCOMES: Readonly<Record<RunCount["outcome"], string>> = {
  proposed: "traded",
  asked: "asked you",
  notified: "told you",
  skipped: "held back",
  failed: "failed"
}

/** "4 runs: 3 traded, 1 held back." or "No runs yet." */
export const runsSentence = (runs: number, outcomes: ReadonlyArray<RunCount>): string => {
  if (runs === 0) return "No runs yet."
  const parts = outcomes.map((row) => `${row.count} ${OUTCOMES[row.outcome]}`)
  return `${runs} ${runs === 1 ? "run" : "runs"}${parts.length === 0 ? "" : `: ${parts.join(", ")}`}.`
}
