import { schedules } from "@trigger.dev/sdk"
import { JobsRuntime } from "../src/Jobs.ts"
import { snapshotPrices } from "../src/jobs/PriceSnapshot.ts"

export const pricesSnapshot = schedules.task({
  id: "prices.snapshot",
  // On the five minutes: Trigger.dev otherwise spreads scheduled runs over a 60-minute window.
  cron: { pattern: "*/5 * * * *", window: "0m" },
  run: () => JobsRuntime.runPromise(snapshotPrices).then((run) => ({ id: run.id, detail: run.detail }))
})
