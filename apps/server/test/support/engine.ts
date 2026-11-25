// The durable engine in tests: Effect's in-memory runner, so parallel test workers sharing one database never pick up
// each other's messages, polling fast so a message sent at startup isn't left waiting.
import * as ClusterWorkflowEngine from "effect/cluster/ClusterWorkflowEngine"
import * as MessageStorage from "effect/cluster/MessageStorage"
import * as RunnerHealth from "effect/cluster/RunnerHealth"
import * as Runners from "effect/cluster/Runners"
import * as RunnerStorage from "effect/cluster/RunnerStorage"
import * as Sharding from "effect/cluster/Sharding"
import * as ShardingConfig from "effect/cluster/ShardingConfig"
import * as Layer from "effect/Layer"

export const EngineTest = ClusterWorkflowEngine.layer.pipe(
  Layer.provideMerge(Sharding.layer),
  Layer.provideMerge(Runners.layerNoop),
  Layer.provideMerge(MessageStorage.layerMemory),
  Layer.provide([RunnerStorage.layerMemory, RunnerHealth.layerNoop]),
  Layer.provide(
    ShardingConfig.layer({ entityMessagePollInterval: "50 millis", refreshAssignmentsInterval: "50 millis" })
  )
)
