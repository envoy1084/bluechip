// bluechip's durable engine: Effect's cluster on one runner inside the server, keeping entity mailboxes, workflow
// state and crons in Postgres (`cluster_*` tables, created by Effect's own migrations, not drizzle-kit). Running
// several instances later swaps `SingleRunner` for a networked runner; nothing built on the engine changes.
import * as ClusterWorkflowEngine from "effect/cluster/ClusterWorkflowEngine"
import * as SingleRunner from "effect/cluster/SingleRunner"
import * as Digest from "effect/crypto/Digest"
import * as Layer from "effect/Layer"

/**
 * Sharding, message storage and the workflow engine, on the server's `SqlClient`. `runnerStorage: "memory"` makes
 * this process own every shard at once (tests, where parallel workers share one database); the server keeps shard
 * locks in Postgres so a second instance can never run the same entity.
 */
export const engineLayer = (options: { readonly runnerStorage: "sql" | "memory" }) =>
  ClusterWorkflowEngine.layer.pipe(
    Layer.provideMerge(SingleRunner.layer({
      runnerStorage: options.runnerStorage,
      // A message sent before this runner holds its shards (just after a start) waits for the next poll: keep that
      // to a second rather than Effect's default 10, since a trade may be waiting behind it.
      shardingConfig: { entityMessagePollInterval: "1 second", refreshAssignmentsInterval: "1 second" }
    })),
    Layer.provide(Digest.layerWebCrypto)
  )

export const EngineLive = engineLayer({ runnerStorage: "sql" })
