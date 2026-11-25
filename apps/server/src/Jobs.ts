import { ChainClient } from "@bluechip/chain/ChainClient"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { Database } from "./db/Database.ts"
import { LoggingLive } from "./Logging.ts"
import { Alpaca } from "./market/alpaca/Alpaca.ts"

/**
 * The services Trigger.dev tasks run with, built once per worker process and shared by every task run in it. Tasks
 * call `JobsRuntime.runPromise(program)`.
 */
export const JobsRuntime = ManagedRuntime.make(
  Layer.mergeAll(Database.layer, ChainClient.layer, Alpaca.layer).pipe(Layer.provideMerge(LoggingLive))
)
