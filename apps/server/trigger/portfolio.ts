import { schedules } from "@trigger.dev/sdk"
import { JobsRuntime } from "../src/Jobs.ts"
import { snapshotPortfolioValues } from "../src/jobs/PortfolioSnapshot.ts"

export const portfolioSnapshot = schedules.task({
  id: "portfolio.snapshot",
  // On the hour: Trigger.dev otherwise spreads scheduled runs over a 60-minute window.
  cron: { pattern: "0 */4 * * *", window: "0m" },
  run: () => JobsRuntime.runPromise(snapshotPortfolioValues).then((run) => ({ id: run.id, detail: run.detail }))
})
