import { ChainClient } from "@bluechip/chain/ChainClient"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import { typeid } from "typeid-js"
import { Database } from "../db/Database.ts"
import { jobRuns } from "../db/schema/jobRuns.ts"

/** Proves the job stack end to end: the task reads the chain and writes a `job_runs` row. */
export const recordHeartbeat = Effect.gen(function*() {
  const db = yield* Database
  const chain = yield* ChainClient
  const startedAt = yield* DateTime.now
  const blockNumber = yield* chain.use("eth_blockNumber", (client) => client.getBlockNumber())
  const finishedAt = yield* DateTime.now
  const [run] = yield* db.insert(jobRuns).values({
    id: typeid("job").toString() as `job_${string}`,
    task: "heartbeat",
    status: "succeeded",
    startedAt,
    finishedAt,
    detail: { network: chain.network, blockNumber: blockNumber.toString() }
  }).returning()
  return run!
}).pipe(Effect.withSpan("jobs.heartbeat"))
