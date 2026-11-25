import { schedules } from "@trigger.dev/sdk"
import { JobsRuntime } from "../src/Jobs.ts"
import { recordHeartbeat } from "../src/jobs/Heartbeat.ts"

export const heartbeat = schedules.task({
  id: "heartbeat",
  // Run on the minute: Trigger.dev otherwise spreads scheduled runs over a 60-minute window.
  cron: { pattern: "* * * * *", window: "0m" },
  run: () => JobsRuntime.runPromise(recordHeartbeat).then((run) => ({ id: run.id, detail: run.detail }))
})
