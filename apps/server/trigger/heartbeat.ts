import { schedules } from "@trigger.dev/sdk"
import { JobsRuntime } from "../src/Jobs.ts"
import { recordHeartbeat } from "../src/jobs/Heartbeat.ts"

export const heartbeat = schedules.task({
  id: "heartbeat",
  cron: "* * * * *",
  run: () => JobsRuntime.runPromise(recordHeartbeat).then((run) => ({ id: run.id, detail: run.detail }))
})
